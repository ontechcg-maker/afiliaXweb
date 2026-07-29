import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, QrCode, Loader, Users, LogOut, Wifi, WifiOff, Smartphone } from 'lucide-react'
import { useApp } from '../context/AppContext'
import {
  connectWhatsApp,
  getConnectionStatus,
  disconnectWhatsApp,
  getGroups,
  type WhatsAppGroup,
} from '../services/whatsappService'

export default function Groups() {
  const { userProfile, refreshProfile } = useApp()
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>(
    userProfile?.instance_status === 'connected' ? 'connected' : 'disconnected'
  )
  const [qrCode, setQrCode] = useState<string>('')
  const [groups, setGroups] = useState<WhatsAppGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true)
    try {
      const list = await getGroups()
      setGroups(list)
    } catch {
      setGroups([])
    } finally {
      setLoadingGroups(false)
    }
  }, [])

  const checkStatus = useCallback(async () => {
    try {
      const res = await getConnectionStatus()
      setStatus(res.connected ? 'connected' : 'disconnected')
      if (res.connected && groups.length === 0) {
        await loadGroups()
      }
    } catch {
      setStatus('disconnected')
    }
  }, [groups.length, loadGroups])

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  // Verifica status inicial
  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  // Polling quando está conectando (esperando QR Code ser escaneado)
  useEffect(() => {
    if (status === 'connecting') {
      pollingRef.current = setInterval(async () => {
        const res = await getConnectionStatus()
        if (res.connected) {
          setStatus('connected')
          setQrCode('')
          clearPolling()
          await refreshProfile()
          await loadGroups()
        }
      }, 3000)
    } else {
      clearPolling()
    }
    return clearPolling
  }, [status, refreshProfile, loadGroups, clearPolling])

  const handleConnect = async () => {
    setLoading(true)
    setError(null)
    setStatus('connecting')
    try {
      const { qrCode: qr } = await connectWhatsApp()
      if (!qr) {
        throw new Error('QR Code não retornado. Tente novamente.')
      }
      setQrCode(qr)
    } catch (e: any) {
      setError(e.message || 'Erro ao conectar. Verifique se a Evolution API está configurada no servidor.')
      setStatus('disconnected')
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    setLoading(true)
    try {
      await disconnectWhatsApp()
      setStatus('disconnected')
      setGroups([])
      setQrCode('')
      await refreshProfile()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const instanceName = userProfile?.instance_name || '–'
  const whatsappNumber = userProfile?.whatsapp_number

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 28 }}>
      {/* Status Card */}
      <div className="card animate-fade-in" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: 14,
              background: status === 'connected' ? 'rgba(34,197,94,0.15)' : status === 'connecting' ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${status === 'connected' ? 'rgba(34,197,94,0.3)' : status === 'connecting' ? 'rgba(234,179,8,0.3)' : 'rgba(239,68,68,0.2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {status === 'connected' ? <Wifi size={22} color="#22c55e" />
              : status === 'connecting' ? <Loader size={22} color="#eab308" style={{ animation: 'spin 1s linear infinite' }} />
              : <WifiOff size={22} color="#ef4444" />}
          </div>

          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 2 }}>
              {status === 'connected' ? '✅ WhatsApp Conectado' : status === 'connecting' ? '⏳ Aguardando QR Code...' : '❌ WhatsApp Desconectado'}
            </p>
            <p style={{ fontSize: 12, color: '#525252' }}>
              Instância: <code style={{ color: '#737373' }}>{instanceName}</code>
              {whatsappNumber && <span style={{ marginLeft: 8, color: '#22c55e' }}>• {whatsappNumber}</span>}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" onClick={checkStatus} title="Atualizar status">
              <RefreshCw size={14} />
            </button>
            {status === 'connected' ? (
              <button
                className="btn-ghost"
                onClick={handleDisconnect}
                disabled={loading}
                style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
              >
                <LogOut size={14} /> Desconectar
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={loading || status === 'connecting'}
                style={{
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  border: 'none', borderRadius: 8, color: '#fff',
                  padding: '8px 16px', fontSize: 13, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <Smartphone size={14} />
                {loading ? 'Gerando QR...' : 'Conectar WhatsApp'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>⚠️ {error}</p>
          </div>
        )}
      </div>

      {/* QR Code */}
      {qrCode && status === 'connecting' && (
        <div className="card animate-fade-in" style={{ marginBottom: 20, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <QrCode size={18} color="#22c55e" />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Escaneie com seu WhatsApp</h3>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ padding: 16, background: '#fff', borderRadius: 16, display: 'inline-block' }}>
              <img src={qrCode} alt="QR Code WhatsApp" style={{ width: 240, height: 240, display: 'block' }} />
            </div>
          </div>
          <p style={{ color: '#525252', fontSize: 12, marginTop: 16 }}>
            WhatsApp → Aparelhos Conectados → Conectar um aparelho
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}>
            <Loader size={12} color="#eab308" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ color: '#eab308', fontSize: 12 }}>Aguardando conexão...</span>
          </div>
        </div>
      )}

      {/* Lista de Grupos */}
      {status === 'connected' && (
        <div className="card animate-fade-in">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Users size={16} color="#6366f1" />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                Seus Grupos ({groups.length})
              </h3>
            </div>
            <button className="btn-ghost" onClick={loadGroups} disabled={loadingGroups}>
              <RefreshCw size={14} style={{ animation: loadingGroups ? 'spin 1s linear infinite' : undefined }} />
              Atualizar
            </button>
          </div>

          {loadingGroups ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#525252' }}>
              <Loader size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px', display: 'block' }} />
              <p style={{ fontSize: 13 }}>Carregando grupos...</p>
            </div>
          ) : groups.length === 0 ? (
            <p style={{ color: '#525252', fontSize: 13, textAlign: 'center', padding: 40 }}>
              Nenhum grupo encontrado. Certifique-se de que o WhatsApp está em pelo menos 1 grupo.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {groups.map((g) => (
                <div
                  key={g.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={16} color="#6366f1" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{g.name}</p>
                    <p style={{ fontSize: 11, color: '#525252' }}>{g.memberCount} membros</p>
                  </div>
                  {g.isAdmin && (
                    <span style={{ fontSize: 10, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(34,197,94,0.2)' }}>
                      Admin
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
