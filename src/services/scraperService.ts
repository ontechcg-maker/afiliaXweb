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
  if (url.includes('magazineluiza') || url.includes('magalu') || url.includes('mglu')) return 'magalu'
  if (url.includes('aliexpress') || url.includes('s.click.aliexpress')) return 'aliexpress'
  if (url.includes('casasbahia') || url.includes('ponto') || url.includes('extra')) return 'casasbahia'
  if (url.includes('americanas') || url.includes('submarino') || url.includes('shoptime')) return 'americanas'
  if (url.includes('hotmart') || url.includes('kiwify') || url.includes('braip') || url.includes('monetizze') || url.includes('eduzz')) return 'digital_product'
  return 'generic'
}

/**
 * Expande e desencurta URLs (meli.la, amzn.to, shope.ee, etc.)
 */
export async function unshortenUrl(url: string): Promise<string> {
  if (
    url.includes('mercadolivre.com.br') ||
    url.includes('shopee.com.br') ||
    url.includes('amazon.com.br') ||
    url.includes('magazineluiza.com.br') ||
    url.includes('aliexpress.com/item')
  ) {
    return url
  }

  // Tenta via API backend (sem restrições de CORS, server-side)
  try {
    const token = localStorage.getItem('afiliax_auth_token')
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

  if (platform === 'mercadolivre') {
    const widMatch = url.match(/wid=(MLB[0-9]+)/i)
    const generalMatch = url.match(/(MLB-?[0-9]{8,12})/i)
    const pMatch = url.match(/\/p\/(MLB[0-9]+)/i)

    const mlIds: string[] = []
    if (widMatch) mlIds.push(widMatch[1].replace('-', ''))
    if (generalMatch) mlIds.push(generalMatch[1].replace('-', ''))
    if (pMatch) mlIds.push(pMatch[1].replace('-', ''))

    const uniqueIds = Array.from(new Set(mlIds))

    let bestResult: ScrapedProduct | null = null

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

    if (bestResult) {
      if (!bestResult.priceTo && bestResult.priceFrom) {
        bestResult.priceTo = bestResult.priceFrom
        bestResult.priceFrom = undefined
      }
      return bestResult
    }
  }

  const slugTitle = extractTitleFromUrlSlug(url)

  let html = ''

  // Tenta via API backend (server-side, sem bloqueios de CORS)
  try {
    const token = localStorage.getItem('afiliax_auth_token')
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
            title: metaTitle,
            imageUrl: cleanImg,
            priceTo: meta.price?.amount || undefined,
            platform,
          }
        }
      }
    } catch {}
  }

  if (html && html.length > 100) {
    const scraped = parseProductFromHTML(html, url, platform)
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
    title: slugTitle || 'Produto de Afiliado',
    platform,
    imageUrl: undefined,
  }
}

function parseMercadoLivrePrice(html: string): { priceTo?: number; priceFrom?: number } {
  let priceTo: number | undefined
  let priceFrom: number | undefined

  // 0. Procura no JSON interno da página (buy_box_winner, price, original_price)
  const priceMatches = [...html.matchAll(/"price"\s*:\s*([0-9]+(?:\.[0-9]+)?)/gi)]
  const origMatches = [...html.matchAll(/"original_price"\s*:\s*([0-9]+(?:\.[0-9]+)?)/gi)]

  if (priceMatches.length > 0) {
    const val = parseFloat(priceMatches[0][1])
    if (!isNaN(val) && val > 0) priceTo = val
  }

  if (origMatches.length > 0) {
    const val = parseFloat(origMatches[0][1])
    if (!isNaN(val) && val > 0) priceFrom = val
  }

  // Remove linhas de parcelamento (ex: "12x R$ 18,12" ou "10x R$ 20,00") para nunca confundir a parcela com o Preço POR!
  const cleanHtml = html.replace(/[0-9]{1,2}\s*x\s*R\$\s*[0-9.,]+/gi, '').replace(/[0-9]{1,2}x\s*sem\s*juros/gi, '')

  // 1. Extrai preço riscado (Preço DE)
  if (!priceFrom) {
    const strikethroughMatch =
      cleanHtml.match(/<(?:s|del)[^>]*class=["'][^"']*andes-money-amount[^"']*["'][^>]*>([\s\S]*?)<\/(?:s|del)>/i) ||
      cleanHtml.match(/class=["'][^"']*ui-pdp-price__original-value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) ||
      cleanHtml.match(/<s[^>]*>([\s\S]*?)<\/s>/i) ||
      cleanHtml.match(/<del[^>]*>([\s\S]*?)<\/del>/i)

    if (strikethroughMatch) {
      const sHtml = strikethroughMatch[1]
      const frac = sHtml.match(/andes-money-amount__fraction[^>]*>([0-9.]+)</i)?.[1] ||
                   sHtml.match(/R\$\s*([0-9.]+)/i)?.[1]
      const cents = sHtml.match(/andes-money-amount__cents[^>]*>([0-9]+)</i)?.[1]
      if (frac) {
        priceFrom = parseFloat(`${frac.replace(/\./g, '')}.${cents || '00'}`)
      }
    }
  }

  // 2. Extrai preço principal da oferta (Preço POR)
  if (!priceTo) {
    const mainPriceMatch =
      cleanHtml.match(/class=["'][^"']*(?:ui-pdp-price__second-line|andes-money-amount--main)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span)>/i) ||
      cleanHtml.match(/class=["'][^"']*andes-money-amount[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)

    if (mainPriceMatch) {
      const mainHtml = mainPriceMatch[1]
      const frac = mainHtml.match(/andes-money-amount__fraction[^>]*>([0-9.]+)</i)?.[1]
      const cents = mainHtml.match(/andes-money-amount__cents[^>]*>([0-9]+)</i)?.[1]
      if (frac) {
        priceTo = parseFloat(`${frac.replace(/\./g, '')}.${cents || '00'}`)
      }
    }
  }

  // 3. Fallback: Busca genérica pelas frações "andes-money-amount__fraction"
  if (!priceTo) {
    const allFractions = Array.from(cleanHtml.matchAll(/andes-money-amount__fraction[^>]*>([0-9.]+)</gi))
    const allCents = Array.from(cleanHtml.matchAll(/andes-money-amount__cents[^>]*>([0-9]+)</gi))
    if (allFractions.length > 0) {
      const firstVal = allFractions[0][1].replace(/\./g, '')
      const firstCents = allCents.length > 0 ? allCents[0][1] : '00'
      const parsed = parseFloat(`${firstVal}.${firstCents}`)
      if (!isNaN(parsed) && parsed > 0) {
        priceTo = parsed
      }
    }
  }

  // Regra fundamental: Se tiver apenas 1 preço capturado, ele SEMPRE deve ser o "Preço POR" (Amarelo)
  if (!priceTo && priceFrom) {
    priceTo = priceFrom
    priceFrom = undefined
  }

  if (priceFrom && priceTo && priceFrom <= priceTo) {
    priceFrom = undefined
  }

  return { priceTo, priceFrom }
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

  return {
    title,
    priceFrom,
    priceTo,
    discountPct,
    imageUrl,
    platform,
  }
}
