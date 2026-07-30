import { getAuthToken } from './authService'

export interface ScrapedProduct {
  title: string
  priceFrom?: number
  priceTo?: number
  discountPct?: number
  coupon?: string
  rating?: number
  imageUrl?: string
  platform: string
}

function detectPlatform(url: string): string {
  if (url.includes('mercadolivre') || url.includes('mercadolibre') || url.includes('mercl.io') || url.includes('meli.la')) return 'mercadolivre'
  if (url.includes('shopee') || url.includes('shope.ee')) return 'shopee'
  if (url.includes('amazon') || url.includes('amzn')) return 'amazon'
  if (url.includes('magazineluiza') || url.includes('magalu') || url.includes('mglu') || url.includes('onelink.me') || url.includes('magazinevoce') || url.includes('divulgador.magalu')) return 'magalu'
  if (url.includes('aliexpress') || url.includes('s.click.aliexpress')) return 'aliexpress'
  if (url.includes('casasbahia') || url.includes('ponto') || url.includes('extra')) return 'casasbahia'
  if (url.includes('americanas') || url.includes('submarino') || url.includes('shoptime')) return 'americanas'
  if (url.includes('hotmart') || url.includes('kiwify') || url.includes('braip') || url.includes('monetizze') || url.includes('eduzz')) return 'digital_product'
  return 'generic'
}

/**
 * Expande e desencurta URLs (meli.la, amzn.to, shope.ee, magazineluiza.onelink.me, etc.)
 */
export async function unshortenUrl(url: string): Promise<string> {
  if (
    url.includes('mercadolivre.com.br') ||
    url.includes('shopee.com.br') ||
    url.includes('shope.ee') ||
    url.includes('amazon.com.br') ||
    url.includes('m.magazineluiza.com.br') ||
    url.includes('aliexpress.com/item')
  ) {
    return url
  }

  // Tenta via API backend (sem restrições de CORS, server-side)
  try {
    const token = await getAuthToken()
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    const backendRes = await fetch(`/api/unshorten?url=${encodeURIComponent(url)}`, { headers })
    if (backendRes.ok) {
      const backendData = await backendRes.json()
      const finalUrl = backendData?.finalUrl
      if (finalUrl && finalUrl !== url && !finalUrl.includes('corsproxy')) {
        return finalUrl
      }
    }
  } catch {}

  try {
    const proxyRes = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`)
    if (proxyRes.ok) {
      const data = await proxyRes.json()
      const finalUrl = data?.status?.url
      if (finalUrl && finalUrl !== url && !finalUrl.includes('corsproxy')) {
        return finalUrl
      }
    }
  } catch {}

  return url
}

function extractDiscount(priceFrom: number | undefined, priceTo: number | undefined): number | undefined {
  if (!priceFrom || !priceTo || priceFrom <= priceTo) return undefined
  return Math.round(((priceFrom - priceTo) / priceFrom) * 100)
}

function extractTitleFromUrlSlug(url: string): string | undefined {
  if (url.includes('shopee') || url.includes('shope.ee')) return undefined

  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname

    const slugMatch =
      pathname.match(/\/([a-z0-9-]+)\/(?:p\/|MLB|\d)/i) ||
      pathname.match(/\/([a-z0-9-]{10,})\/?$/i)

    if (slugMatch && slugMatch[1]) {
      const rawSlug = slugMatch[1]
      if (rawSlug !== 'p' && rawSlug !== 'mercadolivre' && rawSlug.length > 5) {
        const formatted = rawSlug
          .split('-')
          .map((word) => {
            if (['tv', '4k', 'ai', 'hd', '5g', 'pc', 'ar', 'bivolt', 'led', 'ram', 'gb', 'tb', 'ssd', 'oven', '12l', '127v', '220v', '3kg', '1kg'].includes(word.toLowerCase())) {
              return word.toUpperCase()
            }
            if (word.length <= 2) return word.toLowerCase()
            return word.charAt(0).toUpperCase() + word.slice(1)
          })
          .join(' ')
        return formatted
      }
    }
  } catch {}
  return undefined
}

export async function scrapeProduct(rawUrl: string): Promise<ScrapedProduct> {
  const url = await unshortenUrl(rawUrl)
  const platform = detectPlatform(url)
  let bestResult: ScrapedProduct | null = null

  if (platform === 'mercadolivre') {
    const widMatch = url.match(/wid=(MLB[0-9]+)/i)
    const generalMatch = url.match(/(MLB-?[0-9]{8,12})/i)
    const pMatch = url.match(/\/p\/(MLB[0-9]+)/i)

    const mlIds: string[] = []
    if (widMatch) mlIds.push(widMatch[1].replace('-', ''))
    if (generalMatch) mlIds.push(generalMatch[1].replace('-', ''))
    if (pMatch) mlIds.push(pMatch[1].replace('-', ''))

    const uniqueIds = Array.from(new Set(mlIds))

    for (const mlId of uniqueIds) {
      try {
        let title = ''
        let priceTo: number | undefined
        let priceFrom: number | undefined
        let imageUrl: string | undefined

        const itemRes = await fetch(`https://api.mercadolibre.com/items/${mlId}`)
        if (itemRes.ok) {
          const itemData = await itemRes.json()
          title = itemData.title || itemData.name || ''
          priceTo = itemData.price || itemData.base_price
          priceFrom = itemData.original_price

          if (itemData.pictures && itemData.pictures.length > 0) {
            imageUrl = itemData.pictures[0].secure_url || itemData.pictures[0].url
          }
          if (!imageUrl) imageUrl = itemData.thumbnail

          if (!priceTo && Array.isArray(itemData.variations) && itemData.variations.length > 0) {
            priceTo = itemData.variations[0].price
            priceFrom = itemData.variations[0].original_price
          }
        }

        if (!title || !priceTo) {
          const prodRes = await fetch(`https://api.mercadolibre.com/products/${mlId}`)
          if (prodRes.ok) {
            const prodData = await prodRes.json()
            title = title || prodData.name || prodData.title || ''
            priceTo = priceTo || prodData.buy_box_winner?.price || prodData.price
            priceFrom = priceFrom || prodData.buy_box_winner?.original_price || prodData.original_price

            if (!imageUrl && prodData.pictures && prodData.pictures.length > 0) {
              imageUrl = prodData.pictures[0].secure_url || prodData.pictures[0].url
            }
          }
        }

        if (!priceTo) {
          const itemsRes = await fetch(`https://api.mercadolibre.com/products/${mlId}/items`)
          if (itemsRes.ok) {
            const itemsData = await itemsRes.json()
            const results = Array.isArray(itemsData) ? itemsData : itemsData?.results || []
            const first = results[0]
            if (first) {
              priceTo = first.price || first.base_price
              priceFrom = first.original_price
              if (!imageUrl && first.thumbnail) imageUrl = first.thumbnail
            }
          }
        }

        if (!priceTo && priceFrom) {
          priceTo = priceFrom
          priceFrom = undefined
        }

        if (priceFrom && priceTo && priceFrom <= priceTo) {
          priceFrom = undefined
        }

        if (imageUrl) {
          if (imageUrl.startsWith('http:')) imageUrl = imageUrl.replace('http:', 'https:')
          if (imageUrl.includes('-I.jpg')) imageUrl = imageUrl.replace('-I.jpg', '-F.jpg')
          if (imageUrl.includes('-I.png')) imageUrl = imageUrl.replace('-I.png', '-F.png')
        }

        if (title) {
          const result: ScrapedProduct = {
            title: title.trim(),
            priceTo: priceTo ? Number(priceTo) : undefined,
            priceFrom: priceFrom ? Number(priceFrom) : undefined,
            discountPct: extractDiscount(priceFrom, priceTo),
            imageUrl: imageUrl || undefined,
            platform: 'mercadolivre',
          }

          if (result.priceTo) {
            return result
          }
          if (!bestResult) {
            bestResult = result
          }
        }
      } catch (e) {
        console.log('ML API Search Error:', e)
      }
    }

    if (bestResult && bestResult.priceTo) {
      return bestResult
    }
  }

  const slugTitle = extractTitleFromUrlSlug(url)

  let html = ''

  // Tenta via API backend (server-side, sem bloqueios de CORS)
  try {
    const token = await getAuthToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const backendRes = await fetch('/api/fetch-html', {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
    })
    if (backendRes.ok) {
      const backendData = await backendRes.json()
      if (backendData.ok && backendData.html) {
        html = backendData.html
      }
    }
  } catch {}

  if (!html) {
    try {
      const directRes = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
        },
      })
      if (directRes.ok) {
        html = await directRes.text()
      }
    } catch {}
  }

  if (!html || html.length < 200) {
    try {
      const microRes = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`)
      if (microRes.ok) {
        const microData = await microRes.json()
        const meta = microData?.data
        const metaTitle = meta?.title?.replace(/\s*\|\s*(Shopee|Amazon|Magalu|Mercado Livre).*/i, '').trim()
        if (metaTitle) {
          const img = meta.image?.url || meta.logo?.url
          const cleanImg = img?.includes('logo') || img?.includes('handshake') ? undefined : img
          return {
            title: bestResult?.title || metaTitle,
            imageUrl: bestResult?.imageUrl || cleanImg,
            priceTo: meta.price?.amount || undefined,
            platform,
          }
        }
      }
    } catch {}
  }

  if (html && html.length > 100) {
    const scraped = parseProductFromHTML(html, url, platform)
    if (bestResult) {
      if (bestResult.title) scraped.title = bestResult.title
      if (bestResult.imageUrl) scraped.imageUrl = bestResult.imageUrl
    }
    if (
      scraped.title === 'Mercado Libre' ||
      scraped.title === 'Mercado Livre' ||
      scraped.title === 'Produto sem título'
    ) {
      if (slugTitle) scraped.title = slugTitle
    }
    if (scraped.imageUrl?.includes('logo') || scraped.imageUrl?.includes('handshake') || scraped.imageUrl?.includes('corsproxy')) {
      scraped.imageUrl = undefined
    }
    return scraped
  }

  return {
    title: bestResult?.title || slugTitle || 'Produto de Afiliado',
    platform,
    imageUrl: bestResult?.imageUrl || undefined,
  }
}

function parseMercadoLivrePrice(html: string): { priceTo?: number; priceFrom?: number } {
  let priceTo: number | undefined
  let priceFrom: number | undefined

  // Remove trechos de parcelamento (ex: "12x R$ 18,12") para não confundir a parcela com o Preço POR
  const cleanHtml = html.replace(/[0-9]{1,2}\s*x\s*R\$\s*[0-9.,]+/gi, '').replace(/[0-9]{1,2}x\s*sem\s*juros/gi, '')

  // 1. Extração por classes específicas do Mercado Livre (andes-money-amount--previous / andes-money-amount--main)
  const prevBlockMatch = cleanHtml.match(/andes-money-amount--(?:previous|original)[^>]*>([\s\S]*?)(?:<\/div>|class=["'][^"']*andes-money-amount)/i)
  if (prevBlockMatch) {
    const frac = prevBlockMatch[1].match(/andes-money-amount__fraction[^>]*>([0-9.]+)</i)?.[1]
    const cents = prevBlockMatch[1].match(/andes-money-amount__cents[^>]*>([0-9]+)</i)?.[1]
    if (frac) {
      priceFrom = parseFloat(`${frac.replace(/\./g, '')}.${cents || '00'}`)
    }
  }

  const mainBlockMatch = cleanHtml.match(/andes-money-amount--main[^>]*>([\s\S]*?)(?:<\/div>|class=["'][^"']*andes-money-amount)/i)
  if (mainBlockMatch) {
    const frac = mainBlockMatch[1].match(/andes-money-amount__fraction[^>]*>([0-9.]+)</i)?.[1]
    const cents = mainBlockMatch[1].match(/andes-money-amount__cents[^>]*>([0-9]+)</i)?.[1]
    if (frac) {
      priceTo = parseFloat(`${frac.replace(/\./g, '')}.${cents || '00'}`)
    }
  }

  // 2. Extração via meta tags (og:price:amount ou itemprop="price")
  if (!priceTo) {
    const metaPriceTo =
      html.match(/<meta[^>]*property=["']og:price:amount["'][^>]*content=["']([0-9.,]+)["']/i)?.[1] ||
      html.match(/<meta[^>]*content=["']([0-9.,]+)["'][^>]*property=["']og:price:amount["']/i)?.[1] ||
      html.match(/<meta[^>]*itemprop=["']price["'][^>]*content=["']([0-9.,]+)["']/i)?.[1] ||
      html.match(/<meta[^>]*content=["']([0-9.,]+)["'][^>]*itemprop=["']price["']/i)?.[1]

    if (metaPriceTo) {
      const val = parseFloat(metaPriceTo.replace('.', '').replace(',', '.'))
      if (!isNaN(val) && val > 0) {
        priceTo = val
      }
    }
  }

  // 3. Extração via JSON-LD (<script type="application/ld+json">)
  if (!priceTo) {
    const ldMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
    if (ldMatches) {
      for (const block of ldMatches) {
        try {
          const content = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '')
          const parsed = JSON.parse(content)
          const item = Array.isArray(parsed) ? parsed[0] : parsed
          const offers = Array.isArray(item?.offers) ? item.offers[0] : item?.offers
          if (offers?.price) {
            const p = parseFloat(String(offers.price))
            if (!isNaN(p) && p > 0) {
              priceTo = p
              if (offers.highPrice && parseFloat(String(offers.highPrice)) > p) {
                priceFrom = parseFloat(String(offers.highPrice))
              }
              break
            }
          }
        } catch {}
      }
    }
  }

  // 4. Mapeamento direto de todas as frações andes-money-amount__fraction no documento
  if (!priceTo) {
    const fractionMatches = [...cleanHtml.matchAll(/andes-money-amount__fraction[^>]*>([0-9.]+)</gi)]
    const centsMatches = [...cleanHtml.matchAll(/andes-money-amount__cents[^>]*>([0-9]+)</gi)]

    const values: number[] = []
    fractionMatches.forEach((m, i) => {
      const valStr = m[1].replace(/\./g, '')
      const centsStr = centsMatches[i] ? centsMatches[i][1] : '00'
      const val = parseFloat(`${valStr}.${centsStr}`)
      if (!isNaN(val) && val > 0 && val < 500000 && !values.includes(val)) {
        values.push(val)
      }
    })

    if (values.length >= 2) {
      if (!priceFrom) priceFrom = values[0]
      priceTo = values[1]
    } else if (values.length === 1) {
      priceTo = values[0]
    }
  }

  // Regra fundamental: Se tiver apenas 1 preço capturado, ele SEMPRE deve ser o "Preço POR"
  if (!priceTo && priceFrom) {
    priceTo = priceFrom
    priceFrom = undefined
  }

  if (priceFrom && priceTo && priceFrom <= priceTo) {
    priceFrom = undefined
  }

  return { priceTo, priceFrom }
}

function extractCouponFromHTML(html: string): string | undefined {
  const couponPatterns = [
    /cupom[:\s]+([A-Z0-9_-]{4,20})/i,
    /c[oó]digo[:\s]+([A-Z0-9_-]{4,20})/i,
    /use\s+o\s+cupom[:\s]+([A-Z0-9_-]{4,20})/i,
    /cupom\s+de\s+desconto[:\s]+([A-Z0-9_-]{4,20})/i,
  ]

  // 1. Tenta encontrar em elementos HTML com atributos contendo coupon ou cupom
  const elementMatches = html.matchAll(/<[^>]+(?:data-testid|class|id)=["'][^"']*(?:coupon|cupom)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi)
  for (const match of elementMatches) {
    const text = match[1].replace(/<[^>]+>/g, ' ').trim()
    for (const pattern of couponPatterns) {
      const found = text.match(pattern)
      if (found && found[1] && found[1].length >= 4) {
        return found[1].toUpperCase()
      }
    }
  }

  // 2. Fallback: Procura no texto limpo da página
  const cleanText = html.replace(/<[^>]+>/g, ' ')
  for (const pattern of couponPatterns) {
    const found = cleanText.match(pattern)
    if (found && found[1] && found[1].length >= 4) {
      const code = found[1].toUpperCase()
      const invalidWords = ['MAGALU', 'PRODUTO', 'FRETE', 'BRASIL', 'DESCONTO', 'OFERTA', 'CARRINHO']
      if (!invalidWords.includes(code)) {
        return code
      }
    }
  }

  return undefined
}

function parseProductFromHTML(html: string, _url: string, platform: string): ScrapedProduct {
  const getMetaContent = (name: string): string | undefined => {
    const match =
      html.match(new RegExp(`<meta[^>]*(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i')) ||
      html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${name}["']`, 'i'))
    return match?.[1]
  }

  let priceTo: number | undefined
  let priceFrom: number | undefined
  let title = ''
  let imageUrl: string | undefined

  if (platform === 'mercadolivre') {
    const mlPrices = parseMercadoLivrePrice(html)
    priceTo = mlPrices.priceTo
    priceFrom = mlPrices.priceFrom
  }

  if (platform === 'magalu') {
    // 1. Tenta extrair via JSON-LD (@type === 'Product' ou com @graph)
    const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
    if (jsonLdMatches) {
      for (const block of jsonLdMatches) {
        const cleanContent = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '')
        try {
          const parsed = JSON.parse(cleanContent)
          let candidates: any[] = []
          if (Array.isArray(parsed)) candidates = parsed
          else if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed['@graph'])) candidates = parsed['@graph']
            else candidates = [parsed]
          }

          for (const item of candidates) {
            if (!item || typeof item !== 'object') continue
            const itemType = item['@type']
            const isProduct = itemType === 'Product' || (Array.isArray(itemType) && itemType.includes('Product'))
            if (isProduct) {
              if (item.name && (!title || title === 'Produto sem título')) {
                title = String(item.name).trim()
              }
              if (item.image) {
                const img = Array.isArray(item.image) ? item.image[0] : item.image
                if (typeof img === 'string') imageUrl = img
                else if (img?.url) imageUrl = img.url
                else if (img?.contentUrl) imageUrl = img.contentUrl
              }
              const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers
              if (offers) {
                const pTo = offers.price ?? offers.lowPrice
                const pFrom = offers.highPrice ?? item.highPrice
                if (pTo !== undefined && pTo !== null) {
                  const val = parseFloat(String(pTo).replace(/[^\d.,]/g, '').replace(',', '.'))
                  if (!isNaN(val) && val > 0) priceTo = val
                }
                if (pFrom !== undefined && pFrom !== null) {
                  const val = parseFloat(String(pFrom).replace(/[^\d.,]/g, '').replace(',', '.'))
                  if (!isNaN(val) && val > 0) priceFrom = val
                }
              }
            }
          }
        } catch {}
      }
    }

    // 2. Tenta extração por seletores CSS / data-testid (heading-product-title, mod-headingproduct, price-value, price-original)
    if (!title || title === 'Produto sem título') {
      const h1Match = html.match(/<h1[^>]*data-testid=["']heading-product-title["'][^>]*>([\s\S]*?)<\/h1>/i) ||
                      html.match(/<h1[^>]*data-testid=["']mod-headingproduct["'][^>]*>([\s\S]*?)<\/h1>/i) ||
                      html.match(/<h1[^>]*data-testid=["']product-title["'][^>]*>([\s\S]*?)<\/h1>/i) ||
                      html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
      if (h1Match) {
        const cleanH1 = h1Match[1].replace(/<[^>]+>/g, '').trim()
        if (cleanH1 && cleanH1.length > 3) {
          title = cleanH1
        }
      }
    }

    if (!priceTo) {
      const pValMatch = html.match(/data-testid=["']price-value["'][^>]*>([^<]+)</i)
      if (pValMatch) {
        const raw = pValMatch[1].replace(/[^\d.,]/g, '').replace('.', '').replace(',', '.')
        const p = parseFloat(raw)
        if (!isNaN(p) && p > 0) priceTo = p
      }
    }

    if (!priceFrom) {
      const pOrigMatch = html.match(/data-testid=["']price-original["'][^>]*>([^<]+)</i) ||
                          html.match(/data-testid=["']mod-productprice["'][^>]*>([^<]+)</i)
      if (pOrigMatch) {
        const raw = pOrigMatch[1].replace(/[^\d.,]/g, '').replace('.', '').replace(',', '.')
        const p = parseFloat(raw)
        if (!isNaN(p) && p > 0) priceFrom = p
      }
    }

    // 3. Imagem meta ou seletores de thumbnail
    if (!imageUrl) {
      const thumbMatch = html.match(/<img[^>]*data-testid=["']image-selected-thumbnail["'][^>]*src=["']([^"']+)["']/i) ||
                         html.match(/<img[^>]*data-testid=["']product-image["'][^>]*src=["']([^"']+)["']/i)
      if (thumbMatch) imageUrl = thumbMatch[1]
    }
    if (!imageUrl) {
      const ogImg = getMetaContent('og:image') || getMetaContent('twitter:image')
      if (ogImg && !ogImg.includes('logo-white') && !ogImg.includes('favicon')) {
        imageUrl = ogImg
      }
    }
  }

  if (platform === 'shopee') {
    if (html.includes('error_page') || html.includes('Page Not Found') || html.includes('página não encontrada')) {
      return {
        title: 'Link da Shopee expirado ou inválido (verifique a URL)',
        platform: 'shopee',
      }
    }

    const descContent = getMetaContent('description') || getMetaContent('og:description')
    if (descContent) {
      const matchDescTitle = descContent.match(/^Compre\s+([^!\n\r]+?)\s+na\s+Shopee\s+Brasil/i) ||
                             descContent.match(/^Compre\s+([^!\n\r]+)/i)
      if (matchDescTitle && matchDescTitle[1]) {
        const candidate = matchDescTitle[1].replace(/\s*na\s*Shopee.*/i, '').trim()
        if (candidate.length > 5) {
          title = candidate
        }
      }
    }

    if (!title || title === 'Produto sem título') {
      const ogTitle = getMetaContent('og:title') || getMetaContent('twitter:title')
      if (ogTitle) {
        title = ogTitle
          .replace(/\s*\|\s*Shopee.*/i, '')
          .replace(/\s*-\s*Shopee.*/i, '')
          .replace(/\.\.\.$/, '')
          .trim()
      }
    }

    const ogImg = getMetaContent('og:image') || getMetaContent('og:square_image') || getMetaContent('twitter:image')
    if (ogImg && !ogImg.includes('logo') && !ogImg.includes('homepagefe')) {
      imageUrl = ogImg
    }

    const metaPrice = getMetaContent('product:price:amount') || getMetaContent('og:price:amount')
    if (metaPrice) {
      const p = parseFloat(metaPrice)
      if (!isNaN(p) && p > 0) priceTo = p
    }

    if (!priceTo && descContent) {
      const priceMatch = descContent.match(/R\$\s*([0-9]+(?:[.,][0-9]{2})?)/i) || html.match(/R\$\s*([0-9]+(?:[.,][0-9]{2})?)/i)
      if (priceMatch) {
        const raw = priceMatch[1].replace('.', '').replace(',', '.')
        const p = parseFloat(raw)
        if (!isNaN(p) && p > 0) priceTo = p
      }
    }
  }

  if (!priceTo) {
    try {
      const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
      if (jsonLdMatches) {
        for (const block of jsonLdMatches) {
          const cleanContent = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '')
          try {
            const parsed = JSON.parse(cleanContent)
            const items = Array.isArray(parsed) ? parsed : [parsed]
            for (const item of items) {
              if (item['@type'] === 'Product' || item.offers) {
                if (item.name && (!title || title === 'Produto sem título')) {
                  title = item.name
                }
                if (item.image) {
                  const img = Array.isArray(item.image) ? item.image[0] : item.image
                  if (typeof img === 'string') imageUrl = img
                  else if (img?.url) imageUrl = img.url
                }
                const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers
                if (offers) {
                  const pTo = offers.price || offers.lowPrice
                  const pFrom = offers.highPrice
                  if (pTo) priceTo = parseFloat(String(pTo))
                  if (pFrom) priceFrom = parseFloat(String(pFrom))
                }
              }
            }
          } catch {}
        }
      }
    } catch {}
  }

  if (!title) {
    const rawTitle =
      getMetaContent('og:title') ||
      getMetaContent('twitter:title') ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
      ''

    title = rawTitle
      .replace(/\s*\|\s*(Shopee|Amazon|Magalu|Mercado Livre|Casas Bahia).*/i, '')
      .replace(/\s*\|\s*Frete\s*grá.*/i, '')
      .replace(/\s*-\s*Mercado\s*Livre.*/i, '')
      .replace(/\s*:\s*Amazon\.com\.br.*/i, '')
      .trim()
  }

  if (!title) title = 'Produto sem título'

  if (!imageUrl) {
    imageUrl = getMetaContent('og:image') || getMetaContent('twitter:image')
    if (!imageUrl) {
      const imgMatch = html.match(/<img[^>]*class=["'][^"']*(?:ui-pdp-image|product-image|main-image|pdp-mod-product-badge)[^"']*["'][^>]*src=["']([^"']+)["']/i)
      if (imgMatch) imageUrl = imgMatch[1]
    }
  }

  if (imageUrl && imageUrl.startsWith('//')) {
    imageUrl = 'https:' + imageUrl
  }

  if (!priceTo) {
    const metaPrice = getMetaContent('product:price:amount') || getMetaContent('og:price:amount')
    if (metaPrice) priceTo = parseFloat(metaPrice)
  }

  if (!priceTo) {
    const pricePatterns = [
      /class=["'][^"']*(?:ui-pdp-price__second-line|a-price|shopee-price)[^"']*["'][^>]*>[\s\S]*?R\$\s*([0-9.]+)/i,
      /itemprop=["']price["'][^>]*content=["']([0-9.]+)/i,
      /"price":\s*([0-9.]+)/i,
      /R\$\s*([0-9]+(?:[.,][0-9]{2})?)/,
    ]

    for (const pattern of pricePatterns) {
      const match = html.match(pattern)
      if (match) {
        const raw = match[1].replace('.', '').replace(',', '.')
        priceTo = parseFloat(raw)
        break
      }
    }
  }

  // Regra fundamental final: Se Preço POR estiver vazio mas Preço DE tiver valor, atribui a Preço POR!
  if (!priceTo && priceFrom) {
    priceTo = priceFrom
    priceFrom = undefined
  }

  if (priceFrom && priceTo && priceFrom <= priceTo) {
    priceFrom = undefined
  }

  const discountMatch = html.match(/([0-9]{1,2})%\s*OFF/i)
  const discountPct = discountMatch ? parseInt(discountMatch[1]) : extractDiscount(priceFrom, priceTo)
  const coupon = extractCouponFromHTML(html)

  return {
    title,
    priceFrom,
    priceTo,
    discountPct,
    coupon,
    imageUrl,
    platform,
  }
}

