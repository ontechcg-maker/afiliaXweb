import { supabaseAdmin } from '../config/supabase.js'
import { unshortenUrlService, scrapeMercadoLivreService, fetchHtmlService } from '../services/scraperService.js'
import { capturarDadosShopeeService } from '../services/shopeeService.js'
import { getSystemConfig } from '../services/systemConfigService.js'
import { runScheduler } from '../services/schedulerService.js'

export async function unshortenUrlController(req, res) {
  const url = String(req.query.url || '')
  if (!url) return res.status(400).json({ error: 'url é obrigatório.' })
  try {
    const finalUrl = await unshortenUrlService(url)
    res.json({ finalUrl })
  } catch {
    res.json({ finalUrl: url })
  }
}

export async function scrapeMercadoLivreController(req, res) {
  const { url } = req.body || {}
  if (!url) return res.status(400).json({ error: 'url é obrigatório.' })
  try {
    const data = await scrapeMercadoLivreService(url)
    res.json(data)
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}

export async function scrapeShopeeController(req, res) {
  const { url, shopeeAppKey, shopeeAppSecret } = req.body || {}
  if (!url) return res.status(400).json({ error: 'url é obrigatório.' })

  try {
    const sysConfig = await getSystemConfig()
    let appId = shopeeAppKey?.trim() || sysConfig.shopeeAppId
    let secret = shopeeAppSecret?.trim() || sysConfig.shopeeAppSecret

    // Se o usuário autenticado possuir chaves próprias no perfil
    if (req.user?.id && supabaseAdmin) {
      try {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('shopee_app_key, shopee_app_secret')
          .eq('id', req.user.id)
          .maybeSingle()

        if (profile?.shopee_app_key?.trim()) {
          appId = profile.shopee_app_key.trim()
        }
        if (profile?.shopee_app_secret?.trim()) {
          secret = profile.shopee_app_secret.trim()
        }
      } catch {}
    }

    if (!appId || !secret) {
      return res.status(400).json({
        ok: false,
        error: 'Chaves da API da Shopee não configuradas no sistema. Configure o SHOPEE_APP_ID e SECRET no Painel Admin ou em suas Configurações.',
      })
    }

    const data = await capturarDadosShopeeService(url, appId, secret)
    res.json(data)
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}

export async function fetchHtmlController(req, res) {
  const { url } = req.body || {}
  if (!url) return res.status(400).json({ error: 'url é obrigatório.' })
  try {
    const data = await fetchHtmlService(url)
    res.json(data)
  } catch (e) {
    res.json({ ok: false, html: '', error: e.message })
  }
}

export async function getSchedulesController(req, res) {
  try {
    if (!supabaseAdmin) return res.json([])

    const userId = req.user?.id

    let { data: schedules, error: schedError } = await supabaseAdmin
      .from('schedules')
      .select('id, offer_id, channels, scheduled_at, status, user_id, offers(id, title, copy_text, image_url, affiliate_link, url)')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .order('scheduled_at', { ascending: false })
      .limit(100)

    if (schedError) {
      console.error('[GET /schedules] Erro schedules:', schedError.message)
      const { data: fallbackSchedules } = await supabaseAdmin
        .from('schedules')
        .select('id, offer_id, channels, scheduled_at, status, user_id, offers(id, title, copy_text, image_url, affiliate_link, url)')
        .eq('user_id', userId)
        .order('scheduled_at', { ascending: false })
        .limit(100)

      if (fallbackSchedules) schedules = fallbackSchedules
    }

    const formatted = (schedules || []).map((s) => ({
      id: s.id,
      offerId: s.offer_id,
      title: s.offers?.title || 'Oferta Agendada',
      copyText: s.offers?.copy_text || '',
      imageUrl: s.offers?.image_url || undefined,
      affiliateLink: s.offers?.affiliate_link || s.offers?.url || '',
      channels: Array.isArray(s.channels) && s.channels.length > 0
        ? s.channels
        : [{ type: 'whatsapp', targetId: 'all', targetName: 'Todos os Grupos' }],
      scheduledAt: s.scheduled_at,
      status: s.status === 'scheduled' ? 'pending' : (s.status || 'pending'),
    }))

    // Desduplica agendamentos por id ou offerId/título + janela de tempo
    const uniqueFormatted = []
    const seenKeys = new Set()

    for (const item of formatted) {
      const schedTimeMs = item.scheduledAt ? new Date(item.scheduledAt).getTime() : 0
      const timeBlock = Math.round(schedTimeMs / 300_000) // blocos de 5 minutos
      const titleKey = (item.title || '').trim().toLowerCase()
      const dedupKey = item.id ? `sched_${item.id}` : (item.offerId ? `offer_${item.offerId}` : `title_${titleKey}_${timeBlock}`)

      if (!seenKeys.has(dedupKey)) {
        seenKeys.add(dedupKey)
        uniqueFormatted.push(item)
      }
    }

    res.json(uniqueFormatted)
  } catch (e) {
    console.error('[GET /schedules] Erro geral:', e.message)
    res.status(500).json({ error: e.message })
  }
}

export async function createScheduleController(req, res) {
  const { title, copyText, imageUrl, affiliateLink, url, priceFrom, priceTo, discountPct, coupon, channels, scheduledAt } = req.body || {}

  try {
    if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase não disponível.' })

    const { data: offer, error: offerErr } = await supabaseAdmin
      .from('offers')
      .insert({
        user_id: req.user.id,
        url: url || affiliateLink || '',
        title: title || 'Oferta de Afiliado',
        price_from: priceFrom || null,
        price_to: priceTo || null,
        discount_pct: discountPct || null,
        coupon: coupon || null,
        image_url: imageUrl || null,
        affiliate_link: affiliateLink || url || '',
        copy_text: copyText || '',
        status: 'scheduled',
      })
      .select('id')
      .single()

    if (offerErr) throw offerErr

    const { data: schedule, error: schedErr } = await supabaseAdmin
      .from('schedules')
      .insert({
        user_id: req.user.id,
        offer_id: offer.id,
        channels: channels || [],
        scheduled_at: scheduledAt || new Date().toISOString(),
        status: 'pending',
      })
      .select('*')
      .single()

    if (schedErr) throw schedErr

    res.json({ success: true, scheduleId: schedule.id, offerId: offer.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

export async function deleteScheduleController(req, res) {
  try {
    if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase não disponível.' })

    await supabaseAdmin
      .from('schedules')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)

    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

export async function updateScheduleTimeController(req, res) {
  const { scheduledAt } = req.body || {}
  try {
    if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase não disponível.' })

    await supabaseAdmin
      .from('schedules')
      .update({ scheduled_at: scheduledAt, status: 'pending' })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)

    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

export async function triggerDueSchedulesController(_req, res) {
  try {
    const processedCount = await runScheduler()
    res.json({ success: true, processed: processedCount || 0 })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
