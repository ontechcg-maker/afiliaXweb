import { supabaseAdmin } from '../config/supabase.js'
import { ADMIN_EMAIL, EVOLUTION_BASE_URL, EVOLUTION_API_KEY } from '../config/env.js'

export async function getAdminConfig(req, res) {
  try {
    const { data } = await supabaseAdmin.from('system_config').select('*')
    const config = (data || []).reduce((acc, item) => {
      acc[item.key] = item.value
      return acc
    }, {})
    res.json({
      evolutionBaseUrl: config.evolution_base_url || EVOLUTION_BASE_URL || '',
      evolutionApiKey: config.evolution_api_key || EVOLUTION_API_KEY || '',
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
}

export async function saveAdminConfig(req, res) {
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
}

export async function getAdminStats(_req, res) {
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
}

export async function getAdminUsers(_req, res) {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Supabase Admin não disponível no servidor.' })
    }

    let authUsers = []
    try {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (!authErr && authData?.users) {
        authUsers = authData.users
      }
    } catch (e) {
      console.error('[Admin Users] Erro ao listar auth.users:', e.message)
    }

    const { data: profiles } = await supabaseAdmin.from('profiles').select('*')
    const profilesMap = new Map((profiles || []).map((p) => [p.id, p]))
    const combinedUsers = []

    for (const authUser of authUsers) {
      let profile = profilesMap.get(authUser.id)

      if (!profile) {
        const instanceName = `usr_${authUser.id.replace(/-/g, '')}`
        const profilePayload = {
          id: authUser.id,
          email: authUser.email || '',
          instance_name: instanceName,
          instance_status: 'disconnected',
          role: authUser.email?.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'user',
          plan_tier: authUser.email?.toLowerCase() === ADMIN_EMAIL ? 'agency' : 'free',
          daily_posts_limit: authUser.email?.toLowerCase() === ADMIN_EMAIL ? 99999 : 5,
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
        role: profile?.role || (authUser.email?.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'user'),
        plan_tier: profile?.plan_tier || 'free',
        daily_posts_limit: profile?.daily_posts_limit || 5,
        is_blocked: profile?.is_blocked || false,
        created_at: authUser.created_at || profile?.created_at || new Date().toISOString(),
      })
    }

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

    combinedUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    res.json(combinedUsers)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

export async function toggleBlockUser(req, res) {
  const { userId, isBlocked } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId é obrigatório.' })

  try {
    await supabaseAdmin.from('profiles').update({ is_blocked: Boolean(isBlocked) }).eq('id', userId)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

export async function setUserRole(req, res) {
  const { userId, role } = req.body || {}
  if (!userId || !role) return res.status(400).json({ error: 'userId e role são obrigatórios.' })

  try {
    await supabaseAdmin.from('profiles').update({ role }).eq('id', userId)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

export async function setUserPlan(req, res) {
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
}
