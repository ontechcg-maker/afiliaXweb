import { supabaseAnon, supabaseAdmin } from '../config/supabase.js'
import { ADMIN_EMAIL } from '../config/env.js'

export async function requireAuth(req, res, next) {
  if (!supabaseAnon) {
    return res.status(503).json({ error: 'Supabase não configurado no servidor.' })
  }
  const authHeader = req.headers['authorization']
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Token não fornecido.' })

  const { data: { user }, error } = await supabaseAnon.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Token inválido ou expirado.' })

  req.user = user

  if (supabaseAdmin) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_blocked, role, plan_tier, daily_posts_limit, daily_posts_count, last_post_date')
      .eq('id', user.id)
      .single()

    if (profile?.is_blocked) {
      return res.status(403).json({ error: 'Sua conta está temporariamente bloqueada. Contate o suporte.' })
    }
    req.user.role = profile?.role || (user.email?.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'user')
    req.user.plan_tier = profile?.plan_tier || (user.email?.toLowerCase() === ADMIN_EMAIL ? 'agency' : 'free')
    req.user.daily_posts_limit = profile?.daily_posts_limit || (req.user.plan_tier === 'agency' ? 99999 : req.user.plan_tier === 'pro' ? 100 : 5)
    req.user.daily_posts_count = profile?.daily_posts_count || 0
  }
  next()
}

export async function requireAdmin(req, res, next) {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase não configurado no servidor.' })

  const userEmail = (req.user?.email || '').toLowerCase()

  if (userEmail === ADMIN_EMAIL) {
    try {
      await supabaseAdmin.from('profiles').update({ role: 'admin' }).eq('id', req.user.id)
    } catch {}
    return next()
  }

  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', req.user.id).maybeSingle()
  
  if (profile?.role === 'admin') {
    return next()
  }

  const { count } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin')
  if (!count || count === 0) {
    try {
      await supabaseAdmin.from('profiles').update({ role: 'admin' }).eq('id', req.user.id)
    } catch {}
    return next()
  }

  res.status(403).json({ error: 'Acesso restrito ao administrador do SaaS.' })
}

export async function getUserProfile(userParam) {
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

    const profilePayload = {
      id: userId,
      email: userEmail || data?.email || '',
      instance_name: instanceName,
      instance_status: data?.instance_status || 'disconnected',
      role: userEmail.toLowerCase() === ADMIN_EMAIL ? 'admin' : (data?.role || 'user'),
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
