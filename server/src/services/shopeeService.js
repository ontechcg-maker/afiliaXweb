import crypto from 'crypto'
import { USER_AGENT } from '../config/env.js'

const API_URL = 'https://open-api.affiliate.shopee.com.br/graphql'

/**
 * Assinatura exigida pela API de Afiliados Shopee:
 * Signature = SHA256(AppId + Timestamp + Payload + Secret)
 * IMPORTANTE: O Payload deve ser JSON compacto (sem espaços extras)
 */
export function signShopeeRequest(appId, secret, timestamp, payload) {
  const base = String(appId) + String(timestamp) + String(payload) + String(secret)
  return crypto.createHash('sha256').update(base, 'utf8').digest('hex')
}

/**
 * Chamada GraphQL à API de Afiliados da Shopee
 */
export async function shopeeGraphQL(query, variables = {}, appId, secret) {
  if (!appId || !secret) {
    throw new Error('Chaves da Shopee (AppId / Secret) não configuradas.')
  }

  // CRÍTICO: JSON compacto (sem espaços) para cálculo de assinatura e envio
  // A Shopee valida a assinatura contra o body EXATO enviado
  const bodyObj = { query, variables }
  const body = JSON.stringify(bodyObj)  // JSON.stringify sem args = compacto por padrão no Node.js

  const timestamp = Math.floor(Date.now() / 1000)
  const signature = signShopeeRequest(appId, secret, timestamp, body)

  console.log(`[Shopee] Req appId=${appId} ts=${timestamp} bodyLen=${body.length} sig=${signature.substring(0, 16)}...`)

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      // CRÍTICO: sem espaço após a vírgula (formato exato da documentação)
      Authorization: `SHA256 Credential=${appId},Timestamp=${timestamp},Signature=${signature}`,
    },
    body,
    signal: AbortSignal.timeout(15000),
  })

  const json = await res.json().catch(() => ({}))

  console.log(`[Shopee] Response status=${res.status} hasErrors=${!!(json.errors?.length)} hasData=${!!json.data}`)

  if (json.errors && json.errors.length > 0) {
    const errorMsg = json.errors.map((e) => e.message || JSON.stringify(e)).join(', ')
    console.error(`[Shopee] API Error: ${errorMsg}`)
    throw new Error(`API Shopee: ${errorMsg}`)
  }

  return json.data
}

/**
 * Resolve um link curto da Shopee (s.shopee.com.br / shope.ee / etc.)
 * seguindo os redirecionamentos até a URL final e extraindo shopId e itemId.
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
      console.log(`[Shopee] Resolved URL: ${finalUrl}`)
    }
  } catch (e) {
    console.error(`[Shopee] resolveShopeeLink error: ${e.message}`)
  }

  // Tenta todos os padrões de URL da Shopee
  const match =
    finalUrl.match(/-i\.(\d+)\.(\d+)/) ||
    finalUrl.match(/\/product\/(\d+)\/(\d+)/) ||
    finalUrl.match(/[?&]shopid=(\d+).*[?&]itemid=(\d+)/) ||
    shortUrl.match(/-i\.(\d+)\.(\d+)/) ||
    shortUrl.match(/\/product\/(\d+)\/(\d+)/)

  if (!match) {
    throw new Error(`Não foi possível extrair o itemId da URL da Shopee: ${finalUrl}`)
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
  // Usa itemId inline na query para máxima compatibilidade com a API
  const itemIdNum = Number(itemId)
  const query = `{ productOfferV2(itemId: ${itemIdNum}, limit: 1) { nodes { itemId productName imageUrl priceMin priceMax priceDiscountRate offerLink } } }`

  const data = await shopeeGraphQL(query, {}, appId, secret)
  const node = data?.productOfferV2?.nodes?.[0]

  if (!node) {
    throw new Error(`Produto ${itemId} não encontrado na API da Shopee (pode não fazer parte do programa de afiliados).`)
  }

  const priceTo = parseFloat(node.priceMin) || parseFloat(node.priceMax) || 0
  const rawDiscountRate = parseFloat(node.priceDiscountRate) || 0

  // Normaliza o desconto (se vier em percentual 20 ou fração 0.20)
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

