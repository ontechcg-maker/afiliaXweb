import { Bell, Bot, LogOut, Sun, Moon, Crown, Zap } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { logout } from '../services/authService'

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Visão geral das suas ofertas e disparos' },
  'new-post': { title: 'Nova Oferta', subtitle: 'Adicione links e gere copys com IA' },
  scheduler: { title: 'Agendador', subtitle: 'Programe seus disparos automaticamente' },
  groups: { title: 'Grupos', subtitle: 'Gerencie seus grupos do WhatsApp e Telegram' },
  history: { title: 'Histórico', subtitle: 'Todas as ofertas enviadas' },
  settings: { title: 'Configurações', subtitle: 'Sua conta, IA, Telegram e preferências da plataforma' },
  admin: { title: 'Painel do Administrador', subtitle: 'Gestão global de clientes, conexões de WhatsApp e métricas do SaaS' },
}

export default function Header() {
  const { activeTab, settings, saasAiInfo, setAuthenticated, theme, toggleTheme, userProfile } = useApp()
  const page = PAGE_TITLES[activeTab] || { title: activeTab, subtitle: '' }
  
  const provider = saasAiInfo?.provider || settings.ai.provider || 'gemini'
  const model = saasAiInfo?.model || settings.ai.model || ''

  let aiLabel = provider.charAt(0).toUpperCase() + provider.slice(1)
  if (provider === 'gemini') {
    aiLabel = model ? `Gemini (${model.replace('gemini-', '')})` : 'Google Gemini'
  } else if (provider === 'openrouter') {
    const shortModel = model ? model.split('/')[1] || model : ''
    aiLabel = shortModel ? `OpenRouter (${shortModel.replace('-exp:free', '').replace(':free', '')})` : 'OpenRouter'
  } else if (provider === 'openai') {
    aiLabel = model ? `OpenAI (${model})` : 'OpenAI'
  } else if (provider === 'ollama') {
    aiLabel = 'Ollama (Local)'
  }

  const userPlan = userProfile?.role === 'admin' ? 'ADMIN' : ((userProfile as any)?.plan_tier || 'FREE').toUpperCase()
  const planColor = userPlan === 'ADMIN' ? '#6366f1' : userPlan === 'AGENCY' ? '#eab308' : userPlan === 'PRO' ? '#22c55e' : '#a3a3a3'

  const handleLogout = () => {
    logout()
    setAuthenticated(false)
  }

  return (
    <header
      style={{
        height: 64,
        background: 'var(--bg-header)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 28px',
        gap: 16,
        flexShrink: 0,
        transition: 'background 0.3s ease, border-color 0.3s ease',
      }}
    >
      {/* Page title */}
      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
          {page.title}
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{page.subtitle}</p>
      </div>

      {/* Plan Badge */}
      <div
        title={`Seu Plano Atual: ${userPlan}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 8,
          background: `${planColor}15`,
          border: `1px solid ${planColor}30`,
        }}
      >
        {userPlan === 'ADMIN' || userPlan === 'AGENCY' ? (
          <Crown size={13} color={planColor} />
        ) : (
          <Zap size={13} color={planColor} />
        )}
        <span style={{ fontSize: 11, color: planColor, fontWeight: 700, letterSpacing: '0.04em' }}>
          {userPlan}
        </span>
      </div>

      {/* AI Provider Badge */}
      <div
        title={`Inteligência Artificial ativa no SaaS: ${aiLabel}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 8,
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
        }}
      >
        <Bot size={13} color="#6366f1" />
        <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>{aiLabel}</span>
      </div>

      {/* Toggle Theme (Sun / Moon) */}
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          border: '1px solid var(--border-color)',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.color = '#22d3ee'
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#22d3ee'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-color)'
        }}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* Logout */}
      <button
        onClick={handleLogout}
        title="Sair"
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          border: '1px solid var(--border-color)',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#ef4444')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)')}
      >
        <LogOut size={16} />
      </button>

      {/* Notifications */}
      <button
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          border: '1px solid var(--border-color)',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          position: 'relative',
        }}
      >
        <Bell size={16} />
      </button>
    </header>
  )
}
