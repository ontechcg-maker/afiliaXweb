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
  inviteUrl?: string
}

export interface ConnectionStatus {
  connected: boolean
  instanceName?: string | null
  whatsappNumber?: string
}

import { getApiUrl } from './apiUrl'

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

export interface CreateWhatsAppGroupPayload {
  name: string
  description?: string
  participants?: string[]
}

/** Cria um novo grupo no WhatsApp */
export async function createWhatsAppGroup(payload: CreateWhatsAppGroupPayload): Promise<{
  success: boolean
  group?: { id: string; name: string; description?: string; inviteLink?: string }
  error?: string
}> {
  return apiCall('/whatsapp/create-group', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
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
  const isVideo = mediaType === 'video' ||
    mediaUrl.startsWith('data:video/') ||
    /\.(mp4|webm|mov|avi|mkv|m4v)(\?.*)?$/i.test(mediaUrl)

  await apiCall('/whatsapp/send-media', {
    method: 'POST',
    body: JSON.stringify({ groupId, mediaUrl, caption, mediaType: isVideo ? 'video' : 'image' }),
  })
}

/** Calcula um tempo de espera randômico em milissegundos para a proteção Anti-Ban */
export function getRandomAntiBanDelay(minSeconds: number = 15, maxSeconds: number = 45): number {
  const min = Math.max(1, minSeconds)
  const max = Math.max(min, maxSeconds)
  return Math.floor(Math.random() * (max - min + 1) + min) * 1000
}

/** Aguarda N milissegundos (promessa async) */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
