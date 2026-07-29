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

  const pages: Record<string, React.ReactNode> = {
    dashboard: <Dashboard />,
    'new-post': <NewPost />,
    scheduler: <Scheduler />,
    groups: <Groups />,
    history: <History />,
    settings: <Settings />,
    admin: <Admin />,
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
          <Suspense fallback={<LoadingFallback />}>
            {pages[activeTab] || <Dashboard />}
          </Suspense>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
