/**
 * instagramService.js
 * Serviço backend para integração com a API Oficial da Meta (Instagram Graph API v21.0).
 */

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0'

/**
 * Valida credenciais e retorna dados da conta do Instagram Business/Creator
 */
export async function verifyInstagramAccount({ accountId, accessToken }) {
  if (!accountId || !accessToken) {
    throw new Error('ID da Conta do Instagram e Token de Acesso Meta são obrigatórios.')
  }

  const cleanAccountId = accountId.trim()
  const cleanToken = accessToken.trim()

  const url = `${GRAPH_API_BASE}/${cleanAccountId}?fields=id,username,name,profile_picture_url&access_token=${encodeURIComponent(cleanToken)}`
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))

  if (!res.ok || data.error) {
    const errorMsg = data?.error?.message || `Erro HTTP ${res.status} ao conectar com Meta Graph API.`
    throw new Error(`Meta Graph API: ${errorMsg}`)
  }

  return {
    id: data.id,
    username: data.username || data.name || 'instagram_user',
    name: data.name || data.username || 'Conta Instagram',
    profilePictureUrl: data.profile_picture_url || undefined,
  }
}

/**
 * Publica uma imagem com legenda no Feed do Instagram
 */
export async function publishInstagramFeedPost({ accountId, accessToken, imageUrl, caption }) {
  if (!accountId || !accessToken) {
    throw new Error('Conta do Instagram não configurada para este usuário.')
  }
  if (!imageUrl) {
    throw new Error('A imagem é obrigatória para postagens no Feed do Instagram.')
  }

  const cleanAccountId = accountId.trim()
  const cleanToken = accessToken.trim()

  // 1. Cria o container da mídia (POST /{account_id}/media)
  const containerUrl = `${GRAPH_API_BASE}/${cleanAccountId}/media`
  const containerRes = await fetch(containerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrl,
      caption: caption || '',
      access_token: cleanToken,
    }),
  })

  const containerData = await containerRes.json().catch(() => ({}))
  if (!containerRes.ok || containerData.error || !containerData.id) {
    const err = containerData?.error?.message || `Erro HTTP ${containerRes.status}`
    throw new Error(`Instagram Media Container: ${err}`)
  }

  const creationId = containerData.id

  // 2. Publica o container criado (POST /{account_id}/media_publish)
  const publishUrl = `${GRAPH_API_BASE}/${cleanAccountId}/media_publish`
  const publishRes = await fetch(publishUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: creationId,
      access_token: cleanToken,
    }),
  })

  const publishData = await publishRes.json().catch(() => ({}))
  if (!publishRes.ok || publishData.error || !publishData.id) {
    const err = publishData?.error?.message || `Erro HTTP ${publishRes.status}`
    throw new Error(`Instagram Publish: ${err}`)
  }

  return {
    success: true,
    mediaId: publishData.id,
  }
}
