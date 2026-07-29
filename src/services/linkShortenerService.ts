export type ShortenerProvider = 'none' | 'tinyurl' | 'isgd' | 'bitly'

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

/**
 * Retorna a URL limpa de afiliado sem alterar o link original
 */
export function addUTMParams(url: string, _utm: UTMParams): string {
  return url
}

/**
 * Retorna o link exatamente como cadastrado pelo usuário
 */
export async function shortenLink(
  url: string,
  _config: ShortenerConfig = { provider: 'none' }
): Promise<string> {
  return url
}

/**
 * Processa o link de afiliado mantendo a URL cadastrada intacta
 */
export async function processAffiliateLink(
  rawUrl: string,
  _platform: 'whatsapp' | 'telegram' = 'whatsapp',
  _config: ShortenerConfig = { provider: 'none' }
): Promise<string> {
  return rawUrl
}
