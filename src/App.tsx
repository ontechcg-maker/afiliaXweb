import React, { useState, lazy, Suspense } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Login from './pages/Login'
import Register from './pages/Register'
import './index.css'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const NewPost = lazy(() => import('./pages/NewPost'))
const Scheduler = lazy(() => import('./pages/Scheduler'))
const Groups = lazy(() => import('./pages/Groups'))
const History = lazy(() => import('./pages/History'))
const Settings = lazy(() => import('./pages/Settings'))
const Admin = lazy(() => import('./pages/Admin'))

type AuthScreen = 'login' | 'register'

function LoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        color: 'var(--text-muted)',
        fontSize: 14,
        gap: 8,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          border: '2px solid var(--border-color, #333)',
          borderTopColor: 'var(--accent-color, #6366f1)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <span>Carregando página...</span>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught Error:', error, errorInfo)
  }

  handleReset = () => {
    try {
      localStorage.removeItem('afiliax_queue')
    } catch {}
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            width: '100vw',
            background: 'var(--bg-main, #0f172a)',
            color: 'var(--text-primary, #f8fafc)',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 16,
              padding: '32px 40px',
              maxWidth: 480,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div style={{ fontSize: 40 }}>⚠️</div>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Ops! Algo deu errado ao carregar a página</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted, #94a3b8)', lineHeight: 1.5 }}>
              Ocorreu um erro inesperado de renderização. Clique abaixo para restaurar o sistema e recarregar.
            </p>
            <button
              onClick={this.handleReset}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #22d3ee)',
                border: 'none',
                color: '#fff',
                fontWeight: 600,
                padding: '12px 24px',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 14,
                marginTop: 8,
              }}
            >
              🔄 Recarregar Sistema
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function renderActivePage(tab: string) {
  switch (tab) {
    case 'dashboard':
      return <Dashboard />
    case 'new-post':
      return <NewPost />
    case 'scheduler':
      return <Scheduler />
    case 'groups':
      return <Groups />
    case 'history':
      return <History />
    case 'settings':
      return <Settings />
    case 'admin':
      return <Admin />
    default:
      return <Dashboard />
  }
}

function AppContent() {
  const { activeTab, authenticated, setAuthenticated } = useApp()
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login')

  if (!authenticated) {
    if (authScreen === 'register') {
      return (
        <Register
          onSuccess={() => setAuthenticated(true)}
          onGoToLogin={() => setAuthScreen('login')}
        />
      )
    }
    return (
      <Login
        onSuccess={() => setAuthenticated(true)}
        onGoToRegister={() => setAuthScreen('register')}
      />
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        background: 'var(--bg-main)',
        overflow: 'hidden',
        transition: 'background 0.3s ease',
      }}
    >
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header />
        <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              {renderActivePage(activeTab)}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  )
}
