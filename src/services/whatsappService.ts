/**
 * whatsappService.ts
 * Todas as chamadas ao WhatsApp são feitas via backend (/api/whatsapp/*).
 * O backend usa a Evolution API configurada no servidor — o cliente nunca vê a API key.
 */
import { authHeader } from './authService'

export interface WhatsAppGroup {
  id: string
  name: string
  memberCount: number
  isAdmin?: boolean
}

export interface ConnectionStatus {
  connected: boolean
  instanceName?: string | null
  whatsappNumber?: string
}

async function apiCall(path: string, options: RequestInit = {}): Promise<any> {
  const headers = await authHeader()
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...(options.headers as Record<string, string> || {}),
    },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error || `Erro HTTP ${res.status}`)
  }
  return res.json()
}

/** Inicia conexão WhatsApp — retorna QR Code (base64) */
export async function connectWhatsApp(): Promise<{ qrCode: string; instanceName: string }> {
  return apiCall('/whatsapp/connect', { method: 'POST' })
}

/** Retorna status atual de conexão do WhatsApp do usuário logado */
export async function getConnectionStatus(): Promise<ConnectionStatus> {
  try {
    return await apiCall('/whatsapp/status')
  } catch {
    return { connected: false }
  }
}

/** Desconecta o WhatsApp do usuário */
export async function disconnectWhatsApp(): Promise<void> {
  await apiCall('/whatsapp/disconnect', { method: 'POST' })
}

/** Lista grupos do WhatsApp do usuário */
export async function getGroups(): Promise<WhatsAppGroup[]> {
  try {
    return await apiCall('/whatsapp/groups')
  } catch {
    return []
  }
}

/** Envia mensagem de texto via WhatsApp do usuário */
export async function sendTextMessage(groupId: string, text: string): Promise<void> {
  await apiCall('/whatsapp/send-text', {
    method: 'POST',
    body: JSON.stringify({ groupId, text }),
  })
}

/** Envia mensagem com imagem/vídeo via WhatsApp do usuário */
export async function sendMediaMessage(
  groupId: string,
  mediaUrl: string,
  caption: string,
  mediaType: 'image' | 'video' = 'image'
): Promise<void> {
  await apiCall('/whatsapp/send-media', {
    method: 'POST',
    body: JSON.stringify({ groupId, mediaUrl, caption, mediaType }),
  })
}
