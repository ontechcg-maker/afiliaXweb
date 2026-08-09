import { supabaseAdmin } from '../config/supabase.js'
import { getUserProfile } from '../middlewares/authMiddleware.js'
import { verifyInstagramAccount, publishInstagramFeedPost } from '../services/instagramService.js'

export async function connectInstagramController(req, res) {
  const { accountId, accessToken } = req.body || {}
  if (!accountId || !accessToken) {
    return res.status(400).json({ error: 'Instagram Account ID e Meta Access Token são obrigatórios.' })
  }

  try {
    const verified = await verifyInstagramAccount({ accountId, accessToken })

    if (supabaseAdmin) {
      await supabaseAdmin.from('profiles').update({
        instagram_connected: true,
        instagram_account_id: verified.id,
        instagram_access_token: accessToken.trim(),
        instagram_username: verified.username,
      }).eq('id', req.user.id)
    }

    res.json({
      success: true,
      account: verified,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

export async function getInstagramStatusController(req, res) {
  try {
    const profile = await getUserProfile(req.user)
    if (!profile) {
      return res.json({ connected: false })
    }

    res.json({
      connected: !!profile.instagram_connected,
      username: profile.instagram_username || null,
      accountId: profile.instagram_account_id || null,
    })
  } catch {
    res.json({ connected: false })
  }
}

export async function disconnectInstagramController(req, res) {
  try {
    if (supabaseAdmin) {
      await supabaseAdmin.from('profiles').update({
        instagram_connected: false,
        instagram_account_id: null,
        instagram_access_token: null,
        instagram_username: null,
      }).eq('id', req.user.id)
    }
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

export async function sendInstagramPostController(req, res) {
  const { imageUrl, caption } = req.body || {}
  if (!imageUrl) {
    return res.status(400).json({ error: 'A URL da imagem é obrigatória para envio ao Instagram.' })
  }

  try {
    const profile = await getUserProfile(req.user)
    if (!profile || !profile.instagram_connected || !profile.instagram_access_token) {
      return res.status(400).json({ error: 'Instagram não conectado neste perfil.' })
    }

    const result = await publishInstagramFeedPost({
      accountId: profile.instagram_account_id,
      accessToken: profile.instagram_access_token,
      imageUrl,
      caption: caption || '',
    })

    res.json({ success: true, mediaId: result.mediaId })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
