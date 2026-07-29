import { authHeader } from './authService'
import { getApiUrl } from './apiUrl'

export type ShortenerProvider = 'none' | 'afiliax' | 'tinyurl' | 'isgd' | 'bitly'

export interface ShortenerConfig {
  provider: ShortenerProvider
  bitlyToken?: string
  customDomain?: string
}

export interface UTMParams {
  source?: string
  medium?: string
  campaign?: string
  content?: string
}

export interface AnalyticsSummary {
  totalClicks: number
  clicksToday: number
  clicksByChannel: {
    whatsapp: number
    telegram: number
    discord: number
    general: number
  }
}

/**
 * Encurta o link de afiliado criando uma URL rastreável /r/:code no AfiliaX
 */
export async function shortenLink(
  targetUrl: string,
  channelType: 'whatsapp' | 'telegram' | 'discord' | 'general' = 'general',
  offerId?: string
): Promise<string> {
  try {
    const headers = await authHeader()
    const res = await fetch(getApiUrl('/shorten-link'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({ targetUrl, channelType, offerId }),
    })
    const data = await res.json()
    if (res.ok && data.shortUrl) {
      return data.shortUrl
    }
  } catch {}
  return targetUrl
}

/**
 * Busca o resumo de estatísticas de cliques do usuário logado
 */
export async function fetchClickAnalyticsSummary(): Promise<AnalyticsSummary> {
  try {
    const headers = await authHeader()
    const res = await fetch(getApiUrl('/analytics/summary'), {
      headers: {
        ...headers,
      },
    })
    if (res.ok) {
      return await res.json()
    }
  } catch {}

  return {
    totalClicks: 0,
    clicksToday: 0,
    clicksByChannel: { whatsapp: 0, telegram: 0, discord: 0, general: 0 },
  }
}
