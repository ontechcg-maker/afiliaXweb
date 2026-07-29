import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import type { AIConfig } from '../services/aiService'
import type { TelegramConfig } from '../services/telegramService'
import { supabase } from '../services/supabaseClient'
import {
  isAuthenticated,
  loadUserProfile,
  saveUserProfile,
  type UserProfile,
} from '../services/authService'
import { getConnectionStatus } from '../services/whatsappService'

export type ThemeMode = 'dark' | 'light'

// Configurações por usuário (AI, Telegram, Agendamento)
interface AppSettings {
  ai: AIConfig
  telegram: TelegramConfig
  maxGroupMembers: number
  sendIntervalMinutes: number
}

interface AppContextType {
  settings: AppSettings
  updateSettings: (s: Partial<AppSettings>) => void
  user: User | null
  userProfile: UserProfile | null
  refreshProfile: () => Promise<void>
  supabaseConnected: boolean
  evolutionConnected: boolean
  authenticated: boolean
  setAuthenticated: (v: boolean) => void
  activeTab: string
  setActiveTab: (tab: string) => void
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

const defaultSettings: AppSettings = {
  ai: { provider: 'openrouter', apiKey: '', model: 'google/gemini-2.0-flash-exp:free' },
  telegram: { botToken: '' },
  maxGroupMembers: 1000,
  sendIntervalMinutes: 20,
}

const AppContext = createContext<AppContextType>({
  settings: defaultSettings,
  updateSettings: () => {},
  user: null,
  userProfile: null,
  refreshProfile: async () => {},
  supabaseConnected: false,
  evolutionConnected: false,
  authenticated: false,
  setAuthenticated: () => {},
  activeTab: 'dashboard',
  setActiveTab: () => {},
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
})

export function AppProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(() => isAuthenticated())
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [supabaseConnected, setSupabaseConnected] = useState(Boolean(supabase))
  const [evolutionConnected, setEvolutionConnected] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')

  // Estado do Tema (Light / Dark)
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem('afiliax_theme')
      if (stored === 'light' || stored === 'dark') return stored
    } catch {}
    return 'dark'
  })

  // Aplica o tema na tag <html> e salva no localStorage
  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    try {
      localStorage.setItem('afiliax_theme', newTheme)
    } catch {}
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  // Inicialização do atributo data-theme ao montar
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Configurações locais (AI key, Telegram, intervalo)
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem('afiliax_settings')
      if (stored) {
        const parsed = JSON.parse(stored)
        return {
          ai: parsed.ai || defaultSettings.ai,
          telegram: parsed.telegram || defaultSettings.telegram,
          maxGroupMembers: parsed.maxGroupMembers || 1000,
          sendIntervalMinutes: parsed.sendIntervalMinutes || 20,
        }
      }
    } catch {}
    return defaultSettings
  })

  // ─── Supabase Auth: detecta login/logout ─────────────────────
  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        setAuthenticated(true)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      setAuthenticated(Boolean(currentUser))
      if (!currentUser) {
        setUserProfile(null)
        setEvolutionConnected(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // ─── Carrega perfil quando o usuário loga ────────────────────
  useEffect(() => {
    if (authenticated && user) {
      loadAndApplyProfile()
    }
  }, [authenticated, user?.id])

  const loadAndApplyProfile = async () => {
    const profile = await loadUserProfile()
    if (!profile) return
    setUserProfile(profile)
    setSupabaseConnected(true)

    setSettings((prev) => ({
      ...prev,
      ai: {
        provider: (profile.ai_provider as any) || prev.ai.provider,
        apiKey: profile.ai_api_key || prev.ai.apiKey,
        model: profile.ai_model || prev.ai.model,
        ollamaUrl: profile.ollama_url || prev.ai.ollamaUrl,
      },
      telegram: { botToken: profile.telegram_bot_token || prev.telegram.botToken },
      maxGroupMembers: profile.max_group_members || prev.maxGroupMembers,
      sendIntervalMinutes: profile.send_interval_minutes || prev.sendIntervalMinutes,
    }))
  }

  const refreshProfile = async () => {
    await loadAndApplyProfile()
  }

  // ─── Persiste settings no localStorage e no Supabase ────────
  useEffect(() => {
    try {
      localStorage.setItem('afiliax_settings', JSON.stringify(settings))
    } catch {}

    if (authenticated && user) {
      saveUserProfile({
        ai_provider: settings.ai.provider,
        ai_api_key: settings.ai.apiKey,
        ai_model: settings.ai.model,
        ollama_url: settings.ai.ollamaUrl,
        telegram_bot_token: settings.telegram.botToken,
        max_group_members: settings.maxGroupMembers,
        send_interval_minutes: settings.sendIntervalMinutes,
      }).catch(() => {})
    }
  }, [settings])

  // ─── Verifica status do WhatsApp periodicamente ──────────────
  useEffect(() => {
    if (!authenticated) return

    const check = async () => {
      try {
        const status = await getConnectionStatus()
        setEvolutionConnected(status.connected)
        if (status.connected !== (userProfile?.instance_status === 'connected')) {
          await refreshProfile()
        }
      } catch {}
    }

    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [authenticated])

  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }))
  }

  return (
    <AppContext.Provider
      value={{
        settings,
        updateSettings,
        user,
        userProfile,
        refreshProfile,
        supabaseConnected,
        evolutionConnected,
        authenticated,
        setAuthenticated,
        activeTab,
        setActiveTab,
        theme,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
