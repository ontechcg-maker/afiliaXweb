import { useState, useEffect } from 'react'
import { History as HistoryIcon, Search, Copy, Check, Trash2, RotateCcw, CheckCircle, Clock, AlertTriangle, Send, RefreshCw } from 'lucide-react'
import { loadQueue, saveQueue, formatScheduleTime, type ScheduledPost } from '../services/schedulerService'
import { getSupabaseClient } from '../services/supabaseClient'
import { useApp } from '../context/AppContext'

function getDeletedHistoryIds(): string[] {
  try {
    const raw = localStorage.getItem('afiliax_deleted_history')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveDeletedHistoryIds(ids: string[]): void {
  try {
    localStorage.setItem('afiliax_deleted_history', JSON.stringify(ids))
  } catch {}
}

export default function History() {
  const { setActiveTab } = useApp()
  const [historyList, setHistoryList] = useState<ScheduledPost[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterChannel, setFilterChannel] = useState<'all' | 'whatsapp' | 'telegram'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'sent' | 'failed'>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const loadHistoryData = async () => {
    const deletedIds = getDeletedHistoryIds()
    const localQueue = loadQueue()
    const pastItems = localQueue.filter((p) => (p.status === 'sent' || p.status === 'failed') && !deletedIds.includes(p.id))

    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        const { data } = await supabase.from('offers').select('*').order('created_at', { ascending: false })
        if (data && data.length > 0) {
          const supabasePosts: ScheduledPost[] = data
            .filter((item: any) => !deletedIds.includes(String(item.id)))
            .map((item: any) => ({
              id: String(item.id),
              offerId: String(item.id),
              title: item.title || 'Oferta do Histórico',
              copyText: item.copy_text || '',
              imageUrl: item.image_url || undefined,
              affiliateLink: item.affiliate_link || item.url || '',
              channels: [{ type: 'whatsapp', targetId: 'all', targetName: 'Todos os Grupos' }],
              scheduledAt: new Date(item.created_at || Date.now()),
              status: item.status === 'sent' ? 'sent' : 'sent',
            }))

          const merged = [...pastItems]
          supabasePosts.forEach((sp) => {
            if (!merged.some((mp) => mp.id === sp.id)) {
              merged.push(sp)
            }
          })
          setHistoryList(merged.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()))
          return
        }
      } catch {}
    }

    setHistoryList(pastItems.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()))
  }

  useEffect(() => {
    loadHistoryData()
    const handleUpdate = () => loadHistoryData()
    window.addEventListener('afiliax_queue_updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('afiliax_queue_updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDeleteItem = async (id: string) => {
    // 1. Atualiza lista deletada persistente
    const deletedIds = getDeletedHistoryIds()
    if (!deletedIds.includes(id)) {
      deletedIds.push(id)
      saveDeletedHistoryIds(deletedIds)
    }

    // 2. Remove da fila local
    const fullQueue = loadQueue().filter((item) => item.id !== id)
    saveQueue(fullQueue)

    // 3. Atualiza estado da tela
    setHistoryList((prev) => prev.filter((item) => item.id !== id))

    // 4. Remove do Supabase se conectado
    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        await supabase.from('offers').delete().eq('id', id)
      } catch {}
    }

    setSuccessMsg('🗑️ Oferta removida do histórico com sucesso.')
    setTimeout(() => setSuccessMsg(null), 2500)
  }

  const handleClearAllHistory = async () => {
    if (!window.confirm('Tem certeza que deseja apagar todo o histórico de ofertas disparadas?')) return

    const deletedIds = getDeletedHistoryIds()
    historyList.forEach((item) => {
      if (!deletedIds.includes(item.id)) deletedIds.push(item.id)
    })
    saveDeletedHistoryIds(deletedIds)

    // Mantém apenas pendentes na fila
    const pendingOnly = loadQueue().filter((item) => item.status === 'pending')
    saveQueue(pendingOnly)
    setHistoryList([])

    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        await supabase.from('offers').delete().neq('status', 'pending')
      } catch {}
    }

    setSuccessMsg('🧹 Todo o histórico de disparos foi limpo!')
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  const handleReuseOffer = (post: ScheduledPost) => {
    try {
      localStorage.setItem(
        'afiliax_draft_reuse',
        JSON.stringify({
          url: post.affiliateLink,
          title: post.title,
          copyText: post.copyText,
          imageUrl: post.imageUrl,
        })
      )
      window.dispatchEvent(new Event('afiliax_load_reused_offer'))
    } catch {}

    setSuccessMsg('🔄 Oferta carregada em Nova Oferta!')
    setTimeout(() => {
      setSuccessMsg(null)
      setActiveTab('new-post')
    }, 400)
  }

  const filteredItems = historyList.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.copyText.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesChannel =
      filterChannel === 'all' || item.channels.some((c) => c.type === filterChannel)

    const matchesStatus = filterStatus === 'all' || item.status === filterStatus

    return matchesSearch && matchesChannel && matchesStatus
  })

  const totalSent = historyList.filter((h) => h.status === 'sent').length
  const totalFailed = historyList.filter((h) => h.status === 'failed').length
  const successRate = historyList.length > 0 ? Math.round((totalSent / historyList.length) * 100) : 100

  return (
    <div
      className="animate-fade-in page-container"
      style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', height: '100%' }}
    >
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
      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
        {[
          { label: 'Total Enviados', value: totalSent, color: '#22c55e', icon: CheckCircle },
          { label: 'Taxa de Sucesso', value: `${successRate}%`, color: '#22d3ee', icon: HistoryIcon },
          { label: 'Falhas no Envio', value: totalFailed, color: '#ef4444', icon: AlertTriangle },
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

      {/* Filters Bar */}
      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#525252' }} />
          <input
            className="input-glass"
            placeholder="Buscar por produto ou palavra da copy..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>

        <select
          value={filterChannel}
          onChange={(e) => setFilterChannel(e.target.value as any)}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            color: '#f5f5f5',
            padding: '10px 14px',
            fontFamily: 'Inter, sans-serif',
            fontSize: 13,
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="all" style={{ background: '#111' }}>🌐 Todos os Canais</option>
          <option value="whatsapp" style={{ background: '#111' }}>📱 WhatsApp</option>
          <option value="telegram" style={{ background: '#111' }}>✈️ Telegram</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            color: '#f5f5f5',
            padding: '10px 14px',
            fontFamily: 'Inter, sans-serif',
            fontSize: 13,
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="all" style={{ background: '#111' }}>Status: Todos</option>
          <option value="sent" style={{ background: '#111' }}>✅ Enviados</option>
          <option value="failed" style={{ background: '#111' }}>⚠️ Falhas</option>
        </select>

        {historyList.length > 0 && (
          <button
            className="btn-ghost"
            onClick={handleClearAllHistory}
            style={{ padding: '10px 14px', fontSize: 12, color: '#ef4444', whiteSpace: 'nowrap' }}
          >
            <RefreshCw size={13} /> Limpar Histórico
          </button>
        )}
      </div>

      {/* History List */}
      <div className="card">
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <HistoryIcon size={16} color="#22d3ee" />
          Registros de Disparos ({filteredItems.length})
        </h3>

        {filteredItems.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '50px 0',
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
                background: 'rgba(34,211,238,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <HistoryIcon size={26} color="#22d3ee" style={{ opacity: 0.4 }} />
            </div>
            <p style={{ fontSize: 14, color: '#525252', lineHeight: 1.7, maxWidth: 360 }}>
              Nenhum disparo encontrado no histórico com esses filtros.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredItems.map((post) => {
              const isCopied = copiedId === post.id
              const isVideo = post.imageUrl && (
                post.imageUrl.startsWith('data:video/') ||
                post.imageUrl.endsWith('.mp4') ||
                post.imageUrl.endsWith('.webm') ||
                post.imageUrl.endsWith('.mov')
              )
              return (
                <div
                  key={post.id}
                  className="glass-hover"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    padding: 16,
                    borderRadius: 12,
                    border: '1px solid #1e1e1e',
                    background: 'rgba(255,255,255,0.01)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    {post.imageUrl ? (
                      isVideo ? (
                        <video
                          src={post.imageUrl}
                          controls
                          style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 8, border: '1px solid #2a2a2a' }}
                        />
                      ) : (
                        <img
                          src={post.imageUrl}
                          alt="Produto"
                          style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 8, border: '1px solid #2a2a2a' }}
                        />
                      )
                    ) : (
                      <div
                        style={{
                          width: 54,
                          height: 54,
                          borderRadius: 8,
                          background: 'rgba(255,255,255,0.03)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid #2a2a2a',
                        }}
                      >
                        <Send size={20} color="#525252" />
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                          {post.title}
                        </h4>
                        <span
                          style={{
                            fontSize: 10,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: post.status === 'sent' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                            color: post.status === 'sent' ? '#22c55e' : '#ef4444',
                            fontWeight: 700,
                          }}
                        >
                          {post.status === 'sent' ? 'ENVIADO' : 'FALHOU'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11, color: '#737373', flexWrap: 'wrap' }}>
                        <span>
                          <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                          {formatScheduleTime(post.scheduledAt)}
                        </span>
                        <span>•</span>
                        <span>
                          {post.channels.map((c) => `${c.type === 'whatsapp' ? '📱' : '✈️'} ${c.targetName}`).join(' · ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Copy Preview Box */}
                  <div
                    style={{
                      background: '#080808',
                      border: '1px solid #1a1a1a',
                      borderRadius: 8,
                      padding: '10px 12px',
                      fontSize: 12,
                      color: '#a3a3a3',
                      whiteSpace: 'pre-wrap',
                      maxHeight: 90,
                      overflowY: 'auto',
                    }}
                  >
                    {post.copyText}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn-ghost"
                        onClick={() => handleCopyText(post.id, post.copyText)}
                        style={{ padding: '5px 10px', fontSize: 11 }}
                      >
                        {isCopied ? <Check size={12} color="#22c55e" /> : <Copy size={12} />}
                        {isCopied ? 'Copiado!' : 'Copiar Copy'}
                      </button>
                      <button
                        className="btn-ghost"
                        onClick={() => handleReuseOffer(post)}
                        style={{ padding: '5px 10px', fontSize: 11, color: '#22d3ee' }}
                      >
                        <RotateCcw size={12} />
                        Reutilizar Oferta
                      </button>
                    </div>

                    <button
                      className="btn-ghost"
                      onClick={() => handleDeleteItem(post.id)}
                      style={{ padding: '5px 8px', color: '#ef4444', fontSize: 11 }}
                      title="Excluir do Histórico"
                    >
                      <Trash2 size={12} /> Excluir
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
