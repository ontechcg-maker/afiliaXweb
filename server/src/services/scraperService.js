import { USER_AGENT } from '../config/env.js'

export async function unshortenUrlService(rawUrl) {
  if (!rawUrl) return rawUrl
  try {
    const resp = await fetch(rawUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'pt-BR,pt;q=0.9',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(12000),
    }).catch(() => null)

    return resp?.url || rawUrl
  } catch {
    return rawUrl
  }
}

export async function scrapeMercadoLivreService(url) {
  let finalUrl = url
  try {
    const redirectRes = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'pt-BR,pt;q=0.9',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(12000),
    }).catch(() => null)

    if (redirectRes?.url) {
      finalUrl = redirectRes.url
    }
  } catch {}

  const match = finalUrl.match(/(MLB-?\d{8,14})/i) || url.match(/(MLB-?\d{8,14})/i)
  if (!match) {
    throw new Error('Não foi possível extrair o ID (MLB) do item Mercado Livre.')
  }

  const itemId = match[1].replace('-', '').toUpperCase()

  const itemApiRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null)

  if (itemApiRes && itemApiRes.ok) {
    const data = await itemApiRes.json()

    if (data && !data.error && data.status !== 404) {
      let title = (data.title || data.name || '').trim()
      let priceTo = data.price || data.base_price
      let priceFrom = data.original_price

      let imageUrl = null
      if (Array.isArray(data.pictures) && data.pictures.length > 0) {
        imageUrl = data.pictures[0].secure_url || data.pictures[0].url
      } else if (data.thumbnail) {
        imageUrl = data.thumbnail
      }

      if (imageUrl) {
        if (imageUrl.startsWith('http:')) imageUrl = imageUrl.replace('http:', 'https:')
        if (imageUrl.includes('-I.jpg')) imageUrl = imageUrl.replace('-I.jpg', '-F.jpg')
        if (imageUrl.includes('-I.png')) imageUrl = imageUrl.replace('-I.png', '-F.png')
      }

      if (priceFrom && priceTo && Number(priceFrom) <= Number(priceTo)) {
        priceFrom = undefined
      }

      let discountPct = undefined
      if (priceFrom && priceTo && Number(priceFrom) > Number(priceTo)) {
        discountPct = Math.round(((Number(priceFrom) - Number(priceTo)) / Number(priceFrom)) * 100)
      }

      if (title) {
        return {
          ok: true,
          title,
          priceTo: priceTo ? Number(priceTo) : undefined,
          priceFrom: priceFrom ? Number(priceFrom) : undefined,
          discountPct,
          imageUrl: imageUrl || undefined,
          itemId,
          finalUrl,
          permalink: data.permalink || finalUrl,
          platform: 'mercadolivre',
        }
      }
    }
  }

  const prodApiRes = await fetch(`https://api.mercadolibre.com/products/${itemId}`, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null)

  if (prodApiRes && prodApiRes.ok) {
    const prodData = await prodApiRes.json()
    let title = (prodData.name || prodData.title || '').trim()
    let priceTo = prodData.buy_box_winner?.price || prodData.price
    let priceFrom = prodData.buy_box_winner?.original_price || prodData.original_price
    let imageUrl = null

    if (Array.isArray(prodData.pictures) && prodData.pictures.length > 0) {
      imageUrl = prodData.pictures[0].secure_url || prodData.pictures[0].url
    }

    if (imageUrl) {
      if (imageUrl.startsWith('http:')) imageUrl = imageUrl.replace('http:', 'https:')
      if (imageUrl.includes('-I.jpg')) imageUrl = imageUrl.replace('-I.jpg', '-F.jpg')
    }

    if (priceFrom && priceTo && Number(priceFrom) <= Number(priceTo)) {
      priceFrom = undefined
    }

    let discountPct = undefined
    if (priceFrom && priceTo && Number(priceFrom) > Number(priceTo)) {
      discountPct = Math.round(((Number(priceFrom) - Number(priceTo)) / Number(priceFrom)) * 100)
    }

    return {
      ok: true,
      title,
      priceTo: priceTo ? Number(priceTo) : undefined,
      priceFrom: priceFrom ? Number(priceFrom) : undefined,
      discountPct,
      imageUrl: imageUrl || undefined,
      itemId,
      finalUrl,
      platform: 'mercadolivre',
    }
  }

  throw new Error('Item não encontrado na API pública do Mercado Livre.')
}

export async function fetchHtmlService(url) {
  const isShopee = url.includes('shopee') || url.includes('shope.ee')
  const isMagalu = url.includes('magazineluiza') || url.includes('magalu') || url.includes('mglu') || url.includes('onelink.me') || url.includes('magazinevoce') || url.includes('divulgador.magalu')

  let targetUrl = url
  let userAgent = USER_AGENT

  if (isShopee) {
    userAgent = 'WhatsApp/2.23.23.84 i'
  } else if (isMagalu) {
    userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1'

    try {
      const redirectRes = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(8000),
      })
      const loc = redirectRes.headers.get('location')
      if (loc) targetUrl = loc
    } catch {}

    if (targetUrl.includes('www.magazineluiza.com.br')) {
      targetUrl = targetUrl.replace('www.magazineluiza.com.br', 'm.magazineluiza.com.br')
    }
  }

  const resp = await fetch(targetUrl, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'User-Agent': userAgent,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Cache-Control': 'no-cache',
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!resp.ok && resp.status !== 301 && resp.status !== 302) {
    return { ok: false, html: '', finalUrl: targetUrl }
  }

  const buffer = await resp.arrayBuffer()
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0, 5 * 1024 * 1024))
  return { ok: true, html: text, finalUrl: targetUrl }
}
