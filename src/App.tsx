import React, { useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import NewPost from './pages/NewPost'
import Scheduler from './pages/Scheduler'
import Groups from './pages/Groups'
import History from './pages/History'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import Login from './pages/Login'
import Register from './pages/Register'
import './index.css'

type AuthScreen = 'login' | 'register'

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
          {pages[activeTab] || <Dashboard />}
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
