import crypto from 'crypto'
import { USER_AGENT } from '../config/env.js'

const API_URL = 'https://open-api.affiliate.shopee.com.br/graphql'

/**
 * Assinatura: SHA256(AppId + Timestamp + Payload + Secret)
 * Payload deve ser o body JSON exato que será enviado
 */
export function signShopeeRequest(appId, secret, timestamp, payload) {
  const base = String(appId) + String(timestamp) + String(payload) + String(secret)
  return crypto.createHash('sha256').update(base, 'utf8').digest('hex')
}

/**
 * Chamada GraphQL à API de Afiliados da Shopee
 */
export async function shopeeGraphQL(query, appId, secret) {
  if (!appId || !secret) {
    throw new Error('Chaves da Shopee (AppId / Secret) não configuradas.')
  }

  // Body sem campo "variables" para simplificar e ter body exato para assinatura
  const body = JSON.stringify({ query })

  const timestamp = Math.floor(Date.now() / 1000)
  const signature = signShopeeRequest(appId, secret, timestamp, body)

  console.log(`[Shopee] Req appId=${appId} ts=${timestamp} bodyLen=${body.length} sig=${signature.substring(0, 16)}...`)
  console.log(`[Shopee] Query: ${body.substring(0, 200)}`)

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      Authorization: `SHA256 Credential=${appId},Timestamp=${timestamp},Signature=${signature}`,
    },
    body,
    signal: AbortSignal.timeout(20000),
  })

  const rawText = await res.text().catch(() => '{}')
  console.log(`[Shopee] Response HTTP=${res.status} body=${rawText.substring(0, 300)}`)

  let json = {}
  try { json = JSON.parse(rawText) } catch {}

  if (json.errors && json.errors.length > 0) {
    const errorMsg = json.errors.map((e) => e.message || JSON.stringify(e)).join(', ')
    console.error(`[Shopee] API Error: ${errorMsg}`)
    throw new Error(`API Shopee: ${errorMsg}`)
  }

  return json.data
}

/**
 * Extrai shopId e itemId de qualquer formato de URL da Shopee.
 * Formatos suportados:
 *  - https://s.shopee.com.br/XXXXXX  (link curto, faz redirect)
 *  - https://shopee.com.br/produto-i.341670128.23997821333
 *  - https://shopee.com.br/username/341670128/23997821333
 *  - https://shopee.com.br/product/341670128/23997821333
 *  - https://shopee.com.br/...?shopid=...&itemid=...
 */
export async function resolveShopeeLink(shortUrl) {
  let finalUrl = shortUrl

  try {
    const res = await fetch(shortUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: AbortSignal.timeout(12000),
    }).catch(() => null)

    if (res?.url) {
      finalUrl = res.url
    }
    console.log(`[Shopee] Resolved URL: ${finalUrl}`)
  } catch (e) {
    console.error(`[Shopee] resolveShopeeLink error: ${e.message}`)
  }

  // Remove query string para facilitar extração do path
  const urlPath = finalUrl.split('?')[0]

  const match =
    // Formato: produto-i.341670128.23997821333
    urlPath.match(/-i\.(\d+)\.(\d+)/) ||
    // Formato: /product/341670128/23997821333
    urlPath.match(/\/product\/(\d+)\/(\d+)/) ||
    // Formato: /username/341670128/23997821333 (último par de segmentos numéricos)
    urlPath.match(/\/[^\/]+\/(\d{5,})\/(\d{5,})(?:\/|$)/) ||
    // Formato: /341670128/23997821333 (dois segmentos numéricos no final)
    urlPath.match(/\/(\d{5,})\/(\d{5,})(?:\/|$)/) ||
    // Query string: ?shopid=...&itemid=...
    finalUrl.match(/[?&]shopid=(\d+)[^&]*[?&]itemid=(\d+)/i) ||
    finalUrl.match(/[?&]itemid=(\d+)[^&]*[?&]shopid=(\d+)/i) ||
    // Fallback na URL original
    shortUrl.match(/-i\.(\d+)\.(\d+)/) ||
    shortUrl.match(/\/product\/(\d+)\/(\d+)/)

  if (!match) {
    throw new Error(`Não foi possível extrair shopId/itemId da URL da Shopee: ${finalUrl}`)
  }

  const shopId = Number(match[1])
  const itemId = Number(match[2])

  console.log(`[Shopee] shopId=${shopId} itemId=${itemId}`)

  return { shopId, itemId, finalUrl }
}

/**
 * Busca dados do produto via GraphQL (productOfferV2)
 */
export async function getShopeeProductData(itemId, appId, secret) {
  const itemIdNum = Number(itemId)

  // Inline itemId na query — mais compatível que variables tipadas
  const query = `{ productOfferV2(itemId: ${itemIdNum}, limit: 1) { nodes { itemId productName imageUrl priceMin priceMax priceDiscountRate offerLink } } }`

  const data = await shopeeGraphQL(query, appId, secret)
  const node = data?.productOfferV2?.nodes?.[0]

  console.log(`[Shopee] Product node: ${JSON.stringify(node || null)}`)

  if (!node) {
    throw new Error(`Produto ${itemId} não encontrado na API da Shopee (pode não fazer parte do programa de afiliados).`)
  }

  const priceTo = parseFloat(node.priceMin) || parseFloat(node.priceMax) || 0
  const rawDiscountRate = parseFloat(node.priceDiscountRate) || 0

  const discountFraction = rawDiscountRate > 1 ? rawDiscountRate / 100 : rawDiscountRate
  const discountPct = discountFraction > 0 ? Math.round(discountFraction * 100) : undefined

  let priceFrom = undefined
  if (discountFraction > 0 && discountFraction < 1 && priceTo > 0) {
    priceFrom = Number((priceTo / (1 - discountFraction)).toFixed(2))
    if (priceFrom <= priceTo) priceFrom = undefined
  }

  return {
    ok: true,
    title: node.productName || 'Produto Shopee',
    imageUrl: node.imageUrl || undefined,
    priceTo: priceTo > 0 ? Number(priceTo.toFixed(2)) : undefined,
    priceFrom,
    discountPct,
    affiliateLink: node.offerLink || undefined,
    itemId: String(node.itemId || itemId),
    platform: 'shopee',
  }
}

/**
 * Função integradora principal para a Shopee
 */
export async function capturarDadosShopeeService(linkAfiliado, appId, secret) {
  const { itemId, finalUrl } = await resolveShopeeLink(linkAfiliado)
  const productData = await getShopeeProductData(itemId, appId, secret)
  return { ...productData, finalUrl }
}

