import {
  LayoutDashboard,
  PlusCircle,
  Clock,
  History,
  Users,
  Settings,
  Zap,
  ChevronRight,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { APP_VERSION } from '../version'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'new-post', label: 'Nova Oferta', icon: PlusCircle },
  { id: 'scheduler', label: 'Agendador', icon: Clock },
  { id: 'groups', label: 'Grupos', icon: Users },
  { id: 'history', label: 'Histórico', icon: History },
]

export default function Sidebar() {
  const { activeTab, setActiveTab, supabaseConnected, evolutionConnected, userProfile, isMobileMenuOpen, closeMobileMenu } = useApp()
  const isAdmin = userProfile?.role === 'admin' || !userProfile?.role // Mostra por padrão se for admin ou se ainda não definiu role

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={closeMobileMenu}
        />
      )}

      <aside
        className={`sidebar-aside ${isMobileMenuOpen ? 'open' : ''}`}
        style={{
          width: 220,
          minWidth: 220,
          background: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 0',
          gap: 4,
          transition: 'background 0.3s ease, border-color 0.3s ease, transform 0.3s ease',
        }}
      >
        {/* Logo & Mobile Close */}
        <div style={{ padding: '0 20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #22d3ee, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Zap size={18} color="white" />
            </div>
            <span
              style={{
                fontSize: 20,
                fontWeight: 800,
                background: 'linear-gradient(135deg, #22d3ee, #6366f1)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              AfiliaX
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 6,
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}
            >
              v{APP_VERSION}
            </span>
          </div>

          {/* Close button inside sidebar on mobile */}
          <button
            onClick={closeMobileMenu}
            className="sidebar-close-btn"
            title="Fechar Menu"
            aria-label="Fechar Menu Lateral"
          >
            <X size={20} color="var(--text-muted)" />
          </button>
        </div>

      {/* Nav Section Header */}
      <div style={{ padding: '0 20px 8px' }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Menu Principal
        </p>
      </div>

      {/* Nav Items */}
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = activeTab === item.id
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 20px',
              width: '100%',
              background: isActive ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
              border: 'none',
              borderLeft: isActive ? '3px solid #6366f1' : '3px solid transparent',
              cursor: 'pointer',
              color: isActive ? '#6366f1' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              textAlign: 'left',
              transition: 'all 0.15s ease',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <Icon size={16} color={isActive ? '#6366f1' : 'var(--text-secondary)'} />
            <span style={{ flex: 1 }}>{item.label}</span>
            {isActive && <ChevronRight size={14} color="#6366f1" />}
          </button>
        )
      })}

      <div style={{ flex: 1 }} />

      {/* Footer Nav / Status */}
      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Admin Panel button (Apenas para administradores do SaaS) */}
        {isAdmin && (
          <button
            onClick={() => setActiveTab('admin')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              width: '100%',
              background: activeTab === 'admin' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.06)',
              border: activeTab === 'admin' ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(99, 102, 241, 0.15)',
              borderRadius: 8,
              cursor: 'pointer',
              color: activeTab === 'admin' ? '#818cf8' : '#6366f1',
              fontSize: 13,
              fontWeight: activeTab === 'admin' ? 700 : 500,
              textAlign: 'left',
              fontFamily: 'Inter, sans-serif',
              marginBottom: 4,
            }}
          >
            <ShieldCheck size={16} color={activeTab === 'admin' ? '#818cf8' : '#6366f1'} />
            <span>Painel Admin</span>
          </button>
        )}

        {/* Settings button */}
        <button
          onClick={() => setActiveTab('settings')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            width: '100%',
            background: activeTab === 'settings' ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            color: activeTab === 'settings' ? '#6366f1' : 'var(--text-secondary)',
            fontSize: 13,
            fontWeight: activeTab === 'settings' ? 600 : 400,
            textAlign: 'left',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <Settings size={16} color={activeTab === 'settings' ? '#6366f1' : 'var(--text-secondary)'} />
          <span>Configurações</span>
        </button>

        {/* Status Indicators */}
        <div
          style={{
            marginTop: 8,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'var(--item-hover)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Supabase</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: supabaseConnected ? '#22c55e' : '#ef4444',
                  boxShadow: supabaseConnected ? '0 0 6px #22c55e' : 'none',
                }}
              />
              <span style={{ fontSize: 10, color: supabaseConnected ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                {supabaseConnected ? 'OK' : 'Off'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>WhatsApp</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: evolutionConnected ? '#22c55e' : '#ef4444',
                  boxShadow: evolutionConnected ? '0 0 6px #22c55e' : 'none',
                }}
              />
              <span style={{ fontSize: 10, color: evolutionConnected ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                {evolutionConnected ? 'OK' : 'Off'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </>
  )
}
