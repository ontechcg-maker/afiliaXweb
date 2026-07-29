import React, { useState, useEffect } from 'react'
import { Send, Clock, CheckCircle, TrendingUp, Zap, AlertTriangle, MousePointerClick } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { loadQueue, type ScheduledPost } from '../services/schedulerService'
import { getGroups } from '../services/whatsappService'
import { fetchClickAnalyticsSummary } from '../services/linkShortenerService'

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  subtext,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  color: string
  subtext?: string
}) {
  return (
    <div className="card" style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{label}</p>
          <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{value}</p>
          {subtext && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{subtext}</p>}
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={20} color={color} />
        </div>
      </div>
    </div>
  )
}

function QuickActionCard({
  emoji,
  title,
  desc,
  tab,
}: {
  emoji: string
  title: string
  desc: string
  tab: string
}) {
  const { setActiveTab } = useApp()
  return (
    <button
      onClick={() => setActiveTab(tab)}
      className="card glass-hover"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 24 }}>{emoji}</span>
      <div>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{title}</h4>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</p>
      </div>
    </button>
  )
}

export default function Dashboard() {
  const { supabaseConnected, evolutionConnected } = useApp()

  const [stats, setStats] = useState({
    sentToday: 0,
    pendingCount: 0,
    sentThisMonth: 0,
    activeGroups: 0,
    totalClicks: 0,
  })

  const loadDashboardMetrics = async () => {
    const queue: ScheduledPost[] = loadQueue()
    const now = new Date()

    const todayStr = now.toDateString()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const sentToday = queue.filter((p) => {
      if (p.status !== 'sent') return false
      const d = new Date(p.scheduledAt)
      return d.toDateString() === todayStr
    }).length

    const pendingCount = queue.filter((p) => p.status === 'pending').length

    const sentThisMonth = queue.filter((p) => {
      if (p.status !== 'sent') return false
      const d = new Date(p.scheduledAt)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    }).length

    let activeGroups = 0
    try {
      const groups = await getGroups()
      activeGroups = groups.length
    } catch {}

    const analytics = await fetchClickAnalyticsSummary()

    setStats({
      sentToday,
      pendingCount,
      sentThisMonth,
      activeGroups,
      totalClicks: analytics.totalClicks || 0,
    })
  }

  useEffect(() => {
    loadDashboardMetrics()

    const handleUpdate = () => loadDashboardMetrics()
    window.addEventListener('afiliax_queue_updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)

    return () => {
      window.removeEventListener('afiliax_queue_updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  return (
    <div
      className="animate-fade-in"
      style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', height: '100%' }}
    >
      {/* Welcome Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(34,211,238,0.08), rgba(99,102,241,0.08))',
          border: '1px solid rgba(34,211,238,0.15)',
          borderRadius: 16,
          padding: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            Bem-vindo ao <span className="gradient-text">AfiliaX</span> 👋
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 480 }}>
            Seu sistema inteligente de divulgação de afiliados. Cadastre links, gere copys com IA e dispare para seus grupos automaticamente.
          </p>
        </div>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #22d3ee, #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Zap size={28} color="white" />
        </div>
      </div>

      {/* Config Alerts */}
      {!supabaseConnected && (
        <div
          style={{
            background: 'rgba(234, 179, 8, 0.06)',
            border: '1px solid rgba(234,179,8,0.2)',
            borderRadius: 12,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <AlertTriangle size={18} color="#eab308" />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Supabase não configurado.{' '}
            <span style={{ color: '#eab308', fontWeight: 600 }}>Vá em Configurações</span> para conectar seu banco de dados.
          </span>
        </div>
      )}

      {/* Stats Grid */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <StatCard
          icon={Send}
          label="Ofertas Enviadas Hoje"
          value={stats.sentToday}
          color="#22d3ee"
          subtext={stats.sentToday > 0 ? `${stats.sentToday} disparados hoje` : 'Nenhum disparo hoje'}
        />
        <StatCard
          icon={MousePointerClick}
          label="Cliques em Links"
          value={stats.totalClicks}
          color="#818cf8"
          subtext={stats.totalClicks > 0 ? `${stats.totalClicks} acessos registrados` : 'Rastreamento ativo'}
        />
        <StatCard
          icon={Clock}
          label="Agendadas"
          value={stats.pendingCount}
          color="#6366f1"
          subtext={stats.pendingCount > 0 ? `${stats.pendingCount} na fila` : 'Fila vazia'}
        />
        <StatCard
          icon={CheckCircle}
          label="Total Este Mês"
          value={stats.sentThisMonth}
          color="#22c55e"
          subtext={`${stats.sentThisMonth} ofertas enviadas`}
        />
        <StatCard
          icon={TrendingUp}
          label="Grupos Ativos"
          value={stats.activeGroups}
          color="#f59e0b"
          subtext={evolutionConnected ? `${stats.activeGroups} grupos vinculados` : 'Conecte o WhatsApp'}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Ações Rápidas
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <QuickActionCard
            emoji="🔗"
            title="Nova Oferta"
            desc="Cole um link e gere copy com IA"
            tab="new-post"
          />
          <QuickActionCard
            emoji="📅"
            title="Agendador"
            desc="Programe os próximos disparos"
            tab="scheduler"
          />
          <QuickActionCard
            emoji="👥"
            title="Grupos"
            desc="Gerencie seus grupos do WhatsApp"
            tab="groups"
          />
        </div>
      </div>

      {/* Status Panel */}
      <div className="card">
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Status das Integrações
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Supabase (Banco de Dados)</span>
            <span style={{ fontSize: 12, color: supabaseConnected ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
              {supabaseConnected ? '● Conectado' : '○ Desconectado'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>WhatsApp (Evolution API)</span>
            <span style={{ fontSize: 12, color: evolutionConnected ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
              {evolutionConnected ? '● Conectado' : '○ Desconectado'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
