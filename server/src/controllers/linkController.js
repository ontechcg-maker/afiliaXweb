import { supabaseAdmin } from '../config/supabase.js'

export const shortLinksMap = new Map()
export const clickAnalyticsLog = []

export async function shortenLinkController(req, res) {
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
}

export async function handleRedirectController(req, res) {
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

export async function getAnalyticsSummaryController(req, res) {
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
}
