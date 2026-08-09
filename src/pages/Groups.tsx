import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, QrCode, Loader, Users, LogOut, Wifi, WifiOff, Smartphone, Plus, Trash2, Send, MessageSquare, CheckCircle, Copy, Link } from 'lucide-react'
import { useApp } from '../context/AppContext'
import {
  connectWhatsApp,
  getConnectionStatus,
  disconnectWhatsApp,
  getGroups,
  createWhatsAppGroup,
  type WhatsAppGroup,
} from '../services/whatsappService'
import {
  getDiscordChannels,
  saveDiscordChannel,
  deleteDiscordChannel,
  sendDiscordMessage,
  type DiscordChannel,
} from '../services/discordService'
import {
  getInstagramStatus,
  connectInstagram,
  disconnectInstagram,
  type InstagramAccountStatus,
} from '../services/instagramService'

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

  // WhatsApp Group Creation State
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [newGroupParticipants, setNewGroupParticipants] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [groupSuccessMsg, setGroupSuccessMsg] = useState<{ name: string; inviteLink?: string } | null>(null)
  const [groupErrorMsg, setGroupErrorMsg] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null)


  // Discord State
  const [discordChannels, setDiscordChannels] = useState<DiscordChannel[]>(() => getDiscordChannels())
  const [showAddDiscord, setShowAddDiscord] = useState(false)
  const [newDiscordName, setNewDiscordName] = useState('')
  const [newDiscordWebhook, setNewDiscordWebhook] = useState('')
  const [testingDiscordId, setTestingDiscordId] = useState<string | null>(null)
  const [discordStatusMsg, setDiscordStatusMsg] = useState<{ id?: string; text: string; success: boolean } | null>(null)

  // Instagram State
  const [igStatus, setIgStatus] = useState<InstagramAccountStatus>({
    connected: !!userProfile?.instagram_connected,
    username: userProfile?.instagram_username || null,
    accountId: userProfile?.instagram_account_id || null,
  })
  const [showConnectIg, setShowConnectIg] = useState(false)
  const [igAccountId, setIgAccountId] = useState('')
  const [igAccessToken, setIgAccessToken] = useState('')
  const [loadingIg, setLoadingIg] = useState(false)
  const [igError, setIgError] = useState<string | null>(null)
  const [igSuccess, setIgSuccess] = useState<string | null>(null)

  const checkIgStatus = async () => {
    try {
      const res = await getInstagramStatus()
      setIgStatus(res)
    } catch {}
  }

  useEffect(() => {
    checkIgStatus()
  }, [])

  const handleConnectIg = async () => {
    if (!igAccountId.trim() || !igAccessToken.trim()) return
    setLoadingIg(true)
    setIgError(null)
    setIgSuccess(null)
    try {
      const res = await connectInstagram({
        accountId: igAccountId.trim(),
        accessToken: igAccessToken.trim(),
      })
      if (res.success && res.account) {
        setIgSuccess(`✅ Conectado com sucesso à conta @${res.account.username}!`)
        setIgStatus({ connected: true, username: res.account.username, accountId: res.account.id })
        setShowConnectIg(false)
        setIgAccountId('')
        setIgAccessToken('')
        refreshProfile()
      }
    } catch (e: any) {
      setIgError(e.message || 'Erro ao conectar conta do Instagram.')
    } finally {
      setLoadingIg(false)
    }
  }

  const handleDisconnectIg = async () => {
    setLoadingIg(true)
    try {
      await disconnectInstagram()
      setIgStatus({ connected: false })
      refreshProfile()
    } catch {} finally {
      setLoadingIg(false)
    }
  }

  const handleCreateWhatsAppGroup = async () => {
    if (!newGroupName.trim()) return
    setCreatingGroup(true)
    setGroupErrorMsg(null)
    setGroupSuccessMsg(null)
    try {
      const participantsList = newGroupParticipants
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length >= 10)

      const result = await createWhatsAppGroup({
        name: newGroupName.trim(),
        description: newGroupDesc.trim() || undefined,
        participants: participantsList.length > 0 ? participantsList : undefined,
      })

      if (result.success && result.group) {
        setGroupSuccessMsg({
          name: result.group.name,
          inviteLink: result.group.inviteLink,
        })
        setNewGroupName('')
        setNewGroupDesc('')
        setNewGroupParticipants('')
        setShowCreateGroup(false)
        await loadGroups()
      } else {
        setGroupErrorMsg(result.error || 'Erro ao criar grupo no WhatsApp.')
      }
    } catch (e: any) {
      setGroupErrorMsg(e.message || 'Falha de conexão ao criar grupo.')
    } finally {
      setCreatingGroup(false)
    }
  }

  const handleAddDiscord = () => {
    if (!newDiscordName.trim() || !newDiscordWebhook.trim()) return
    const updated = saveDiscordChannel({ name: newDiscordName, webhookUrl: newDiscordWebhook, isActive: true })
    setDiscordChannels(updated)
    setNewDiscordName('')
    setNewDiscordWebhook('')
    setShowAddDiscord(false)
  }

  const handleDeleteDiscord = (id: string) => {
    const updated = deleteDiscordChannel(id)
    setDiscordChannels(updated)
  }

  const handleTestDiscord = async (channel: DiscordChannel) => {
    setTestingDiscordId(channel.id)
    setDiscordStatusMsg(null)
    const result = await sendDiscordMessage(channel.webhookUrl, {
      title: '🎮 Teste de Integração AfiliaX',
      priceFrom: 299.90,
      priceTo: 199.90,
      discountPct: 33,
      coupon: 'AFILIAX10',
      affiliateLink: 'https://afiliax.app',
      copyText: '🔥 **Teste do Webhook do Discord realizado com sucesso!**\nSua oferta foi formatada e enviada via Rich Embed.',
    })
    setTestingDiscordId(null)
    setDiscordStatusMsg({ id: channel.id, text: result.message, success: result.success })
  }

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
    <div className="page-container" style={{ height: '100%', overflowY: 'auto', padding: 28 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setShowCreateGroup(!showCreateGroup)}
                style={{
                  background: 'rgba(34,197,94,0.15)',
                  border: '1px solid rgba(34,197,94,0.3)',
                  color: '#22c55e',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <Plus size={14} /> Criar Grupo WhatsApp
              </button>
              <button className="btn-ghost" onClick={loadGroups} disabled={loadingGroups}>
                <RefreshCw size={14} style={{ animation: loadingGroups ? 'spin 1s linear infinite' : undefined }} />
                Atualizar
              </button>
            </div>
          </div>

          {/* Banner de Erro na Criação do Grupo */}
          {groupErrorMsg && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>⚠️ {groupErrorMsg}</p>
            </div>
          )}

          {/* Banner de Sucesso ao Criar Grupo */}
          {groupSuccessMsg && (
            <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: groupSuccessMsg.inviteLink ? 6 : 0 }}>
                <CheckCircle size={16} color="#22c55e" />
                <p style={{ color: '#22c55e', fontSize: 13, fontWeight: 700, margin: 0 }}>
                  Grupo "{groupSuccessMsg.name}" criado com sucesso!
                </p>
              </div>
              {groupSuccessMsg.inviteLink && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: 6 }}>
                  <Link size={12} color="#22d3ee" />
                  <span style={{ fontSize: 12, color: '#22d3ee', flex: 1, wordBreak: 'break-all' }}>
                    {groupSuccessMsg.inviteLink}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(groupSuccessMsg.inviteLink!)
                      setCopiedLink(true)
                      setTimeout(() => setCopiedLink(false), 2000)
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Copy size={12} /> {copiedLink ? 'Copiado!' : 'Copiar Link'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Formulário para Criar Novo Grupo WhatsApp */}
          {showCreateGroup && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
                🟢 Novo Grupo de WhatsApp
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    Nome do Grupo *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Ofertas Exclusivas VIP 🛍️"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    Descrição do Grupo (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Grupo oficial de cupons e achadinhos em promoção diária."
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      resize: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    Participantes Iniciais (Opcional - Telefones separados por vírgula)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 5583999999999, 5511988888888"
                    value={newGroupParticipants}
                    onChange={(e) => setNewGroupParticipants(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                  <button className="btn-ghost" onClick={() => setShowCreateGroup(false)} style={{ fontSize: 12 }}>
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateWhatsAppGroup}
                    disabled={creatingGroup || !newGroupName.trim()}
                    style={{
                      background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                      border: 'none',
                      borderRadius: 8,
                      color: '#fff',
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: creatingGroup || !newGroupName.trim() ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {creatingGroup ? (
                      <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Criando Grupo...</>
                    ) : (
                      'Criar Grupo'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {groups.map((g) => (
                <div
                  key={g.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 240 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: 'rgba(99,102,241,0.15)',
                        border: '1px solid rgba(99,102,241,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Users size={18} color="#818cf8" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                          {g.name}
                        </p>
                        {g.isAdmin && (
                          <span
                            style={{
                              fontSize: 10,
                              color: '#22c55e',
                              background: 'rgba(34,197,94,0.12)',
                              padding: '2px 8px',
                              borderRadius: 6,
                              border: '1px solid rgba(34,197,94,0.25)',
                              fontWeight: 600,
                            }}
                          >
                            Admin
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: '#737373' }}>👥 {g.memberCount} membros</span>
                        {g.inviteUrl ? (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              background: 'rgba(34,211,238,0.08)',
                              padding: '3px 10px',
                              borderRadius: 6,
                              border: '1px solid rgba(34,211,238,0.25)',
                              maxWidth: '100%',
                            }}
                          >
                            <Link size={12} color="#22d3ee" style={{ flexShrink: 0 }} />
                            <a
                              href={g.inviteUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                fontSize: 11,
                                color: '#22d3ee',
                                textDecoration: 'none',
                                fontWeight: 600,
                                wordBreak: 'break-all',
                              }}
                              className="hover:underline"
                            >
                              {g.inviteUrl}
                            </a>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: '#525252', fontStyle: 'italic' }}>
                            (Sem link público de convite)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {g.inviteUrl && (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(g.inviteUrl!)
                        setCopiedGroupId(g.id)
                        setTimeout(() => setCopiedGroupId(null), 2000)
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexShrink: 0,
                        borderRadius: 8,
                        borderColor: copiedGroupId === g.id ? 'rgba(34,197,94,0.4)' : undefined,
                        color: copiedGroupId === g.id ? '#22c55e' : undefined,
                      }}
                    >
                      {copiedGroupId === g.id ? <CheckCircle size={13} color="#22c55e" /> : <Copy size={13} />}
                      {copiedGroupId === g.id ? 'URL Copiada!' : 'Copiar URL'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Seção Canais do Discord */}
      <div className="card animate-fade-in" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageSquare size={18} color="#5865F2" />
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                Canais do Discord Webhook ({discordChannels.length})
              </h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Dispare promoções com Rich Embeds visuais diretamente em servidores do Discord
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAddDiscord(!showAddDiscord)}
            style={{
              background: 'rgba(88,101,242,0.15)',
              border: '1px solid rgba(88,101,242,0.3)',
              color: '#5865F2',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Adicionar Canal
          </button>
        </div>

        {/* Formulário para adicionar Webhook */}
        {showAddDiscord && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
              Novo Canal do Discord
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Nome do Canal</label>
                <input
                  type="text"
                  placeholder="Ex: #promo-hardware ou #ofertas-da-semana"
                  value={newDiscordName}
                  onChange={(e) => setNewDiscordName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>URL do Webhook do Discord</label>
                <input
                  type="text"
                  placeholder="https://discord.com/api/webhooks/123456789/abc..."
                  value={newDiscordWebhook}
                  onChange={(e) => setNewDiscordWebhook(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button className="btn-ghost" onClick={() => setShowAddDiscord(false)} style={{ fontSize: 12 }}>
                  Cancelar
                </button>
                <button
                  onClick={handleAddDiscord}
                  disabled={!newDiscordName.trim() || !newDiscordWebhook.trim()}
                  style={{
                    background: '#5865F2',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: !newDiscordName.trim() || !newDiscordWebhook.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  Salvar Webhook
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Canais do Discord */}
        {discordChannels.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 24 }}>
            Nenhum webhook do Discord cadastrado ainda. Clique em "Adicionar Canal" para integrar seu primeiro servidor.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {discordChannels.map((ch) => (
              <div
                key={ch.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(88,101,242,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageSquare size={16} color="#5865F2" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                    {ch.name}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ch.webhookUrl}
                  </p>
                  {discordStatusMsg?.id === ch.id && (
                    <p style={{ fontSize: 11, marginTop: 4, color: discordStatusMsg.success ? '#22c55e' : '#ef4444' }}>
                      {discordStatusMsg.text}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => handleTestDiscord(ch)}
                    disabled={testingDiscordId === ch.id}
                    className="btn-ghost"
                    style={{ fontSize: 11, padding: '4px 10px', gap: 4 }}
                  >
                    {testingDiscordId === ch.id ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={12} />}
                    Testar
                  </button>
                  <button
                    onClick={() => handleDeleteDiscord(ch.id)}
                    className="btn-ghost"
                    style={{ color: '#ef4444', padding: '4px 8px' }}
                    title="Excluir Webhook"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seção Instagram */}
      <div className="card animate-fade-in" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, rgba(225,48,108,0.2), rgba(229,149,0,0.2))', border: '1px solid rgba(225,48,108,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 18 }}>📸</span>
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Instagram Graph API (Oficial)
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Poste ofertas diretamente no Feed do Instagram Business/Creator
              </p>
            </div>
          </div>

          <div>
            {igStatus.connected ? (
              <button
                onClick={handleDisconnectIg}
                disabled={loadingIg}
                className="btn-ghost"
                style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', fontSize: 12 }}
              >
                <LogOut size={13} style={{ marginRight: 4 }} /> Desconectar @{igStatus.username}
              </button>
            ) : (
              <button
                onClick={() => setShowConnectIg(!showConnectIg)}
                style={{
                  background: 'linear-gradient(135deg, #e1306c, #f77737)',
                  border: 'none', borderRadius: 8, color: '#fff',
                  padding: '8px 14px', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Plus size={14} /> {showConnectIg ? 'Cancelar' : 'Conectar Instagram'}
              </button>
            )}
          </div>
        </div>

        {igSuccess && (
          <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, color: '#22c55e', fontSize: 12, marginBottom: 14 }}>
            {igSuccess}
          </div>
        )}

        {igError && (
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', fontSize: 12, marginBottom: 14 }}>
            ⚠️ {igError}
          </div>
        )}

        {/* Status de Conexão */}
        {igStatus.connected && (
          <div style={{ padding: 14, background: 'rgba(225,48,108,0.06)', border: '1px solid rgba(225,48,108,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle size={18} color="#e1306c" />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Conta Conectada: @{igStatus.username}
                </p>
                <p style={{ fontSize: 11, color: '#a3a3a3', margin: 0 }}>
                  ID da Conta: <code>{igStatus.accountId}</code>
                </p>
              </div>
            </div>
            <span style={{ fontSize: 11, background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(34,197,94,0.3)', fontWeight: 600 }}>
              Pronto para envios
            </span>
          </div>
        )}

        {/* Formulário de Conexão com Instagram */}
        {showConnectIg && !igStatus.connected && (
          <div style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 10, padding: 16, marginTop: 12 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Conectar Conta com Meta Graph API
            </h4>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
              Informe o <b>Instagram Account ID</b> e o <b>User/Page Access Token</b> gerado no Meta for Developers.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Instagram Account ID <span style={{ color: '#22d3ee', fontStyle: 'italic', fontWeight: 400 }}>(ou digite "me")</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: 17841400000000000 ou digite 'me'"
                  value={igAccountId}
                  onChange={(e) => setIgAccountId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: 13 }}
                />
                <p style={{ fontSize: 10, color: '#a3a3a3', marginTop: 4 }}>
                  💡 Dica: Se não souber seu ID numérico do Instagram Business, digite <b>me</b> e o sistema buscará automaticamente o ID da sua conta vinculada.
                </p>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Meta Access Token (Long-Lived)</label>
                <textarea
                  placeholder="EAA..."
                  value={igAccessToken}
                  onChange={(e) => setIgAccessToken(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'monospace' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button className="btn-ghost" onClick={() => setShowConnectIg(false)} style={{ fontSize: 12 }}>
                  Cancelar
                </button>
                <button
                  onClick={handleConnectIg}
                  disabled={loadingIg || !igAccountId.trim() || !igAccessToken.trim()}
                  style={{
                    background: 'linear-gradient(135deg, #e1306c, #f77737)',
                    border: 'none', borderRadius: 8, color: '#fff',
                    padding: '8px 16px', fontSize: 12, fontWeight: 600,
                    cursor: loadingIg || !igAccountId.trim() || !igAccessToken.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {loadingIg ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Validar e Salvar Conta'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
