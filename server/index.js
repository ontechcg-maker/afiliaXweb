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
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase não configurado.' })

  // E-mail do dono do SaaS tem permissão de admin garantida
  if (req.user?.email === 'hevertonsalvador.cg@gmail.com') {
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
  try { return JSON.parse(text) } catch { return { rawText: text } }
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

/** GET /admin/users — Lista todos os clientes */
router.get('/admin/users', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, instance_name, instance_status, whatsapp_number, role, plan_tier, daily_posts_limit, is_blocked, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(users || [])
  } catch (e) {
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
          number, text, options: { delay: 1200, presence: 'composing' },
        })
        successCount++
      } catch (err) {
        lastError = err.message
      }
    }

    if (successCount === 0 && lastError) {
      throw new Error(lastError)
    }

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
      mediatype: mediaType,
      mediaUrl: isHttp ? mediaUrl : undefined,
      media: isDataUri ? mediaUrl.split(',')[1] : undefined,
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

    res.json({ success: true, count: successCount })
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
            const isDataUri = offer.image_url.startsWith('data:')
            const isHttp = offer.image_url.startsWith('http')
            await evolutionFetch(`/message/sendMedia/${instanceName}`, 'POST', {
              number: target,
              mediatype: 'image',
              mediaUrl: isHttp ? offer.image_url : undefined,
              media: isDataUri ? offer.image_url.split(',')[1] : undefined,
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
