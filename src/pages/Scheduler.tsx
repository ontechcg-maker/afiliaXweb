import { useState, useEffect } from 'react'
import { Clock, Plus, Calendar, Zap, AlertTriangle, CheckCircle, Send, Trash2, Loader, RefreshCw, Edit3 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { calculateHealthScore, formatScheduleTime, loadQueue, saveQueue, syncSchedulesWithBackend, deleteBackendSchedule, updateBackendScheduleTime } from '../services/schedulerService'
import type { ScheduledPost } from '../services/schedulerService'
import { sendTextMessage, sendMediaMessage } from '../services/whatsappService'

function formatForDateTimeInput(date: Date): string {
  const d = new Date(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Scheduler() {
  const { settings, setActiveTab } = useApp()
  const [queue, setQueue] = useState<ScheduledPost[]>(loadQueue)
  const [dispatchingId, setDispatchingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDateTime, setEditDateTime] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const synced = await syncSchedulesWithBackend()
      setQueue(synced)
      setSuccessMsg('✨ Fila de agendamentos atualizada!')
      setTimeout(() => setSuccessMsg(null), 2500)
    } catch {
      setErrorMsg('Falha ao sincronizar agendamentos.')
    } finally {
      setIsSyncing(false)
    }
  }

  // Sincronização e disparo no backend ao carregar a página e a cada 15s
  useEffect(() => {
    const syncAndTrigger = async () => {
      try {
        const synced = await syncSchedulesWithBackend()
        setQueue(synced)

        const token = localStorage.getItem('afiliax_auth_token')
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        await fetch('/api/schedules/trigger-due', { method: 'POST', headers })
      } catch {}
    }

    syncAndTrigger()
    const interval = setInterval(syncAndTrigger, 15_000)

    const handleUpdate = () => {
      setQueue(loadQueue())
    }
    window.addEventListener('afiliax_queue_updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      clearInterval(interval)
      window.removeEventListener('afiliax_queue_updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  const health = calculateHealthScore(settings.sendIntervalMinutes)

  const pending = queue.filter((p) => p.status === 'pending' || (p.status as string) === 'scheduled')
  const sent = queue.filter((p) => p.status === 'sent')

  const HealthIcon = health.score === 'excellent' || health.score === 'good'
    ? CheckCircle
    : AlertTriangle

  const handleSendNow = async (post: ScheduledPost) => {
    setDispatchingId(post.id)
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      // Envia para todos os canais configurados via backend
      for (const channel of post.channels) {
        if (channel.type !== 'whatsapp') continue
        if (post.imageUrl) {
          await sendMediaMessage(channel.targetId, post.imageUrl, post.copyText, 'image')
        } else {
          await sendTextMessage(channel.targetId, post.copyText)
        }
      }
      
      const updatedQueue = queue.map((p) => (p.id === post.id ? { ...p, status: 'sent' as const } : p))
      setQueue(updatedQueue)
      saveQueue(updatedQueue)
      
      setSuccessMsg(`🚀 Oferta "${post.title.substring(0, 30)}..." enviada com sucesso!`)
    } catch (err: any) {
      setErrorMsg(`Erro ao disparar: ${err.message}`)
      const updatedQueue = queue.map((p) => (p.id === post.id ? { ...p, status: 'failed' as const } : p))
      setQueue(updatedQueue)
      saveQueue(updatedQueue)
    } finally {
      setDispatchingId(null)
    }
  }

  const handleDeletePost = async (id: string) => {
    const updatedQueue = queue.filter((p) => p.id !== id)
    setQueue(updatedQueue)
    saveQueue(updatedQueue)
    await deleteBackendSchedule(id)
  }

  const handleClearSent = () => {
    const updatedQueue = queue.filter((p) => p.status !== 'sent')
    setQueue(updatedQueue)
    saveQueue(updatedQueue)
    setSuccessMsg('🧹 Ofertas enviadas foram limpas da fila!')
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  const handleStartEditDate = (post: ScheduledPost) => {
    setEditingId(post.id)
    setEditDateTime(formatForDateTimeInput(post.scheduledAt))
  }

  const handleSaveDate = async (id: string) => {
    if (!editDateTime) return
    const newDate = new Date(editDateTime)
    const updatedQueue = queue.map((p) => (p.id === id ? { ...p, scheduledAt: newDate } : p))
    setQueue(updatedQueue)
    saveQueue(updatedQueue)
    setEditingId(null)
    await updateBackendScheduleTime(id, newDate)
    setSuccessMsg('📅 Horário de disparo atualizado com sucesso!')
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  return (
    <div
      className="animate-fade-in"
      style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', height: '100%' }}
    >
      {/* Health Score Banner */}
      <div
        style={{
          background: `${health.color}08`,
          border: `1px solid ${health.color}25`,
          borderRadius: 14,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: `${health.color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <HealthIcon size={22} color={health.color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: health.color }}>
              Health Score Anti-Spam: {health.label}
            </span>
            <span
              className="animate-pulse-glow"
              style={{ width: 8, height: 8, borderRadius: '50%', background: health.color, display: 'inline-block' }}
            />
          </div>
          <span style={{ fontSize: 12, color: '#737373' }}>{health.message}</span>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{pending.length}</p>
          <p style={{ fontSize: 11, color: '#525252' }}>na fila</p>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div
          style={{
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 10,
            padding: '12px 16px',
            fontSize: 13,
            color: '#22c55e',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle size={16} />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 10,
            padding: '12px 16px',
            fontSize: 13,
            color: '#ef4444',
          }}
        >
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: 14 }}>
        {[
          { label: 'Pendentes', value: pending.length, color: '#6366f1', icon: Clock },
          { label: 'Enviados', value: sent.length, color: '#22c55e', icon: CheckCircle },
          { label: 'Intervalo', value: `${settings.sendIntervalMinutes}min`, color: '#22d3ee', icon: Zap },
        ].map(({ label, value, color, icon: Icon }) => (
          <div
            key={label}
            className="card"
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `${color}12`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon size={18} color={color} />
            </div>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{value}</p>
              <p style={{ fontSize: 11, color: '#525252' }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Queue */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={16} color="#6366f1" />
            Fila de Envios ({queue.length})
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn-ghost"
              onClick={handleSync}
              disabled={isSyncing}
              style={{ padding: '7px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
              title="Sincronizar Fila de Agendamentos"
            >
              <RefreshCw size={13} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
            {sent.length > 0 && (
              <button
                className="btn-ghost"
                onClick={handleClearSent}
                style={{ padding: '7px 12px', fontSize: 12 }}
              >
                <RefreshCw size={13} /> Limpar Enviados ({sent.length})
              </button>
            )}
            <button
              className="btn-primary"
              onClick={() => setActiveTab('new-post')}
              style={{ padding: '7px 14px', fontSize: 12 }}
            >
              <Plus size={13} /> Nova Oferta
            </button>
          </div>
        </div>

        {queue.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: 'rgba(99,102,241,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={26} color="#6366f1" style={{ opacity: 0.4 }} />
            </div>
            <p style={{ fontSize: 14, color: '#525252', lineHeight: 1.7, maxWidth: 340 }}>
              Fila vazia. Adicione ofertas na aba{' '}
              <button
                onClick={() => setActiveTab('new-post')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#22d3ee',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  padding: 0,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Nova Oferta
              </button>{' '}
              para programar os disparos.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {queue.map((post, i) => {
              const isDispatching = dispatchingId === post.id
              const isEditing = editingId === post.id
              return (
                <div
                  key={post.id}
                  className="glass-hover"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1px solid #1e1e1e',
                    background: post.status === 'sent' ? 'rgba(34,197,94,0.03)' : 'transparent',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: post.status === 'sent' ? 'rgba(34,197,94,0.1)' : 'rgba(99,102,241,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 700,
                      color: post.status === 'sent' ? '#22c55e' : '#6366f1',
                      flexShrink: 0,
                    }}
                  >
                    {post.status === 'sent' ? '✓' : i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#e5e5e5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {post.title}
                    </p>
                    <p style={{ fontSize: 11, color: '#525252' }}>
                      {post.channels.map((c) => `${c.type === 'whatsapp' ? '📱' : '✈️'} ${c.targetName}`).join(' · ')}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {/* Edição de Horário */}
                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="datetime-local"
                          className="input-glass"
                          value={editDateTime}
                          onChange={(e) => setEditDateTime(e.target.value)}
                          style={{ padding: '4px 8px', fontSize: 12, width: 190 }}
                        />
                        <button
                          className="btn-primary"
                          onClick={() => handleSaveDate(post.id)}
                          style={{ padding: '4px 8px', fontSize: 11 }}
                        >
                          Salvar
                        </button>
                        <button
                          className="btn-ghost"
                          onClick={() => setEditingId(null)}
                          style={{ padding: '4px 6px', fontSize: 11 }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <p style={{ fontSize: 12, color: post.status === 'sent' ? '#22c55e' : '#6366f1', fontWeight: 600 }}>
                            {formatScheduleTime(post.scheduledAt)}
                          </p>
                          {post.status === 'pending' && (
                            <button
                              onClick={() => handleStartEditDate(post)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                              title="Alterar Data e Horário"
                            >
                              <Edit3 size={12} color="#737373" />
                            </button>
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            padding: '2px 7px',
                            borderRadius: 4,
                            background: post.status === 'sent'
                              ? 'rgba(34,197,94,0.1)'
                              : post.status === 'failed'
                              ? 'rgba(239,68,68,0.1)'
                              : 'rgba(234,179,8,0.1)',
                            color: post.status === 'sent' ? '#22c55e' : post.status === 'failed' ? '#ef4444' : '#eab308',
                            fontWeight: 600,
                            marginTop: 2,
                          }}
                        >
                          {post.status === 'sent' ? 'ENVIADO' : post.status === 'failed' ? 'FALHOU' : 'PENDENTE'}
                        </span>
                      </div>
                    )}

                    {post.status === 'pending' && !isEditing && (
                      <button
                        className="btn-primary"
                        onClick={() => handleSendNow(post)}
                        disabled={isDispatching}
                        style={{ padding: '6px 12px', fontSize: 12, opacity: isDispatching ? 0.6 : 1 }}
                      >
                        {isDispatching ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
                        {isDispatching ? 'Enviando...' : 'Disparar Agora'}
                      </button>
                    )}

                    <button
                      className="btn-ghost"
                      onClick={() => handleDeletePost(post.id)}
                      style={{ padding: '6px 8px', color: '#ef4444' }}
                      title="Remover da Fila"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
