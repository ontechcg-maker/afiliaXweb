import { authHeader } from './authService'

export interface AdminStats {
  totalUsers: number
  activeUsers: number
  totalOffers: number
  totalDispatches: number
}

export interface AdminUser {
  id: string
  email: string
  instance_name: string
  instance_status: 'disconnected' | 'connecting' | 'connected'
  whatsapp_number?: string
  role?: string
  is_blocked?: boolean
  created_at: string
  offers_count?: number
  schedules_count?: number
}

async function adminApiCall(path: string, options: RequestInit = {}): Promise<any> {
  const headers = await authHeader()
  const res = await fetch(`/api/admin${path}`, {
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

/** Retorna métricas globais do SaaS */
export async function getAdminStats(): Promise<AdminStats> {
  return adminApiCall('/stats')
}

/** Retorna lista de todos os clientes cadastrados */
export async function getAdminUsers(): Promise<AdminUser[]> {
  return adminApiCall('/users')
}

/** Bloqueia ou desbloqueia o acesso de um cliente */
export async function toggleBlockUser(userId: string, isBlocked: boolean): Promise<void> {
  await adminApiCall('/toggle-block', {
    method: 'POST',
    body: JSON.stringify({ userId, isBlocked }),
  })
}

/** Altera a função de um usuário (admin | user) */
export async function setUserRole(userId: string, role: string): Promise<void> {
  await adminApiCall('/set-role', {
    method: 'POST',
    body: JSON.stringify({ userId, role }),
  })
}
