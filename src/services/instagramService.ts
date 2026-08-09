import { authHeader } from './authService'
import { getApiUrl } from './apiUrl'

export interface InstagramAccountStatus {
  connected: boolean
  username?: string | null
  accountId?: string | null
}

async function apiCall(path: string, options: RequestInit = {}): Promise<any> {
  const headers = await authHeader()
  const url = getApiUrl(path)
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...(options.headers as Record<string, string> || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error || `Erro HTTP ${res.status}`)
  }
  return data
}

/** Retorna o status de conexão do Instagram */
export async function getInstagramStatus(): Promise<InstagramAccountStatus> {
  try {
    return await apiCall('/instagram/status')
  } catch {
    return { connected: false }
  }
}

/** Conecta o Instagram via Account ID + Meta Access Token */
export async function connectInstagram(payload: {
  accountId: string
  accessToken: string
}): Promise<{ success: boolean; account?: { id: string; username: string; name: string } }> {
  return apiCall('/instagram/connect', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** Desconecta a conta do Instagram */
export async function disconnectInstagram(): Promise<void> {
  await apiCall('/instagram/disconnect', { method: 'POST' })
}

/** Envia um post no Instagram de forma direta */
export async function sendInstagramPost(imageUrl: string, caption: string): Promise<void> {
  await apiCall('/instagram/send', {
    method: 'POST',
    body: JSON.stringify({ imageUrl, caption }),
  })
}
