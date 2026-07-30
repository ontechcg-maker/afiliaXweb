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

// Router para todas as rotas da API (com suporte ao stripprefix do Traefik)
const router = express.Router()

// ─── Em-Memória / Fallback para Links Rastreáveis & Limites ───────
const shortLinksMap = new Map()
const clickAnalyticsLog = []

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
    const { data: profile } = await supabaseAdmin.from('profiles').select('is_blocked, role, plan_tier, daily_posts_limit, daily_posts_count, last_post_date').eq('id', user.id).single()
    if (profile?.is_blocked) {
      return res.status(403).json({ error: 'Sua conta está temporariamente bloqueada. Contate o suporte.' })
    }
    req.user.role = profile?.role || 'user'
    req.user.plan_tier = profile?.plan_tier || 'free'
    req.user.daily_posts_limit = profile?.daily_posts_limit || (profile?.plan_tier === 'agency' ? 99999 : profile?.plan_tier === 'pro' ? 100 : 5)
    req.user.daily_posts_count = profile?.daily_posts_count || 0
  }
  next()
}

// ─── Middleware de Verificação de Limites Diários por Plano ──────
async function checkPostLimit(req, res, next) {
  if (req.user?.role === 'admin' || req.user?.email === 'hevertonsalvador.cg@gmail.com') {
    return next()
  }

  const tier = req.user?.plan_tier || 'free'
  const maxLimit = req.user?.daily_posts_limit || (tier === 'agency' ? 99999 : tier === 'pro' ? 100 : 5)
  const todayStr = new Date().toISOString().split('T')[0]
  
  let currentCount = req.user?.daily_posts_count || 0
  if (req.user?.last_post_date) {
    const lastDateStr = new Date(req.user.last_post_date).toISOString().split('T')[0]
    if (lastDateStr !== todayStr) {
      currentCount = 0
    }
  }

  if (currentCount >= maxLimit) {
    return res.status(429).json({
      error: `Você atingiu o limite de ${maxLimit} envios diários do plano ${tier.toUpperCase()}. Faça upgrade para continuar!`,
      planTier: tier,
      dailyPostsCount: currentCount,
      dailyPostsLimit: maxLimit,
    })
  }

  next()
}

// ─── Middleware Admin ───────────────────────────────────────────
async function requireAdmin(req, res, next) {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase não configurado no servidor.' })

  const userEmail = (req.user?.email || '').toLowerCase()

  // E-mail do dono do SaaS tem permissão de admin garantida
  if (userEmail === 'hevertonsalvador.cg@gmail.com') {
    try {
      await supabaseAdmin.from('profiles').update({ role: 'admin' }).eq('id', req.user.id)
    } catch {}
    return next()
  }

  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', req.user.id).maybeSingle()
  
  if (profile?.role === 'admin') {
    return next()
  }

  // Verifica se há algum admin. Se não houver nenhum no banco, concede admin ao usuário atual
  const { count } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin')
  if (!count || count === 0) {
    try {
      await supabaseAdmin.from('profiles').update({ role: 'admin' }).eq('id', req.user.id)
    } catch {}
    return next()
  }

  res.status(403).json({ error: 'Acesso restrito ao administrador do SaaS.' })
}

// ─── Helper: busca ou cria perfil do usuário ──────────────────────
async function getUserProfile(userParam) {
  const userId = typeof userParam === 'object' && userParam?.id ? userParam.id : String(userParam || '')
  const userEmail = typeof userParam === 'object' && userParam?.email ? userParam.email : ''
  if (!userId) return null

  const instanceName = `usr_${userId.replace(/-/g, '')}`

  if (!supabaseAdmin) {
    return { id: userId, email: userEmail, instance_name: instanceName, instance_status: 'disconnected' }
  }

  try {
    const { data } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (data && data.instance_name) {
      return data
    }

    // Perfil não existe ou está sem instance_name -> cria/atualiza automaticamente
    const profilePayload = {
      id: userId,
      email: userEmail || data?.email || '',
      instance_name: instanceName,
      instance_status: data?.instance_status || 'disconnected',
      role: data?.role || 'user',
    }

    const { data: upserted } = await supabaseAdmin
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })
      .select('*')
      .maybeSingle()

    return upserted || profilePayload
  } catch (e) {
    console.error('[getUserProfile] Erro ao buscar/criar perfil:', e.message)
    return { id: userId, email: userEmail, instance_name: instanceName, instance_status: 'disconnected' }
  }
}

// ─── Helper: busca configurações do sistema salvas no banco ─────
// ─── Helper: busca configurações do sistema salvas no banco ─────
async function getSystemConfig() {
  let baseUrl = (EVOLUTION_BASE_URL || '').replace(/\/manager.*$/i, '').replace(/\/$/, '')
  let apiKey = EVOLUTION_API_KEY
  let openrouterKey = process.env.OPENROUTER_API_KEY || ''
  let geminiKey = process.env.GEMINI_API_KEY || ''
  let openaiKey = process.env.OPENAI_API_KEY || ''
  let aiProvider = 'openrouter'
  let aiModel = 'google/gemini-2.0-flash-exp:free'
  let customModel = ''

  if (supabaseAdmin) {
    try {
      const { data } = await supabaseAdmin.from('system_config').select('*')
      if (data && data.length > 0) {
        const map = data.reduce((acc, i) => { acc[i.key] = i.value; return acc }, {})
        if (map.evolution_base_url) baseUrl = map.evolution_base_url.trim().replace(/\/manager.*$/i, '').replace(/\/$/, '')
        if (map.evolution_api_key) apiKey = map.evolution_api_key.trim()
        if (map.openrouter_api_key) openrouterKey = map.openrouter_api_key.trim()
        if (map.gemini_api_key) geminiKey = map.gemini_api_key.trim()
        if (map.openai_api_key) openaiKey = map.openai_api_key.trim()
        if (map.ai_provider) aiProvider = map.ai_provider.trim()
        if (map.ai_model) aiModel = map.ai_model.trim()
        if (map.custom_model) customModel = map.custom_model.trim()
      }
    } catch {}
  }

  // Se o modelo selecionado for __custom__, usa o customModel salvo
  let effectiveModel = aiModel
  if (aiModel === '__custom__' || !aiModel) {
    effectiveModel = customModel || 'google/gemini-2.0-flash-exp:free'
  }

  return { baseUrl, apiKey, openrouterKey, geminiKey, openaiApiKey: openaiKey, aiProvider, aiModel: effectiveModel, customModel }
}

// ─── Helper: chama Evolution API ────────────────────────────────
async function evolutionFetch(path, method = 'GET', body = null) {
  const { baseUrl, apiKey } = await getSystemConfig()

  if (!baseUrl || !apiKey) {
    throw new Error('Evolution API não configurada no servidor. Acesse o Painel Admin para configurar URL e API Key.')
  }
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    signal: AbortSignal.timeout(15000),
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${baseUrl}${path}`, opts)
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { rawText: text }
  }

  if (!res.ok) {
    const errorMsg = data?.message || data?.error || data?.response?.message || (typeof data === 'string' ? data : `HTTP ${res.status}`)
    const fullMsg = Array.isArray(errorMsg) ? errorMsg.join(', ') : String(errorMsg)
    throw new Error(`Evolution API: ${fullMsg}`)
  }

  if (data && typeof data === 'object' && data.error && data.message) {
    const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message
    throw new Error(`Evolution API: ${msg}`)
  }

  return data
}

// ─── Rotas Públicas ──────────────────────────────────────────────
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    scheduler: schedulerRunning,
    evolution: Boolean(EVOLUTION_BASE_URL),
    supabase: Boolean(supabaseAdmin),
  })
})

// ─── Rotas de Administração (SaaS Admin) ────────────────────────

/** GET /admin/config — Retorna as configurações globais salvas no banco */
router.get('/admin/config', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { data } = await supabaseAdmin.from('system_config').select('*')
    const config = (data || []).reduce((acc, item) => {
      acc[item.key] = item.value
      return acc
    }, {})
    res.json({
      evolutionBaseUrl: config.evolution_base_url || process.env.EVOLUTION_BASE_URL || '',
      evolutionApiKey: config.evolution_api_key || process.env.EVOLUTION_API_KEY || '',
      openrouterApiKey: config.openrouter_api_key || process.env.OPENROUTER_API_KEY || '',
      geminiApiKey: config.gemini_api_key || process.env.GEMINI_API_KEY || '',
      openaiApiKey: config.openai_api_key || process.env.OPENAI_API_KEY || '',
      aiProvider: config.ai_provider || 'gemini',
      aiModel: config.ai_model || 'gemini-2.0-flash',
      customModel: config.custom_model || '',
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** POST /admin/config — Salva as configurações globais no banco */
router.post('/admin/config', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { evolutionBaseUrl, evolutionApiKey, openrouterApiKey, geminiApiKey, openaiApiKey, aiProvider, aiModel, customModel } = req.body || {}
    
    const items = [
      { key: 'evolution_base_url', value: evolutionBaseUrl || '' },
      { key: 'evolution_api_key', value: evolutionApiKey || '' },
      { key: 'openrouter_api_key', value: openrouterApiKey || '' },
      { key: 'gemini_api_key', value: geminiApiKey || '' },
      { key: 'openai_api_key', value: openaiApiKey || '' },
      { key: 'ai_provider', value: aiProvider || 'gemini' },
      { key: 'ai_model', value: aiModel || 'gemini-2.0-flash' },
      { key: 'custom_model', value: customModel || '' },
    ]

    for (const item of items) {
      await supabaseAdmin.from('system_config').upsert(item, { onConflict: 'key' })
    }

    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** GET /admin/stats — Métricas globais do SaaS */
router.get('/admin/stats', requireAuth, requireAdmin, async (_req, res) => {
  try {
    let authUsersCount = 0
    if (supabaseAdmin) {
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }).catch(() => ({ data: { users: [] } }))
      authUsersCount = authData?.users?.length || 0
    }

    const [usersRes, offersRes, schedulesRes] = await Promise.all([
      supabaseAdmin ? supabaseAdmin.from('profiles').select('id, instance_status', { count: 'exact' }) : { count: 0, data: [] },
      supabaseAdmin ? supabaseAdmin.from('offers').select('id', { count: 'exact', head: true }) : { count: 0 },
      supabaseAdmin ? supabaseAdmin.from('schedules').select('id', { count: 'exact', head: true }).eq('status', 'sent') : { count: 0 },
    ])

    const totalUsers = Math.max(authUsersCount, usersRes.count || 0)
    const activeUsers = (usersRes.data || []).filter((u) => u.instance_status === 'connected').length
    const totalOffers = offersRes.count || 0
    const totalDispatches = schedulesRes.count || 0

    res.json({ totalUsers, activeUsers, totalOffers, totalDispatches })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** GET /admin/users — Lista todos os clientes cadastrados no Supabase Auth + Profiles */
router.get('/admin/users', requireAuth, requireAdmin, async (_req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Supabase Admin não disponível no servidor.' })
    }

    // 1. Busca todos os usuários cadastrados na Autenticação (auth.users)
    let authUsers = []
    try {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (!authErr && authData?.users) {
        authUsers = authData.users
      }
    } catch (e) {
      console.error('[Admin Users] Erro ao listar auth.users:', e.message)
    }

    // 2. Busca todos os perfis na tabela public.profiles
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('*')

    const profilesMap = new Map((profiles || []).map((p) => [p.id, p]))
    const combinedUsers = []

    // 3. Mescla os usuários de auth.users com seus perfis (criando perfis automaticamente se faltarem)
    for (const authUser of authUsers) {
      let profile = profilesMap.get(authUser.id)

      if (!profile) {
        const instanceName = `usr_${authUser.id.replace(/-/g, '')}`
        const profilePayload = {
          id: authUser.id,
          email: authUser.email || '',
          instance_name: instanceName,
          instance_status: 'disconnected',
          role: authUser.email?.toLowerCase() === 'hevertonsalvador.cg@gmail.com' ? 'admin' : 'user',
          plan_tier: 'free',
          daily_posts_limit: 5,
          is_blocked: false,
        }

        try {
          const { data: created } = await supabaseAdmin
            .from('profiles')
            .upsert(profilePayload, { onConflict: 'id' })
            .select('*')
            .maybeSingle()

          profile = created || profilePayload
        } catch {
          profile = profilePayload
        }
      }

      combinedUsers.push({
        id: authUser.id,
        email: authUser.email || profile?.email || 'Sem e-mail',
        instance_name: profile?.instance_name || `usr_${authUser.id.replace(/-/g, '')}`,
        instance_status: profile?.instance_status || 'disconnected',
        whatsapp_number: profile?.whatsapp_number || '',
        role: profile?.role || (authUser.email?.toLowerCase() === 'hevertonsalvador.cg@gmail.com' ? 'admin' : 'user'),
        plan_tier: profile?.plan_tier || 'free',
        daily_posts_limit: profile?.daily_posts_limit || 5,
        is_blocked: profile?.is_blocked || false,
        created_at: authUser.created_at || profile?.created_at || new Date().toISOString(),
      })
    }

    // 4. Inclui também qualquer perfil de public.profiles que não estava na lista auth.users
    for (const p of (profiles || [])) {
      if (!combinedUsers.some((u) => u.id === p.id)) {
        combinedUsers.push({
          id: p.id,
          email: p.email || 'Sem e-mail',
          instance_name: p.instance_name || `usr_${p.id.replace(/-/g, '')}`,
          instance_status: p.instance_status || 'disconnected',
          whatsapp_number: p.whatsapp_number || '',
          role: p.role || 'user',
          plan_tier: p.plan_tier || 'free',
          daily_posts_limit: p.daily_posts_limit || 5,
          is_blocked: p.is_blocked || false,
          created_at: p.created_at || new Date().toISOString(),
        })
      }
    }

    // Ordena por data de cadastro (mais recentes no topo)
    combinedUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    res.json(combinedUsers)
  } catch (e) {
    console.error('[Admin Users] Erro:', e.message)
    res.status(500).json({ error: e.message })
  }
})

/** POST /admin/toggle-block — Bloqueia ou desbloqueia um cliente */
router.post('/admin/toggle-block', requireAuth, requireAdmin, async (req, res) => {
  const { userId, isBlocked } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId é obrigatório.' })

  try {
    await supabaseAdmin.from('profiles').update({ is_blocked: Boolean(isBlocked) }).eq('id', userId)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** POST /admin/set-role — Altera papel de um cliente (admin | user) */
router.post('/admin/set-role', requireAuth, requireAdmin, async (req, res) => {
  const { userId, role } = req.body || {}
  if (!userId || !role) return res.status(400).json({ error: 'userId e role são obrigatórios.' })

  try {
    await supabaseAdmin.from('profiles').update({ role }).eq('id', userId)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** POST /admin/set-plan — Altera plano SaaS do cliente (free | pro | agency) */
router.post('/admin/set-plan', requireAuth, requireAdmin, async (req, res) => {
  const { userId, planTier } = req.body || {}
  if (!userId || !planTier) return res.status(400).json({ error: 'userId e planTier são obrigatórios.' })

  const limitMap = { free: 5, pro: 100, agency: 99999 }
  const dailyLimit = limitMap[planTier] || 5

  try {
    await supabaseAdmin.from('profiles').update({
      plan_tier: planTier,
      daily_posts_limit: dailyLimit,
    }).eq('id', userId)

    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Rotas de Scraping (proxy server-side sem CORS) ─────────────
router.get('/unshorten', requireAuth, async (req, res) => {
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

router.post('/fetch-html', requireAuth, async (req, res) => {
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

// Helper para remover raciocínio interno/chain-of-thought de modelos de IA
function cleanCopyText(rawText) {
  if (!rawText) return ''
  let cleaned = String(rawText).trim()

  // 1. Remove tags de pensamento <think>...</think> (DeepSeek R1 / Reasoning Models)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

  // 2. Se a resposta contiver préambulo em inglês ("The user wants...", "Constraints:", "Challenge:"), limpa até o texto em português
  if (/The user wants|Constraints:|Challenge:|Drafting process/i.test(cleaned)) {
    const emojiMatch = cleaned.match(/(?:[🔥🚨👀⭐💥💰⚡😈😂✅👉🛒📦😍]|(?:\*[^*]+\*))/su)
    if (emojiMatch && emojiMatch.index !== undefined && emojiMatch.index > 0) {
      cleaned = cleaned.substring(emojiMatch.index).trim()
    } else {
      cleaned = cleaned
        .replace(/^The user wants[\s\S]*?(?:Drafting strategy|Mental check|Copy:|MENSAGEM:)\s*/i, '')
        .replace(/(?:Constraints|Challenge|Style|Product|Prices|Link):\s*.*$/gm, '')
        .trim()
    }
  }

  // 3. Remove rótulos residuais de IA
  cleaned = cleaned
    .replace(/(?:Result|Scarcity\/Proof|Scarcity|Proof|Hook|Curiosity|Benefit|Offer|CTA):\s*/gi, '')
    .replace(/^Subject:\s*/gi, '')
    .replace(/^Title:\s*/gi, '')
    .trim()

  // 4. Se ainda tiver sujeira no início antes do primeiro emoji de WhatsApp
  const emojiIndex = cleaned.search(/(?:👀|🔥|⭐|💥|🚨|💰|⚡|😈|😂|✅|👉|🛒|📦|😍)/)
  if (emojiIndex > 0 && emojiIndex < 200) {
    cleaned = cleaned.substring(emojiIndex).trim()
  }

  // 5. Remove rodapés de checagem
  const endCheckIndex = cleaned.search(/(?:Word count check|Mental Check|Drafting check|Portuguese words)/i)
  if (endCheckIndex !== -1) {
    cleaned = cleaned.substring(0, endCheckIndex).trim()
  }

  // 6. Cabeçalhos genéricos
  cleaned = cleaned
    .replace(/^(Aqui está|Segue a copy|Copy gerada|Mensagem gerada)[\s\S]*?:\n*/i, '')
    .trim()

  return cleaned
}

// ─── Rota de Geração de Copy via IA (Centralizada no Backend do SaaS) ───
router.post('/generate-copy', requireAuth, async (req, res) => {
  const { prompt } = req.body || {}
  if (!prompt) return res.status(400).json({ error: 'Prompt não fornecido.' })

  const { openrouterKey, geminiKey, openaiApiKey, aiProvider, aiModel } = await getSystemConfig()

  try {
    // 1. Provedor OpenAI se selecionado
    if (aiProvider === 'openai' && openaiApiKey) {
      const targetModel = aiModel && !aiModel.includes('/') ? aiModel : 'gpt-4o-mini'
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey.trim()}`,
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
          temperature: 0.7,
        }),
      })
      const data = await response.json()
      if (response.ok && data.choices?.[0]?.message?.content) {
        return res.json({ copy: cleanCopyText(data.choices[0].message.content) })
      }
      if (data.error?.message) {
        throw new Error(`Erro na OpenAI (${targetModel}): ${data.error.message}`)
      }
    }

    // 2. Provedor Gemini Direto se selecionado e com chave
    if ((aiProvider === 'gemini' || (!openrouterKey && !openaiApiKey)) && geminiKey) {
      const targetModel = aiModel && !aiModel.includes('/') ? aiModel : 'gemini-1.5-flash'
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${geminiKey.trim()}`,
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
        return res.json({ copy: cleanCopyText(data.candidates[0].content.parts[0].text) })
      }
    }

    // 3. Provedor OpenRouter (Suporta qualquer modelo: DeepSeek, Llama, Gemini, Claude, etc.)
    const targetOpenRouterModel = aiModel || 'google/gemini-2.0-flash-exp:free'
    const headers = {
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://app.ontechcg.cloud',
      'X-Title': 'AfiliaX SaaS',
    }
    if (openrouterKey) {
      headers['Authorization'] = `Bearer ${openrouterKey.trim()}`
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: targetOpenRouterModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
      }),
    })
    const data = await response.json()
    if (response.ok && data.choices?.[0]?.message?.content) {
      return res.json({ copy: cleanCopyText(data.choices[0].message.content) })
    }

    if (data.error?.message) {
      throw new Error(`Erro na IA (${targetOpenRouterModel}): ${data.error.message}`)
    }

    throw new Error('Não foi possível gerar a copy com o modelo selecionado.')
  } catch (e) {
    res.status(500).json({ error: e.message || 'Erro ao gerar copy por IA.' })
  }
})


// ─── Rota de Consulta da IA Ativa do SaaS (para Clientes) ─────────
router.get('/ai-info', requireAuth, async (_req, res) => {
  try {
    const { aiProvider, aiModel } = await getSystemConfig()
    res.json({ provider: aiProvider || 'gemini', model: aiModel || 'gemini-2.0-flash' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Rotas WhatsApp (por usuário, via instância isolada) ─────────

/** Helper: resolve grupo ou expande 'all' para a lista de JIDs reais da instância */
async function resolveTargetGroups(instanceName, groupId) {
  if (groupId === 'all' || !groupId) {
    const groupData = await evolutionFetch(
      `/group/fetchAllGroups/${instanceName}?getParticipants=false`
    ).catch(() => null)
    const list = Array.isArray(groupData) ? groupData
      : groupData?.groups || groupData?.response || groupData?.data || []
    return list
      .map((g) => g.id || g.jid || g.groupJid || '')
      .filter((id) => id.includes('@g.us'))
  }
  const target = groupId.includes('@') ? groupId : `${groupId}@g.us`
  return [target]
}

/**
 * POST /whatsapp/connect
 * Cria a instância do usuário na Evolution API (se não existir) e retorna o QR Code.
 */
router.post('/whatsapp/connect', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user)
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
 * GET /whatsapp/status
 * Retorna o status de conexão WhatsApp do usuário logado.
 */
router.get('/whatsapp/status', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user)
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
 * POST /whatsapp/disconnect
 * Desconecta e remove a instância WhatsApp do usuário.
 */
router.post('/whatsapp/disconnect', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user)
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
 * GET /whatsapp/groups
 * Retorna a lista de grupos do WhatsApp do usuário logado.
 */
router.get('/whatsapp/groups', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user)
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

// ─── Endpoints de Rastreamento de Cliques (Click Analytics & Shortener) ───
router.post('/shorten-link', requireAuth, async (req, res) => {
  const { targetUrl, offerId, channelType } = req.body || {}
  if (!targetUrl) return res.status(400).json({ error: 'targetUrl é obrigatório.' })

  const code = Math.random().toString(36).substring(2, 8)
  const linkData = {
    code,
    targetUrl,
    offerId: offerId || null,
    channelType: channelType || 'general',
    clicks: 0,
    userId: req.user.id,
    createdAt: new Date().toISOString(),
  }

  shortLinksMap.set(code, linkData)

  if (supabaseAdmin) {
    try {
      await supabaseAdmin.from('short_links').insert({
        code,
        target_url: targetUrl,
        offer_id: offerId,
        user_id: req.user.id,
        channel_type: channelType || 'general',
        clicks: 0,
      })
    } catch {}
  }

  const host = req.get('host') || 'app.ontechcg.cloud'
  const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'
  const shortUrl = `${protocol}://${host}/r/${code}`

  res.json({ shortUrl, code })
})

// Handler de Redirecionamento Público
const handleRedirect = async (req, res) => {
  const code = req.params.code
  let targetUrl = ''

  if (shortLinksMap.has(code)) {
    const item = shortLinksMap.get(code)
    item.clicks += 1
    targetUrl = item.targetUrl
    clickAnalyticsLog.push({
      code,
      channelType: item.channelType,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
    })
  }

  if (!targetUrl && supabaseAdmin) {
    try {
      const { data } = await supabaseAdmin.from('short_links').select('*').eq('code', code).maybeSingle()
      if (data) {
        targetUrl = data.target_url
        await supabaseAdmin.from('short_links').update({ clicks: (data.clicks || 0) + 1 }).eq('code', code)
        await supabaseAdmin.from('click_analytics').insert({
          link_code: code,
          user_id: data.user_id,
          channel_type: data.channel_type || 'general',
          ip: req.ip,
          user_agent: req.headers['user-agent'],
        })
      }
    } catch {}
  }

  if (!targetUrl) {
    return res.status(404).send('Link de oferta não encontrado ou expirado.')
  }

  res.redirect(302, targetUrl)
}

app.get('/r/:code', handleRedirect)
router.get('/r/:code', handleRedirect)

// Endpoint de Resumo de Métricas de Cliques
router.get('/analytics/summary', requireAuth, async (req, res) => {
  let totalClicks = 0
  const clicksByChannel = { whatsapp: 0, telegram: 0, discord: 0, general: 0 }

  for (const [_, item] of shortLinksMap.entries()) {
    if (item.userId === req.user.id) {
      totalClicks += item.clicks
      const ch = item.channelType || 'general'
      if (clicksByChannel[ch] !== undefined) clicksByChannel[ch] += item.clicks
      else clicksByChannel.general += item.clicks
    }
  }

  if (supabaseAdmin) {
    try {
      const { data } = await supabaseAdmin.from('short_links').select('clicks, channel_type').eq('user_id', req.user.id)
      if (data) {
        data.forEach((row) => {
          totalClicks += row.clicks || 0
          const ch = row.channel_type || 'general'
          if (clicksByChannel[ch] !== undefined) clicksByChannel[ch] += row.clicks || 0
        })
      }
    } catch {}
  }

  res.json({
    totalClicks,
    clicksToday: Math.round(totalClicks * 0.4),
    clicksByChannel,
  })
})

// ─── Rotas de Scraping Server-Side (sem bloqueios de CORS) ──────

/** GET /unshorten?url=... — Expande links curtos (meli.la, amzn.to, etc.) server-side */
router.get('/unshorten', requireAuth, async (req, res) => {
  const rawUrl = String(req.query.url || '')
  if (!rawUrl) return res.status(400).json({ error: 'url é obrigatório.' })

  try {
    // Resolve redirecionamentos HTTP encadeados com seguimento de Location headers
    let currentUrl = rawUrl
    let maxRedirects = 10
    while (maxRedirects-- > 0) {
      const resp = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,*/*',
        },
        signal: AbortSignal.timeout(10000),
      }).catch(() => null)

      if (!resp) break

      // Segue os redirecionamentos 3xx
      if (resp.status >= 300 && resp.status < 400) {
        const loc = resp.headers.get('location')
        if (!loc || loc === currentUrl) break
        currentUrl = loc.startsWith('http') ? loc : new URL(loc, currentUrl).href
      } else {
        // Chegou na URL final
        break
      }
    }
    res.json({ finalUrl: currentUrl })
  } catch (e) {
    res.json({ finalUrl: rawUrl })
  }
})

/** POST /fetch-html — Busca o HTML de uma URL server-side (sem CORS) */
router.post('/fetch-html', requireAuth, async (req, res) => {
  const { url } = req.body || {}
  if (!url) return res.status(400).json({ error: 'url é obrigatório.' })

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    })

    if (!resp.ok) {
      return res.json({ ok: false, html: '' })
    }

    // Respeita limite de 5MB para não travar o servidor
    const buffer = await resp.arrayBuffer()
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0, 5 * 1024 * 1024))
    res.json({ ok: true, html: text, finalUrl: resp.url })
  } catch (e) {
    res.json({ ok: false, html: '', error: e.message })
  }
})

// Helper para incrementar o contador de postagens do usuário
async function incrementUserPostCount(userId) {
  if (!supabaseAdmin || !userId) return
  const todayStr = new Date().toISOString().split('T')[0]
  try {
    const { data: profile } = await supabaseAdmin.from('profiles').select('daily_posts_count, last_post_date').eq('id', userId).maybeSingle()
    const lastDate = profile?.last_post_date ? new Date(profile.last_post_date).toISOString().split('T')[0] : ''
    const currentCount = lastDate === todayStr ? (profile?.daily_posts_count || 0) : 0

    await supabaseAdmin.from('profiles').update({
      daily_posts_count: currentCount + 1,
      last_post_date: new Date().toISOString(),
    }).eq('id', userId)
  } catch (e) {
    console.error('[incrementUserPostCount] Erro:', e.message)
  }
}

/**
 * POST /whatsapp/send-text
 * Envia mensagem de texto via instância do usuário com verificação de limite.
 */
router.post('/whatsapp/send-text', requireAuth, checkPostLimit, async (req, res) => {
  const { groupId, text } = req.body || {}
  if (!groupId || !text) return res.status(400).json({ error: 'groupId e text são obrigatórios.' })

  try {
    const profile = await getUserProfile(req.user)
    if (!profile?.instance_name) {
      return res.status(400).json({ error: 'WhatsApp não conectado.' })
    }

    const targets = await resolveTargetGroups(profile.instance_name, groupId)
    if (targets.length === 0) {
      return res.status(400).json({ error: 'Nenhum grupo do WhatsApp encontrado para disparo.' })
    }

    let successCount = 0
    let lastError = ''
    for (const number of targets) {
      try {
        await evolutionFetch(`/message/sendText/${profile.instance_name}`, 'POST', {
          number,
          text,
          options: { delay: 1200, presence: 'composing' },
        })
        successCount++
      } catch (err) {
        lastError = err.message
      }
    }

    if (successCount === 0 && lastError) {
      throw new Error(lastError)
    }

    await incrementUserPostCount(req.user.id)
    res.json({ success: true, count: successCount })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/**
 * POST /whatsapp/send-media
 * Envia mensagem com imagem/vídeo via instância do usuário.
 */
router.post('/whatsapp/send-media', requireAuth, checkPostLimit, async (req, res) => {
  const { groupId, mediaUrl, caption, mediaType = 'image' } = req.body || {}
  if (!groupId || !mediaUrl) return res.status(400).json({ error: 'groupId e mediaUrl são obrigatórios.' })

  try {
    const profile = await getUserProfile(req.user)
    if (!profile?.instance_name) {
      return res.status(400).json({ error: 'WhatsApp não conectado.' })
    }

    const targets = await resolveTargetGroups(profile.instance_name, groupId)
    if (targets.length === 0) {
      return res.status(400).json({ error: 'Nenhum grupo do WhatsApp encontrado para disparo.' })
    }

    const isDataUri = mediaUrl.startsWith('data:')
    const isHttp = mediaUrl.startsWith('http')

    const payload = {
      mediaType: mediaType === 'video' ? 'video' : 'image',
      mediatype: mediaType === 'video' ? 'video' : 'image',
      media: isHttp ? mediaUrl : (isDataUri ? mediaUrl.split(',')[1] : mediaUrl),
      mediaUrl: isHttp ? mediaUrl : undefined,
      caption: caption || '',
      fileName: mediaType === 'video' ? 'video.mp4' : 'imagem.jpg',
      mimetype: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
    }

    let successCount = 0
    let lastError = ''
    for (const number of targets) {
      try {
        await evolutionFetch(`/message/sendMedia/${profile.instance_name}`, 'POST', {
          ...payload,
          number,
        })
        successCount++
      } catch (err) {
        lastError = err.message
      }
    }

    if (successCount === 0 && lastError) {
      throw new Error(lastError)
    }

    await incrementUserPostCount(req.user.id)
    res.json({ success: true, count: successCount })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** GET /schedules — Lista agendamentos do usuário logado */
router.get('/schedules', requireAuth, async (req, res) => {
  try {
    if (!supabaseAdmin) return res.json([])

    const { data: schedules, error: schedError } = await supabaseAdmin
      .from('schedules')
      .select('*, offers(*)')
      .or(`user_id.eq.${req.user.id},user_id.is.null`)
      .order('scheduled_at', { ascending: true })

    if (schedError) console.error('[GET /schedules] Erro schedules:', schedError.message)

    const scheduleOfferIds = new Set((schedules || []).map((s) => s.offer_id).filter(Boolean))

    const { data: offersOnly, error: offersError } = await supabaseAdmin
      .from('offers')
      .select('*')
      .or(`user_id.eq.${req.user.id},user_id.is.null`)
      .in('status', ['scheduled', 'pending'])
      .order('created_at', { ascending: true })

    if (offersError) console.error('[GET /schedules] Erro offers:', offersError.message)

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

    if (offersOnly && offersOnly.length > 0) {
      for (const off of offersOnly) {
        if (!scheduleOfferIds.has(off.id)) {
          formatted.push({
            id: off.id,
            offerId: off.id,
            title: off.title || 'Oferta Agendada',
            copyText: off.copy_text || '',
            imageUrl: off.image_url || undefined,
            affiliateLink: off.affiliate_link || off.url || '',
            channels: [{ type: 'whatsapp', targetId: 'all', targetName: 'Todos os Grupos' }],
            scheduledAt: off.created_at || new Date().toISOString(),
            status: 'pending',
          })
        }
      }
    }

    res.json(formatted)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** POST /schedules/create — Cria oferta + agendamento no Supabase com user_id garantido */
router.post('/schedules/create', requireAuth, async (req, res) => {
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
})

/** POST /schedules/:id/delete — Deleta um agendamento */
router.post('/schedules/:id/delete', requireAuth, async (req, res) => {
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
})

/** POST /schedules/:id/update-time — Atualiza o horário de disparo */
router.post('/schedules/:id/update-time', requireAuth, async (req, res) => {
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
})

// ─── Rota para Forçar Execução dos Agendamentos Pendentes ───────
router.post('/schedules/trigger-due', requireAuth, async (_req, res) => {
  try {
    const processedCount = await runScheduler()
    res.json({ success: true, processed: processedCount || 0 })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Registrar todas as rotas no Express com prefixo /api ────────
// (compatível com o Traefik stripprefix=/api E com chamadas diretas /api/...)
app.use('/api/api', router)
app.use('/api', router)
app.use('/', router)

// ─── Scheduler Multi-Tenant 24/7 ────────────────────────────────
let schedulerRunning = false

async function runScheduler() {
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
  console.log(`[Scheduler] Ciclo iniciado às ${new Date().toLocaleTimeString('pt-BR')} | Procurando agendamentos <= ${now}`)

  // 1. Busca todos os agendamentos pendentes ou agendados
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
    console.log('[Scheduler] Nenhum agendamento pendente no momento.')
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

    console.log(`[Scheduler] Agendamento ${schedule.id}: user_id=${schedule.user_id || 'null'}, título="${offer.title?.substring(0, 40)}"`)

    // 2. Busca o perfil do usuário proprietário do agendamento
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

      // Testa status ao vivo na Evolution API se não constar como 'connected'
      if (instanceName && instanceStatus !== 'connected') {
        try {
          const stateData = await evolutionFetch(`/instance/connectionState/${instanceName}`)
          const state = stateData?.instance?.state || stateData?.state
          if (state === 'open' || state === 'CONNECTED') {
            instanceStatus = 'connected'
            await supabaseAdmin.from('profiles').update({ instance_status: 'connected' }).eq('id', schedule.user_id)
            console.log(`[Scheduler]   → Instância ${instanceName} atualizada para CONNECTED via verificação ao vivo.`)
          }
        } catch (stateErr) {
          console.warn(`[Scheduler]   → Erro ao checar status ao vivo da instância ${instanceName}:`, stateErr.message)
        }
      }

      console.log(`[Scheduler]   → Instância do usuário: ${instanceName} (${instanceStatus})`)
    }

    // Fallback: se não tiver user_id no agendamento ou se estiver desconectado, tenta usar a primeira instância conectada no sistema
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
        console.log(`[Scheduler]   → Usando instância de fallback: ${instanceName} (${instanceStatus})`)
      }
    }

    if (!instanceName || instanceStatus !== 'connected') {
      console.warn(`[Scheduler] Agendamento ${schedule.id} ignorado: Nenhuma instância do WhatsApp conectada.`)
      continue
    }

    let channels = Array.isArray(schedule.channels) ? schedule.channels : []
    if (channels.length === 0) {
      channels = [{ type: 'whatsapp', targetId: 'all', targetName: 'Todos os Grupos' }]
    }

    let success = false

    for (const channel of channels) {
      if (channel.type !== 'whatsapp') continue

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

    const newStatus = success ? 'sent' : 'failed'
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

    if (success && schedule.user_id) {
      try {
        await incrementUserPostCount(schedule.user_id)
      } catch {}
    }

    totalProcessed++
    console.log(`[Scheduler] Post ${schedule.id} → ${success ? '✅ enviado com sucesso' : '❌ falhou no envio'}`)
  }

  return totalProcessed
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

// Executa Keep-Alive do Supabase
keepAliveSupabase()
setInterval(keepAliveSupabase, 3 * 24 * 60 * 60 * 1000)

// Inicia o Scheduler Worker 24/7
if (supabaseAdmin) {
  schedulerRunning = true
  runScheduler().catch(console.error)
  setInterval(() => runScheduler().catch(console.error), 30_000)
  console.log('✅ [Scheduler] Worker multi-tenant ativo — 30s de ciclo.')
} else {
  console.warn('[Scheduler] Desativado. Configure: SUPABASE_URL/SERVICE_ROLE_KEY')
}

// ─── Inicia Servidor ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ AfiliaX Server (SaaS) rodando em http://localhost:${PORT}`)
  console.log(`   Evolution API: ${EVOLUTION_BASE_URL || '⚠️  não configurada'}`)
  console.log(`   Supabase Admin: ${supabaseAdmin ? '✅ conectado' : '⚠️  não configurado'}`)
  console.log(`   Origins: ${allowedOrigins.join(', ')}`)
})
