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

  let cleanAccountId = accountId.trim()
  const cleanToken = accessToken.trim()

  // Pré-validação rápida do formato do token
  if (!cleanToken.startsWith('EAA') || cleanToken.length < 40) {
    if (cleanToken.startsWith('IGAA') || cleanToken.startsWith('IGQV')) {
      throw new Error(
        'Você gerou um Token de Acesso do Instagram (iniciado por "IGAA..."). Para publicar posts via API Oficial da Meta, você deve gerar um User/Page Access Token da Meta Graph API (que começa com "EAA...").'
      )
    }
    throw new Error(
      'Token de Acesso Meta inválido. Os Tokens de Acesso da Meta Graph API começam obrigatoriamente com "EAA...".'
    )
  }

  // 1. Se o ID informado for 'me' ou não for numérico, tenta buscar a conta via /me/accounts
  if (cleanAccountId.toLowerCase() === 'me' || !/^\d+$/.test(cleanAccountId)) {
    try {
      const meUrl = `${GRAPH_API_BASE}/me/accounts?fields=id,name,instagram_business_account&access_token=${encodeURIComponent(cleanToken)}`
      const meRes = await fetch(meUrl)
      const meData = await meRes.json().catch(() => ({}))

      if (meData?.data && Array.isArray(meData.data) && meData.data.length > 0) {
        const found = meData.data.find((acc) => acc.instagram_business_account?.id)
        if (found?.instagram_business_account?.id) {
          cleanAccountId = found.instagram_business_account.id
        }
      }
    } catch {}
  }

  if (!/^\d+$/.test(cleanAccountId)) {
    throw new Error(`O "Instagram Account ID" deve ser o ID numérico da sua conta do Instagram Business (ex: 17841400000000000) ou simplesmente digite "me". O texto "${accountId}" não é um ID numérico válido.`)
  }

  // 2. Tenta buscar diretamente os campos id,username,name (sem profile_picture_url para evitar erro #100 da Meta)
  let url = `${GRAPH_API_BASE}/${cleanAccountId}?fields=id,username,name&access_token=${encodeURIComponent(cleanToken)}`
  let res = await fetch(url)
  let data = await res.json().catch(() => ({}))

  // 3. Se deu erro ou se o ID informado era uma Página do Facebook, busca a instagram_business_account vinculada a ela
  if (!res.ok || !data.username) {
    try {
      const pageUrl = `${GRAPH_API_BASE}/${cleanAccountId}?fields=id,name,instagram_business_account&access_token=${encodeURIComponent(cleanToken)}`
      const pageRes = await fetch(pageUrl)
      const pageData = await pageRes.json().catch(() => ({}))

      if (pageData?.instagram_business_account?.id) {
        cleanAccountId = pageData.instagram_business_account.id
        url = `${GRAPH_API_BASE}/${cleanAccountId}?fields=id,username,name&access_token=${encodeURIComponent(cleanToken)}`
        res = await fetch(url)
        data = await res.json().catch(() => ({}))
      }
    } catch {}
  }

  if (!res.ok || data.error) {
    let errorMsg = data?.error?.message || `Erro HTTP ${res.status} ao conectar com Meta Graph API.`
    if (errorMsg.includes('Cannot parse access token') || errorMsg.includes('Invalid OAuth access token')) {
      errorMsg = 'Token de Acesso da Meta inválido ou malformatado. Certifique-se de que copiou o User ou Page Access Token gerado no Meta for Developers (iniciando com "EAA...").'
    }
    throw new Error(`Meta Graph API: ${errorMsg}`)
  }

  return {
    id: data.id,
    username: data.username || data.name || 'instagram_user',
    name: data.name || data.username || 'Conta Instagram',
    profilePictureUrl: undefined,
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

  // Tratamento de URL de imagem: Imagens da Shopee (cf.shopee.com.br) possuem proteção anti-hotlink do Cloudflare
  // que bloqueiam o bot da Meta (code 36003). Usamos o proxy de imagem para a Meta conseguir baixar.
  let targetImageUrl = imageUrl.trim()
  if (targetImageUrl.includes('shopee.com') || targetImageUrl.includes('cf.shopee') || targetImageUrl.includes('shope.ee')) {
    targetImageUrl = `https://images.weserv.nl/?url=${encodeURIComponent(targetImageUrl)}`
  }

  // 1. Cria o container da mídia (POST /{account_id}/media)
  const containerUrl = `${GRAPH_API_BASE}/${cleanAccountId}/media`
  let containerRes = await fetch(containerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: targetImageUrl,
      caption: caption || '',
      access_token: cleanToken,
    }),
  })

  let containerData = await containerRes.json().catch(() => ({}))

  // Fallback automático: Se falhou na busca da imagem pela Meta (code 36003 / Error fetching image), tenta novamente via proxy
  if (
    (!containerRes.ok || containerData.error) &&
    !targetImageUrl.includes('weserv.nl')
  ) {
    const fallbackUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl.trim())}`
    containerRes = await fetch(containerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: fallbackUrl,
        caption: caption || '',
        access_token: cleanToken,
      }),
    })
    containerData = await containerRes.json().catch(() => ({}))
  }

  if (!containerRes.ok || containerData.error || !containerData.id) {
    let err = containerData?.error?.message || `Erro HTTP ${containerRes.status}`
    if (err.includes('Session has expired') || err.includes('Error validating access token') || err.includes('Invalid OAuth access token')) {
      err = 'O Token de Acesso da Meta expirou. Por favor, vá em Redes Sociais / Grupos e gerencie sua conexão com o Instagram informando um novo Meta Access Token.'
    }
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
    let err = publishData?.error?.message || `Erro HTTP ${publishRes.status}`
    if (err.includes('Session has expired') || err.includes('Error validating access token') || err.includes('Invalid OAuth access token')) {
      err = 'O Token de Acesso da Meta expirou. Por favor, vá em Redes Sociais / Grupos e gerencie sua conexão com o Instagram informando um novo Meta Access Token.'
    }
    throw new Error(`Instagram Publish: ${err}`)
  }

  return {
    success: true,
    mediaId: publishData.id,
  }
}
