/**
 * Helper centralizado para montar URLs de chamadas da API
 * Resolve com segurança casos de VITE_API_URL com ou sem '/api' e evita duplicação /api/api
 */
export function getApiUrl(path: string): string {
  const envUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`

  if (!envUrl) {
    return cleanPath.startsWith('/api') ? cleanPath : `/api${cleanPath}`
  }

  // Se a variável VITE_API_URL já terminar com /api (ex: https://app.ontechcg.cloud/api)
  if (envUrl.endsWith('/api')) {
    if (cleanPath.startsWith('/api/')) {
      return `${envUrl}${cleanPath.substring(4)}`
    }
    if (cleanPath === '/api') {
      return envUrl
    }
    return `${envUrl}${cleanPath}`
  }

  // Se a variável VITE_API_URL NÃO terminar com /api (ex: https://app.ontechcg.cloud)
  if (cleanPath.startsWith('/api/')) {
    return `${envUrl}${cleanPath}`
  }
  return `${envUrl}/api${cleanPath}`
}
