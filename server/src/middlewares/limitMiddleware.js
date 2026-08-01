import { ADMIN_EMAIL } from '../config/env.js'
import { supabaseAdmin } from '../config/supabase.js'

export async function checkPostLimit(req, res, next) {
  if (req.user?.role === 'admin' || req.user?.email?.toLowerCase() === ADMIN_EMAIL) {
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

export async function incrementUserPostCount(userId) {
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
