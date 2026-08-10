import { supabaseAdmin, supabaseAnon } from '../config/supabase.js'
import { EVOLUTION_BASE_URL } from '../config/env.js'
import { getSystemConfig } from './systemConfigService.js'
import { evolutionFetch, resolveTargetGroups } from './evolutionService.js'
import { publishInstagramFeedPost } from './instagramService.js'
import { incrementUserPostCount } from '../middlewares/limitMiddleware.js'

export let schedulerRunning = false

export async function runScheduler() {
  if (!supabaseAdmin) {
    console.warn('[Scheduler] Supabase Admin não configurado — scheduler pausado.')
    return 0
  }

  const { baseUrl: sysBaseUrl } = await getSystemConfig().catch(() => ({ baseUrl: '' }))
  const effectiveBaseUrl = EVOLUTION_BASE_URL || sysBaseUrl
  if (!effectiveBaseUrl) {
    console.warn('[Scheduler] Evolution API não configurada — scheduler pausado.')
    return 0
  }

  const now = new Date().toISOString()

  const { data: duePosts, error } = await supabaseAdmin
    .from('schedules')
    .select('*, offers(*)')
    .in('status', ['pending', 'scheduled'])
    .lte('scheduled_at', now)

  if (error) {
    console.error('[Scheduler] Erro ao buscar agendamentos:', error.message)
    return 0
  }

  if (!duePosts || duePosts.length === 0) {
    return 0
  }

  console.log(`[Scheduler] Processando ${duePosts.length} post(s) agendado(s)...`)
  let totalProcessed = 0

  for (const schedule of duePosts) {
    const offer = schedule.offers
    if (!offer) {
      console.warn(`[Scheduler] Agendamento ${schedule.id} sem oferta vinculada — pulando.`)
      continue
    }

    let instanceName = null
    let instanceStatus = 'disconnected'

    if (schedule.user_id) {
      const { data: userProfile } = await supabaseAdmin
        .from('profiles')
        .select('instance_name, instance_status')
        .eq('id', schedule.user_id)
        .maybeSingle()

      instanceName = userProfile?.instance_name || `usr_${String(schedule.user_id).replace(/-/g, '')}`
      instanceStatus = userProfile?.instance_status || 'disconnected'

      if (instanceName && instanceStatus !== 'connected') {
        try {
          const stateData = await evolutionFetch(`/instance/connectionState/${instanceName}`)
          const state = stateData?.instance?.state || stateData?.state
          if (state === 'open' || state === 'CONNECTED') {
            instanceStatus = 'connected'
            await supabaseAdmin.from('profiles').update({ instance_status: 'connected' }).eq('id', schedule.user_id)
          }
        } catch (stateErr) {
          console.warn(`[Scheduler] Erro ao checar status da instância ${instanceName}:`, stateErr.message)
        }
      }
    }

    if (!instanceName || instanceStatus !== 'connected') {
      const { data: fallbackProfile } = await supabaseAdmin
        .from('profiles')
        .select('instance_name, instance_status')
        .eq('instance_status', 'connected')
        .limit(1)
        .maybeSingle()

      if (fallbackProfile) {
        instanceName = fallbackProfile.instance_name
        instanceStatus = fallbackProfile.instance_status
      }
    }

    let channels = Array.isArray(schedule.channels) ? schedule.channels : []
    if (channels.length === 0) {
      channels = [{ type: 'whatsapp', targetId: 'all', targetName: 'Todos os Grupos' }]
    }

    let success = false
    let hasInstagramChannel = false
    let instagramSuccess = false

    for (const channel of channels) {
      if (channel.type === 'instagram') {
        hasInstagramChannel = true

        if (schedule.user_id && offer.image_url) {
          try {
            const { data: igProfile } = await supabaseAdmin
              .from('profiles')
              .select('instagram_connected, instagram_account_id, instagram_access_token')
              .eq('id', schedule.user_id)
              .maybeSingle()

            if (igProfile?.instagram_connected && igProfile?.instagram_account_id && igProfile?.instagram_access_token) {
              await publishInstagramFeedPost({
                accountId: igProfile.instagram_account_id,
                accessToken: igProfile.instagram_access_token,
                imageUrl: offer.image_url,
                caption: offer.copy_text || offer.title || '',
              })
              instagramSuccess = true
              success = true
              console.log(`[Scheduler] Post no Instagram enviado para agendamento ${schedule.id}`)
            } else {
              console.warn(`[Scheduler] Instagram não configurado para o usuário ${schedule.user_id}`)
              // Salva erro no banco para rastreabilidade
              await supabaseAdmin
                .from('schedules')
                .update({ error_message: 'Instagram não conectado ou credenciais ausentes.' })
                .eq('id', schedule.id)
            }
          } catch (igErr) {
            console.error(`[Scheduler] Erro no envio para Instagram:`, igErr.message)

            // Fix #3: Persiste a mensagem de erro no banco
            await supabaseAdmin
              .from('schedules')
              .update({ error_message: igErr.message || 'Erro desconhecido ao postar no Instagram.' })
              .eq('id', schedule.id)
              .catch(() => {})

            // Fix #2: Se o token expirou, desconecta a conta automaticamente
            const isTokenError =
              igErr.message?.includes('access token') ||
              igErr.message?.includes('Session has expired') ||
              igErr.message?.includes('Invalid OAuth access token') ||
              igErr.message?.includes('Error validating')

            if (isTokenError && schedule.user_id) {
              await supabaseAdmin
                .from('profiles')
                .update({ instagram_connected: false })
                .eq('id', schedule.user_id)
                .catch(() => {})
              console.warn(
                `[Scheduler] Token do Instagram expirado para usuário ${schedule.user_id} — conta desconectada automaticamente.`
              )
            }
          }
        }
        continue
      }

      if (channel.type !== 'whatsapp') continue

      if (!instanceName || instanceStatus !== 'connected') {
        console.warn(`[Scheduler] Agendamento ${schedule.id} ignorado no WhatsApp: Nenhuma instância conectada.`)
        continue
      }

      const targetIds = await resolveTargetGroups(instanceName, channel.targetId).catch(() => [])

      for (const target of targetIds) {
        if (!target || target.startsWith('cms')) continue
        try {
          if (offer.image_url && offer.image_url.trim().length > 0) {
            const isDataUri = offer.image_url.startsWith('data:')
            const isHttp = offer.image_url.startsWith('http')
            const lower = offer.image_url.toLowerCase()
            const isVideo = lower.startsWith('data:video/') || lower.endsWith('.mp4') || lower.endsWith('.webm')

            await evolutionFetch(`/message/sendMedia/${instanceName}`, 'POST', {
              number: target,
              mediaType: isVideo ? 'video' : 'image',
              mediatype: isVideo ? 'video' : 'image',
              mediaUrl: isHttp ? offer.image_url : undefined,
              media: isHttp ? offer.image_url : (isDataUri ? offer.image_url.split(',')[1] : offer.image_url),
              caption: offer.copy_text || '',
              fileName: isVideo ? 'video.mp4' : 'imagem.jpg',
              mimetype: isVideo ? 'video/mp4' : 'image/jpeg',
            })
          } else {
            await evolutionFetch(`/message/sendText/${instanceName}`, 'POST', {
              number: target,
              text: offer.copy_text || '',
              options: { delay: 1200, presence: 'composing' },
            })
          }
          success = true
        } catch (e) {
          console.error(`[Scheduler] Erro no envio para ${target}:`, e.message)
        }
      }
    }

    // Fix #1: Se o único canal era Instagram e ele falhou, status = 'failed'
    // Não basta checar `success` globalmente; canais Instagram têm rastreamento próprio
    const onlyInstagram = hasInstagramChannel && channels.every((c) => c.type === 'instagram')
    let newStatus
    if (onlyInstagram) {
      newStatus = instagramSuccess ? 'sent' : 'failed'
    } else {
      newStatus = success ? 'sent' : 'failed'
    }

    await supabaseAdmin
      .from('schedules')
      .update({ status: newStatus, sent_at: new Date().toISOString() })
      .eq('id', schedule.id)

    if (schedule.offer_id) {
      try {
        await supabaseAdmin
          .from('offers')
          .update({ status: newStatus })
          .eq('id', schedule.offer_id)
      } catch {}
    }

    if (newStatus === 'sent' && schedule.user_id) {
      try {
        await incrementUserPostCount(schedule.user_id)
      } catch {}
    }

    totalProcessed++
    console.log(`[Scheduler] Post ${schedule.id} → ${newStatus === 'sent' ? '✅ enviado com sucesso' : '❌ falhou no envio'}`)
  }

  return totalProcessed
}

export async function keepAliveSupabase() {
  const client = supabaseAdmin || supabaseAnon
  if (!client) return
  try {
    const { error } = await client.from('profiles').select('id', { count: 'exact', head: true }).limit(1)
    if (error) {
      console.error('[Supabase Keep-Alive] Ping falhou:', error.message)
    } else {
      console.log(`[Supabase Keep-Alive] Ping enviado com sucesso às ${new Date().toLocaleTimeString('pt-BR')}`)
    }
  } catch (e) {
    console.error('[Supabase Keep-Alive] Erro ao enviar ping:', e.message)
  }
}

export function startSchedulerWorker() {
  const KEEP_ALIVE_INTERVAL_MS = 172_800 * 1000 // 48h
  keepAliveSupabase()
  setInterval(keepAliveSupabase, KEEP_ALIVE_INTERVAL_MS)
  console.log('✅ [Supabase Keep-Alive] Ativo — Intervalo de 172.800s (48h).')

  if (supabaseAdmin) {
    schedulerRunning = true
    runScheduler().catch(console.error)
    setInterval(() => runScheduler().catch(console.error), 30_000)
    console.log('✅ [Scheduler] Worker multi-tenant ativo — 30s de ciclo de postagens.')
  } else {
    console.warn('[Scheduler] Desativado. Configure: SUPABASE_URL/SERVICE_ROLE_KEY')
  }
}
