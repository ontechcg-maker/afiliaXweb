import { supabase } from './supabaseClient'

export interface UserProfile {
  id: string
  email: string
  instance_name: string
  instance_status: 'disconnected' | 'connecting' | 'connected'
  whatsapp_number?: string
  ai_provider: string
  ai_api_key: string
  ai_model: string
  ollama_url?: string
  telegram_bot_token?: string
  max_group_members: number
  send_interval_minutes: number
  role?: string
  is_blocked?: boolean
}

/** Login com e-mail e senha via Supabase Auth */
export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase não configurado. Verifique o arquivo .env.local.' }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

/** Envia e-mail de recuperação de senha */
export async function resetPassword(
  email: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase não configurado.' }
  const redirectTo = `${window.location.origin}`
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

/** Atualiza a senha do usuário com a nova senha digitada */
export async function updatePassword(
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase não configurado.' }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

/** Cadastro de novo usuário via Supabase Auth */
export async function register(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; needsConfirmation?: boolean }> {
  if (!supabase) return { success: false, error: 'Supabase não configurado.' }
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { success: false, error: error.message }
  // Se o email de confirmação estiver desativado no Supabase, a sessão já existe
  const needsConfirmation = !data.session
  return { success: true, needsConfirmation }
}

/** Desloga o usuário atual */
export async function logout(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
}

/** Retorna o token de acesso atual do Supabase Auth */
export async function getAuthToken(): Promise<string | null> {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

/** Verifica se há uma sessão ativa */
export async function checkIsAuthenticated(): Promise<boolean> {
  if (!supabase) return false
  const { data: { session } } = await supabase.auth.getSession()
  return Boolean(session)
}

/** Header Authorization com JWT do Supabase */
export async function authHeader(): Promise<Record<string, string>> {
  const token = await getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Carrega o perfil do usuário logado */
export async function loadUserProfile(): Promise<UserProfile | null> {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return data as UserProfile | null
}

/** Salva configurações do usuário no perfil (Supabase) */
export async function saveUserProfile(updates: Partial<UserProfile>): Promise<void> {
  if (!supabase) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('profiles').update(updates).eq('id', user.id)
}

/** Compatibilidade com código legado — isAuthenticated síncrono */
export function isAuthenticated(): boolean {
  // Verifica token Supabase no localStorage (chave padrão do SDK)
  const keys = Object.keys(localStorage).filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
  if (keys.length > 0) {
    try {
      const raw = localStorage.getItem(keys[0])
      if (raw) {
        const parsed = JSON.parse(raw)
        return Boolean(parsed?.access_token)
      }
    } catch {}
  }
  return false
}
