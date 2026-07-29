import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })

// ─── Configuração ────────────────────────────────────────────────
const PORT = process.env.PORT || 3001
const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const EVOLUTION_BASE_URL = (process.env.EVOLUTION_BASE_URL || '').trim().replace(/\/$/, '')
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || ''

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',').map((o) => o.trim())

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// ─── Supabase Clients ────────────────────────────────────────────
let supabaseAnon = null
let supabaseAdmin = null

try {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
} catch (e) {
  console.error('[Supabase Anon Client] Erro de inicialização:', e.message)
}

try {
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
} catch (e) {
  console.error('[Supabase Admin Client] Erro de inicialização:', e.message)
}

// ─── App Express ─────────────────────────────────────────────────
const app = express()
app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json({ limit: '10mb' }))

// ─── Middleware de Autenticação (Supabase JWT) ───────────────────
async function requireAuth(req, res, next) {
  if (!supabaseAnon) {
    return res.status(503).json({ error: 'Supabase não configurado no servidor.' })
  }
  const authHeader = req.headers['authorization']
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Token não fornecido.' })

  const { data: { user }, error } = await supabaseAnon.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Token inválido ou expirado.' })

  req.user = user

  // Verifica se o usuário está bloqueado
  if (supabaseAdmin) {
    const { data: profile } = await supabaseAdmin.from('profiles').select('is_blocked, role').eq('id', user.id).single()
    if (profile?.is_blocked) {
      return res.status(403).json({ error: 'Sua conta está temporariamente bloqueada. Contate o suporte.' })
    }
    req.user.role = profile?.role || 'user'
  }
  next()
}

// ─── Middleware Admin ───────────────────────────────────────────
async function requireAdmin(req, res, next) {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase não configurado.' })
  
  // O primeiro usuário cadastrado no sistema vira Admin automaticamente se nenhum for admin ainda
  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', req.user.id).single()
  
  if (profile?.role === 'admin') {
    return next()
  }

  // Verifica se há algum admin. Se não houver nenhum no banco, concede admin ao usuário atual
  const { count } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin')
  if (count === 0) {
    await supabaseAdmin.from('profiles').update({ role: 'admin' }).eq('id', req.user.id)
    return next()
  }

  res.status(403).json({ error: 'Acesso restrito ao administrador do SaaS.' })
}

// ─── Helper: busca perfil do usuário ────────────────────────────
async function getUserProfile(userId) {
  if (!supabaseAdmin) return null
  const { data } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single()
  return data
}

// ─── Helper: chama Evolution API ────────────────────────────────
async function evolutionFetch(path, method = 'GET', body = null) {
  if (!EVOLUTION_BASE_URL || !EVOLUTION_API_KEY) {
    throw new Error('Evolution API não configurada no servidor.')
  }
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
    signal: AbortSignal.timeout(15000),
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${EVOLUTION_BASE_URL}${path}`, opts)
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { rawText: text } }
}

// ─── Rotas Públicas ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    scheduler: schedulerRunning,
    evolution: Boolean(EVOLUTION_BASE_URL),
    supabase: Boolean(supabaseAdmin),
  })
})

// ─── Rotas de Administração (SaaS Admin) ────────────────────────

/** GET /api/admin/stats — Métricas globais do SaaS */
app.get('/api/admin/stats', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [usersRes, offersRes, schedulesRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, instance_status', { count: 'exact' }),
      supabaseAdmin.from('offers').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('schedules').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
    ])

    const totalUsers = usersRes.count || 0
    const activeUsers = (usersRes.data || []).filter((u) => u.instance_status === 'connected').length
    const totalOffers = offersRes.count || 0
    const totalDispatches = schedulesRes.count || 0

    res.json({ totalUsers, activeUsers, totalOffers, totalDispatches })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** GET /api/admin/users — Lista todos os clientes */
app.get('/api/admin/users', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, instance_name, instance_status, whatsapp_number, role, is_blocked, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(users || [])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** POST /api/admin/toggle-block — Bloqueia ou desbloqueia um cliente */
app.post('/api/admin/toggle-block', requireAuth, requireAdmin, async (req, res) => {
  const { userId, isBlocked } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId é obrigatório.' })

  try {
    await supabaseAdmin.from('profiles').update({ is_blocked: Boolean(isBlocked) }).eq('id', userId)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** POST /api/admin/set-role — Altera papel de um cliente (admin | user) */
app.post('/api/admin/set-role', requireAuth, requireAdmin, async (req, res) => {
  const { userId, role } = req.body || {}
  if (!userId || !role) return res.status(400).json({ error: 'userId e role são obrigatórios.' })

  try {
    await supabaseAdmin.from('profiles').update({ role }).eq('id', userId)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Rotas de Scraping (proxy server-side sem CORS) ─────────────
app.get('/api/unshorten', requireAuth, async (req, res) => {
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'Parâmetro url é obrigatório.' })
  try {
    const response = await fetch(String(url), {
      method: 'GET', redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    })
    res.json({ finalUrl: response.url || url })
  } catch {
    res.json({ finalUrl: url })
  }
})

app.post('/api/fetch-html', requireAuth, async (req, res) => {
  const { url } = req.body || {}
  if (!url) return res.status(400).json({ error: 'Campo url é obrigatório.' })
  try {
    const response = await fetch(String(url), {
      method: 'GET', redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
      },
      signal: AbortSignal.timeout(12000),
    })
    if (response.ok) {
      const html = await response.text()
      return res.json({ ok: true, url: response.url, html })
    }
    res.json({ ok: false, url, html: '' })
  } catch {
    res.json({ ok: false, url, html: '' })
  }
})

// ─── Rota de Geração de Copy via IA (Centralizada no Backend do SaaS) ───
app.post('/api/generate-copy', requireAuth, async (req, res) => {
  const { prompt } = req.body || {}
  if (!prompt) return res.status(400).json({ error: 'Prompt não fornecido.' })

  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || ''
  const GEMINI_KEY = process.env.GEMINI_API_KEY || ''

  try {
    // 1. Tenta OpenRouter se configurado no servidor
    if (OPENROUTER_KEY) {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENROUTER_KEY.trim()}`,
          'HTTP-Referer': 'https://app.ontechcg.cloud',
          'X-Title': 'AfiliaX SaaS',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-exp:free',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
          temperature: 0.7,
        }),
      })
      const data = await response.json()
      if (response.ok && data.choices?.[0]?.message?.content) {
        return res.json({ copy: data.choices[0].message.content })
      }
    }

    // 2. Tenta Gemini se configurado no servidor
    if (GEMINI_KEY) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
          }),
        }
      )
      const data = await response.json()
      if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return res.json({ copy: data.candidates[0].content.parts[0].text })
      }
    }

    // 3. Fallback: Usa OpenRouter público gratuito
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://app.ontechcg.cloud',
        'X-Title': 'AfiliaX SaaS',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
      }),
    })
    const data = await response.json()
    if (response.ok && data.choices?.[0]?.message?.content) {
      return res.json({ copy: data.choices[0].message.content })
    }

    throw new Error('Não foi possível gerar a copy. Configure OPENROUTER_API_KEY ou GEMINI_API_KEY nas variáveis do backend.')
  } catch (e) {
    res.status(500).json({ error: e.message || 'Erro ao gerar copy por IA.' })
  }
})

// ─── Rotas WhatsApp (por usuário, via instância isolada) ─────────

/**
 * POST /api/whatsapp/connect
 * Cria a instância do usuário na Evolution API (se não existir) e retorna o QR Code.
 */
app.post('/api/whatsapp/connect', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id)
    if (!profile?.instance_name) {
      return res.status(400).json({ error: 'Perfil de usuário não encontrado.' })
    }
    const { instance_name } = profile

    // Cria a instância (ignora erro se já existir)
    await evolutionFetch('/instance/create', 'POST', {
      instanceName: instance_name,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    }).catch(() => {})

    // Busca o QR Code
    const qrData = await evolutionFetch(`/instance/connect/${instance_name}`)
    const qrCode = qrData?.base64 || qrData?.qrcode?.base64 || qrData?.code || ''

    // Atualiza status no perfil
    if (supabaseAdmin) {
      await supabaseAdmin.from('profiles')
        .update({ instance_status: 'connecting' })
        .eq('id', req.user.id)
    }

    res.json({ qrCode, instanceName: instance_name })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Erro ao criar instância.' })
  }
})

/**
 * GET /api/whatsapp/status
 * Retorna o status de conexão WhatsApp do usuário logado.
 */
app.get('/api/whatsapp/status', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id)
    if (!profile?.instance_name) {
      return res.json({ connected: false, instanceName: null })
    }
    const { instance_name } = profile

    const data = await evolutionFetch(`/instance/connectionState/${instance_name}`)
    const state = data?.instance?.state || data?.state
    const connected = state === 'open' || state === 'CONNECTED'
    const whatsappNumber = data?.instance?.profileName || data?.profileName || ''

    // Sincroniza status no perfil
    if (supabaseAdmin) {
      await supabaseAdmin.from('profiles')
        .update({
          instance_status: connected ? 'connected' : 'disconnected',
          whatsapp_number: connected ? whatsappNumber : null,
        })
        .eq('id', req.user.id)
    }

    res.json({ connected, instanceName: instance_name, whatsappNumber })
  } catch {
    res.json({ connected: false, instanceName: null })
  }
})

/**
 * POST /api/whatsapp/disconnect
 * Desconecta e remove a instância WhatsApp do usuário.
 */
app.post('/api/whatsapp/disconnect', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id)
    if (!profile?.instance_name) return res.json({ success: true })

    await evolutionFetch(`/instance/logout/${profile.instance_name}`, 'DELETE').catch(() => {})

    if (supabaseAdmin) {
      await supabaseAdmin.from('profiles')
        .update({ instance_status: 'disconnected', whatsapp_number: null })
        .eq('id', req.user.id)
    }
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/**
 * GET /api/whatsapp/groups
 * Retorna a lista de grupos do WhatsApp do usuário logado.
 */
app.get('/api/whatsapp/groups', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id)
    if (!profile?.instance_name) return res.json([])

    const data = await evolutionFetch(
      `/group/fetchAllGroups/${profile.instance_name}?getParticipants=false`
    )

    const list = Array.isArray(data) ? data
      : data?.groups || data?.response || data?.data || []

    const groups = list
      .filter((g) => g && typeof g === 'object')
      .map((g) => ({
        id: g.id || g.jid || g.groupJid || '',
        name: g.subject || g.name || g.groupName || 'Grupo sem nome',
        memberCount: g.size || (Array.isArray(g.participants) ? g.participants.length : 0),
        isAdmin: g.owner === true || g.isAdmin === true || !!g.isOwner,
      }))
      .filter((g) => g.id.includes('@g.us') && g.name.trim().length > 0)

    res.json(groups)
  } catch {
    res.json([])
  }
})

/**
 * POST /api/whatsapp/send-text
 * Envia mensagem de texto via instância do usuário.
 */
app.post('/api/whatsapp/send-text', requireAuth, async (req, res) => {
  const { groupId, text } = req.body || {}
  if (!groupId || !text) return res.status(400).json({ error: 'groupId e text são obrigatórios.' })

  try {
    const profile = await getUserProfile(req.user.id)
    if (!profile?.instance_name) {
      return res.status(400).json({ error: 'WhatsApp não conectado.' })
    }
    const number = groupId.includes('@') ? groupId : `${groupId}@g.us`
    await evolutionFetch(`/message/sendText/${profile.instance_name}`, 'POST', {
      number, text, options: { delay: 1200, presence: 'composing' },
    })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/**
 * POST /api/whatsapp/send-media
 * Envia mensagem com imagem/vídeo via instância do usuário.
 */
app.post('/api/whatsapp/send-media', requireAuth, async (req, res) => {
  const { groupId, mediaUrl, caption, mediaType = 'image' } = req.body || {}
  if (!groupId || !mediaUrl) return res.status(400).json({ error: 'groupId e mediaUrl são obrigatórios.' })

  try {
    const profile = await getUserProfile(req.user.id)
    if (!profile?.instance_name) {
      return res.status(400).json({ error: 'WhatsApp não conectado.' })
    }
    const number = groupId.includes('@') ? groupId : `${groupId}@g.us`
    await evolutionFetch(`/message/sendMedia/${profile.instance_name}`, 'POST', {
      number,
      mediatype: mediaType,
      mediaUrl: mediaUrl.startsWith('http') ? mediaUrl : undefined,
      media: mediaUrl.startsWith('data:') ? mediaUrl.split(',')[1] : undefined,
      caption: caption || '',
      fileName: mediaType === 'video' ? 'video.mp4' : 'imagem.jpg',
      mimetype: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
    })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Scheduler Multi-Tenant 24/7 ────────────────────────────────
let schedulerRunning = false

async function runScheduler() {
  if (!supabaseAdmin || !EVOLUTION_BASE_URL) return

  const now = new Date().toISOString()

  // Busca todos os schedules pendentes com dados da oferta e perfil do usuário
  const { data: duePosts, error } = await supabaseAdmin
    .from('schedules')
    .select('*, offers(*), profiles!inner(instance_name, instance_status)')
    .eq('status', 'pending')
    .lte('scheduled_at', now)

  if (error || !duePosts || duePosts.length === 0) return

  console.log(`[Scheduler] Processando ${duePosts.length} post(s)...`)

  for (const schedule of duePosts) {
    const offer = schedule.offers
    const instanceName = schedule.profiles?.instance_name
    if (!offer || !instanceName) continue

    if (schedule.profiles?.instance_status !== 'connected') {
      // Instância desconectada — pula mas não falha
      continue
    }

    const channels = Array.isArray(schedule.channels) ? schedule.channels : []
    let success = false

    for (const channel of channels) {
      if (channel.type !== 'whatsapp') continue

      let targetIds = []
      if (channel.targetId === 'all') {
        const groupData = await evolutionFetch(
          `/group/fetchAllGroups/${instanceName}?getParticipants=false`
        ).catch(() => null)
        const list = Array.isArray(groupData) ? groupData
          : groupData?.groups || groupData?.response || []
        targetIds = list.map((g) => g.id || g.jid || '').filter((id) => id.includes('@g.us'))
      } else {
        targetIds = [channel.targetId]
      }

      for (const rawTarget of targetIds) {
        if (!rawTarget || rawTarget.startsWith('cms')) continue
        const target = rawTarget.includes('@') ? rawTarget : `${rawTarget}@g.us`
        try {
          if (offer.image_url) {
            await evolutionFetch(`/message/sendMedia/${instanceName}`, 'POST', {
              number: target,
              mediatype: 'image',
              mediaUrl: offer.image_url,
              caption: offer.copy_text || '',
              fileName: 'imagem.jpg',
              mimetype: 'image/jpeg',
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
          console.error(`[Scheduler] Erro envio para ${target}:`, e.message)
        }
      }
    }

    await supabaseAdmin
      .from('schedules')
      .update({ status: success ? 'sent' : 'failed', sent_at: new Date().toISOString() })
      .eq('id', schedule.id)

    console.log(`[Scheduler] Post ${schedule.id} → ${success ? '✅ sent' : '❌ failed'}`)
  }
}

// ─── Keep-Alive do Supabase (Impede que o projeto entre em Pause) ───
async function keepAliveSupabase() {
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

// Executa Keep-Alive imediatamente e depois a cada 3 dias (3 * 24 * 60 * 60 * 1000 ms)
keepAliveSupabase()
setInterval(keepAliveSupabase, 3 * 24 * 60 * 60 * 1000)

// Inicia o Scheduler
if (supabaseAdmin && EVOLUTION_BASE_URL) {
  schedulerRunning = true
  runScheduler().catch(console.error)
  setInterval(() => runScheduler().catch(console.error), 30_000)
  console.log('[Scheduler] Worker multi-tenant ativo — 30s de ciclo.')
} else {
  const missing = []
  if (!supabaseAdmin) missing.push('SUPABASE_URL/SERVICE_ROLE_KEY')
  if (!EVOLUTION_BASE_URL) missing.push('EVOLUTION_BASE_URL')
  console.warn(`[Scheduler] Desativado. Configure: ${missing.join(', ')}`)
}

// ─── Inicia Servidor ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ AfiliaX Server (SaaS) rodando em http://localhost:${PORT}`)
  console.log(`   Evolution API: ${EVOLUTION_BASE_URL || '⚠️  não configurada'}`)
  console.log(`   Supabase Admin: ${supabaseAdmin ? '✅ conectado' : '⚠️  não configurado'}`)
  console.log(`   Origins: ${allowedOrigins.join(', ')}`)
})
