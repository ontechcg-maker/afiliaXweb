import { useState, useEffect } from 'react'
import {
  Users,
  Wifi,
  Send,
  ShieldCheck,
  Search,
  Lock,
  Unlock,
  RefreshCw,
  Loader,
  Crown,
  Smartphone,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import {
  getAdminStats,
  getAdminUsers,
  toggleBlockUser,
  setUserRole,
  setUserPlanTier,
  getAdminSystemConfig,
  saveAdminSystemConfig,
  type AdminStats,
  type AdminUser,
  type SystemConfig,
} from '../services/adminService'
import { useApp } from '../context/AppContext'

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
    <div className="card" style={{ flex: 1, minWidth: 200 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>{value}</p>
          {subtext && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{subtext}</p>}
        </div>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: `${color}15`,
            border: `1px solid ${color}30`,
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

export default function Admin() {
  const { user } = useApp()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [usersList, setUsersList] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'connected' | 'disconnected' | 'blocked'>('all')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Configurações Globais do SaaS (Evolution + IA)
  const [sysConfig, setSysConfig] = useState<SystemConfig>({
    evolutionBaseUrl: '',
    evolutionApiKey: '',
    openrouterApiKey: '',
    geminiApiKey: '',
    openaiApiKey: '',
    shopeeAppId: '',
    shopeeAppSecret: '',
    aiProvider: 'gemini',
    aiModel: 'gemini-2.0-flash',
    customModel: '',
  })
  const [savingConfig, setSavingConfig] = useState(false)

  const loadAdminData = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const statsData = await getAdminStats().catch(() => null)
      const configData = await getAdminSystemConfig().catch(() => ({
        evolutionBaseUrl: '',
        evolutionApiKey: '',
        openrouterApiKey: '',
        geminiApiKey: '',
        openaiApiKey: '',
        shopeeAppId: '',
        shopeeAppSecret: '',
        aiProvider: 'gemini',
        aiModel: 'gemini-2.0-flash',
        customModel: '',
      }))

      let usersData: AdminUser[] = []
      try {
        usersData = await getAdminUsers()
      } catch (userErr: any) {
        console.error('[Admin] Erro ao carregar usuários:', userErr)
        setErrorMsg(`Aviso na busca de clientes: ${userErr.message || 'Erro de permissão ou conexão'}`)
      }

      setStats(statsData)
      setUsersList(usersData)
      setSysConfig(configData)
    } catch (e: any) {
      setErrorMsg(e.message || 'Erro ao carregar dados de administração.')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingConfig(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      await saveAdminSystemConfig(sysConfig)
      setSuccessMsg('Configurações globais salvas com sucesso! A Evolution API e a IA já estão operacionais para todos os clientes.')
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar configurações do sistema.')
    } finally {
      setSavingConfig(false)
    }
  }

  useEffect(() => {
    loadAdminData()
  }, [])

  const handleToggleBlock = async (targetUser: AdminUser) => {
    const nextBlocked = !targetUser.is_blocked
    setActionLoadingId(targetUser.id)
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      await toggleBlockUser(targetUser.id, nextBlocked)
      setUsersList((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, is_blocked: nextBlocked } : u))
      )
      setSuccessMsg(
        `Cliente ${targetUser.email} ${nextBlocked ? 'bloqueado' : 'desbloqueado'} com sucesso!`
      )
    } catch (e: any) {
      setErrorMsg(e.message || 'Erro ao alterar status do cliente.')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleToggleRole = async (targetUser: AdminUser) => {
    const nextRole = targetUser.role === 'admin' ? 'user' : 'admin'
    setActionLoadingId(targetUser.id)
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      await setUserRole(targetUser.id, nextRole)
      setUsersList((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, role: nextRole } : u))
      )
      setSuccessMsg(`Permissão de ${targetUser.email} alterada para "${nextRole}".`)
    } catch (e: any) {
      setErrorMsg(e.message || 'Erro ao alterar papel do usuário.')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handlePlanChange = async (targetUser: AdminUser, newPlan: string) => {
    setActionLoadingId(targetUser.id)
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      await setUserPlanTier(targetUser.id, newPlan)
      setUsersList((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, plan_tier: newPlan as any } : u))
      )
      setSuccessMsg(`Plano de ${targetUser.email} alterado para "${newPlan.toUpperCase()}".`)
    } catch (e: any) {
      setErrorMsg(e.message || 'Erro ao alterar plano do usuário.')
    } finally {
      setActionLoadingId(null)
    }
  }

  const filteredUsers = usersList.filter((u) => {
    const emailStr = (u.email || '').toLowerCase()
    const instStr = (u.instance_name || '').toLowerCase()
    const idStr = (u.id || '').toLowerCase()
    const search = (searchTerm || '').toLowerCase()

    const matchesSearch = emailStr.includes(search) || instStr.includes(search) || idStr.includes(search)

    if (!matchesSearch) return false

    if (statusFilter === 'connected') return u.instance_status === 'connected'
    if (statusFilter === 'disconnected') return u.instance_status !== 'connected'
    if (statusFilter === 'blocked') return u.is_blocked === true
    return true
  })

  return (
    <div
      className="animate-fade-in page-container"
      style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', height: '100%' }}
    >
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(34,211,238,0.1))',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 16,
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1, #22d3ee)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={24} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
              Painel do Administrador (Dono do SaaS)
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Gestão global de clientes, conexões de WhatsApp e métricas da plataforma
            </p>
          </div>
        </div>

        <button className="btn-ghost" onClick={loadAdminData} disabled={loading}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
          Atualizar Dados
        </button>
      </div>

      {errorMsg && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>⚠️ {errorMsg}</p>
        </div>
      )}

      {successMsg && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
          <p style={{ color: '#22c55e', fontSize: 13, margin: 0 }}>✅ {successMsg}</p>
        </div>
      )}

      {/* Grid de Estatísticas Globais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <StatCard
          icon={Users}
          label="Total de Clientes"
          value={stats?.totalUsers ?? usersList.length}
          color="#6366f1"
          subtext="Contas cadastradas no SaaS"
        />
        <StatCard
          icon={Wifi}
          label="WhatsApp Conectados"
          value={stats?.activeUsers ?? usersList.filter((u) => u.instance_status === 'connected').length}
          color="#22c55e"
          subtext="Clientes com disparo ativo"
        />
        <StatCard
          icon={Send}
          label="Ofertas Criadas"
          value={stats?.totalOffers ?? 0}
          color="#22d3ee"
          subtext="Total em todas as contas"
        />
        <StatCard
          icon={Smartphone}
          label="Disparos Realizados"
          value={stats?.totalDispatches ?? 0}
          color="#f59e0b"
          subtext="Posts entregues via WhatsApp"
        />
      </div>

      {/* Form de Configurações Globais (Evolution API + IA) */}
      <div className="card" style={{ padding: 24, border: '1px solid rgba(99,102,241,0.2)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Crown size={18} color="#6366f1" />
          Configurações Globais do SaaS (Dono do Sistema)
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
          As configurações aqui serão utilizadas por todos os clientes para conexão de WhatsApp e geração de ofertas por IA.
        </p>

        <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* ─── Seção IA ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <span style={{ fontSize: 18 }}>🤖</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Inteligência Artificial</span>
            </div>

            {/* Provedor */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                Provedor de IA
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { id: 'gemini', label: 'Google Gemini', emoji: '✨' },
                  { id: 'openai', label: 'OpenAI ChatGPT', emoji: '🤖' },
                  { id: 'openrouter', label: 'OpenRouter', emoji: '🌐' },
                  { id: 'ollama', label: 'Ollama Local', emoji: '🦙' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSysConfig({ ...sysConfig, aiProvider: p.id, aiModel: '', customModel: '' })}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 10,
                      border: `1.5px solid ${sysConfig.aiProvider === p.id ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                      background: sysConfig.aiProvider === p.id ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)',
                      color: sysConfig.aiProvider === p.id ? '#a5b4fc' : 'var(--text-secondary)',
                      fontSize: 13,
                      fontWeight: sysConfig.aiProvider === p.id ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>{p.emoji}</span> {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* API Key dinâmica por provedor */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                {sysConfig.aiProvider === 'gemini' && 'Google Gemini — API Key'}
                {sysConfig.aiProvider === 'openai' && 'OpenAI — API Key'}
                {sysConfig.aiProvider === 'openrouter' && 'OpenRouter — API Key'}
                {sysConfig.aiProvider === 'ollama' && 'Ollama — URL Base'}
              </label>
              <input
                type={sysConfig.aiProvider === 'ollama' ? 'text' : 'password'}
                className="input-glass"
                placeholder={
                  sysConfig.aiProvider === 'gemini' ? 'AIzaSy...' :
                  sysConfig.aiProvider === 'openai' ? 'sk-...' :
                  sysConfig.aiProvider === 'openrouter' ? 'sk-or-v1-...' :
                  'http://localhost:11434'
                }
                value={
                  sysConfig.aiProvider === 'gemini' ? sysConfig.geminiApiKey :
                  sysConfig.aiProvider === 'openai' ? sysConfig.openaiApiKey :
                  sysConfig.aiProvider === 'openrouter' ? sysConfig.openrouterApiKey :
                  sysConfig.evolutionBaseUrl // reutiliza o campo URL para Ollama
                }
                onChange={(e) => {
                  const v = e.target.value
                  if (sysConfig.aiProvider === 'gemini') setSysConfig({ ...sysConfig, geminiApiKey: v })
                  else if (sysConfig.aiProvider === 'openai') setSysConfig({ ...sysConfig, openaiApiKey: v })
                  else if (sysConfig.aiProvider === 'openrouter') setSysConfig({ ...sysConfig, openrouterApiKey: v })
                }}
              />
            </div>

            {/* Modelo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Modelo de IA
                </label>
                <select
                  className="input-glass"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer' }}
                  value={sysConfig.aiModel || ''}
                  onChange={(e) => setSysConfig({ ...sysConfig, aiModel: e.target.value, customModel: e.target.value === '__custom__' ? sysConfig.customModel : '' })}
                >
                  <option value="" style={{ background: '#111' }}>— Selecione o modelo —</option>
                  {sysConfig.aiProvider === 'gemini' && (
                    <>
                      <option value="gemini-2.0-flash" style={{ background: '#111' }}>✨ Gemini 2.0 Flash (Recomendado)</option>
                      <option value="gemini-1.5-flash" style={{ background: '#111' }}>🚀 Gemini 1.5 Flash</option>
                      <option value="gemini-2.5-flash" style={{ background: '#111' }}>⚡ Gemini 2.5 Flash</option>
                      <option value="gemini-1.5-pro" style={{ background: '#111' }}>💎 Gemini 1.5 Pro</option>
                      <option value="gemini-1.5-flash-8b" style={{ background: '#111' }}>🔹 Gemini 1.5 Flash 8B</option>
                    </>
                  )}
                  {sysConfig.aiProvider === 'openai' && (
                    <>
                      <option value="gpt-4o" style={{ background: '#111' }}>🤖 GPT-4o</option>
                      <option value="gpt-4o-mini" style={{ background: '#111' }}>⚡ GPT-4o Mini</option>
                      <option value="gpt-4-turbo" style={{ background: '#111' }}>💡 GPT-4 Turbo</option>
                      <option value="gpt-3.5-turbo" style={{ background: '#111' }}>🔹 GPT-3.5 Turbo</option>
                      <option value="o1-mini" style={{ background: '#111' }}>🔵 o1 Mini</option>
                    </>
                  )}
                  {sysConfig.aiProvider === 'openrouter' && (
                    <>
                      <option value="meta-llama/llama-3.3-70b-instruct" style={{ background: '#111' }}>🦙 Llama 3.3 70B (Recomendado)</option>
                      <option value="deepseek/deepseek-chat" style={{ background: '#111' }}>🧠 DeepSeek V3</option>
                      <option value="deepseek/deepseek-r1" style={{ background: '#111' }}>💡 DeepSeek R1</option>
                      <option value="anthropic/claude-3.5-sonnet" style={{ background: '#111' }}>🎭 Claude 3.5 Sonnet</option>
                      <option value="openai/gpt-4o-mini" style={{ background: '#111' }}>🤖 GPT-4o Mini via OR</option>
                    </>
                  )}
                  {sysConfig.aiProvider === 'ollama' && (
                    <>
                      <option value="llama3.2" style={{ background: '#111' }}>🦙 Llama 3.2</option>
                      <option value="llama3.1" style={{ background: '#111' }}>🦙 Llama 3.1</option>
                      <option value="mistral" style={{ background: '#111' }}>💨 Mistral</option>
                      <option value="phi3" style={{ background: '#111' }}>🔵 Phi-3</option>
                    </>
                  )}
                  <option value="__custom__" style={{ background: '#111' }}>✏️ Inserir ID do modelo manualmente</option>
                </select>
              </div>

              {/* Campo de modelo customizado */}
              {sysConfig.aiModel === '__custom__' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    ID do Modelo (Customizado)
                  </label>
                  <input
                    type="text"
                    className="input-glass"
                    placeholder="Ex: google/gemini-pro-exp, gpt-4o-latest..."
                    value={sysConfig.customModel || ''}
                    onChange={(e) => setSysConfig({ ...sysConfig, customModel: e.target.value })}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ─── Seção Evolution API ──────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <span style={{ fontSize: 18 }}>💬</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>WhatsApp — Evolution API</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  URL da API
                </label>
                <input
                  type="text"
                  className="input-glass"
                  placeholder="https://api.ontechcg.cloud"
                  value={sysConfig.evolutionBaseUrl}
                  onChange={(e) => setSysConfig({ ...sysConfig, evolutionBaseUrl: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  API Key Global
                </label>
                <input
                  type="password"
                  className="input-glass"
                  placeholder="Cole sua API Key da Evolution"
                  value={sysConfig.evolutionApiKey}
                  onChange={(e) => setSysConfig({ ...sysConfig, evolutionApiKey: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn-primary" type="submit" disabled={savingConfig} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {savingConfig ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Crown size={16} />}
              Salvar Configurações do SaaS
            </button>
          </div>
        </form>
      </div>

      {/* Tabela de Gestão de Clientes */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              Lista de Clientes ({filteredUsers.length})
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Gerencie permissões e conexões dos usuários cadastrados
            </p>
          </div>

          {/* Filtro e Pesquisa */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 220 }}>
              <input
                className="input-glass"
                placeholder="Buscar por e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: 34, fontSize: 12 }}
              />
              <Search
                size={14}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>

            <select
              className="input-glass"
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              style={{ width: 140, fontSize: 12 }}
            >
              <option value="all" style={{ background: '#111' }}>Todos</option>
              <option value="connected" style={{ background: '#111' }}>🟢 Conectados</option>
              <option value="disconnected" style={{ background: '#111' }}>🔴 Desconectados</option>
              <option value="blocked" style={{ background: '#111' }}>🔒 Bloqueados</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <Loader size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontSize: 13 }}>Carregando dados dos clientes...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <Users size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
            <p style={{ fontSize: 13 }}>Nenhum cliente encontrado.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px 14px' }}>Cliente</th>
                  <th style={{ padding: '12px 14px' }}>Instância WhatsApp</th>
                  <th style={{ padding: '12px 14px' }}>Status Conexão</th>
                  <th style={{ padding: '12px 14px' }}>Plano SaaS</th>
                  <th style={{ padding: '12px 14px' }}>Papel</th>
                  <th style={{ padding: '12px 14px' }}>Data Cadastro</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isSelf = u.id === user?.id
                  const isConn = u.instance_status === 'connected'
                  const isBlocked = u.is_blocked === true
                  const isActionLoading = actionLoadingId === u.id
                  const currentPlan = u.plan_tier || 'free'

                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        opacity: isBlocked ? 0.6 : 1,
                        background: isSelf ? 'rgba(99,102,241,0.04)' : 'transparent',
                      }}
                    >
                      {/* Cliente */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: u.role === 'admin' ? 'rgba(99,102,241,0.2)' : 'rgba(34,211,238,0.15)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: 12,
                              color: u.role === 'admin' ? '#818cf8' : '#22d3ee',
                            }}
                          >
                            {(u.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                              {u.email || 'Usuário Sem E-mail'} {isSelf && <span style={{ fontSize: 10, color: '#6366f1', background: 'rgba(99,102,241,0.15)', padding: '2px 6px', borderRadius: 4 }}>Você</span>}
                            </p>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {(u.id || '').substring(0, 8)}...</p>
                          </div>
                        </div>
                      </td>

                      {/* Instância */}
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {u.instance_name || '–'}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 10px',
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 600,
                            background: isConn ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                            color: isConn ? '#22c55e' : '#ef4444',
                            border: `1px solid ${isConn ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.2)'}`,
                          }}
                        >
                          {isConn ? <CheckCircle size={12} /> : <XCircle size={12} />}
                          {isConn ? 'Conectado' : 'Desconectado'}
                        </span>
                      </td>

                      {/* Plano SaaS */}
                      <td style={{ padding: '12px 14px' }}>
                        <select
                          className="input-glass"
                          value={currentPlan}
                          disabled={isActionLoading}
                          onChange={(e) => handlePlanChange(u, e.target.value)}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '4px 8px',
                            color: currentPlan === 'agency' ? '#eab308' : currentPlan === 'pro' ? '#22c55e' : '#a3a3a3',
                          }}
                        >
                          <option value="free" style={{ background: '#111' }}>⚡ FREE (5/dia)</option>
                          <option value="pro" style={{ background: '#111' }}>🚀 PRO (100/dia)</option>
                          <option value="agency" style={{ background: '#111' }}>👑 AGENCY (Ilimitado)</option>
                        </select>
                      </td>

                      {/* Papel */}
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            color: u.role === 'admin' ? '#818cf8' : 'var(--text-muted)',
                          }}
                        >
                          {u.role === 'admin' && <Crown size={12} color="#818cf8" />}
                          {u.role === 'admin' ? 'Administrador' : 'Cliente'}
                        </span>
                      </td>

                      {/* Data */}
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 12 }}>
                        {new Date(u.created_at).toLocaleDateString('pt-BR')}
                      </td>

                      {/* Ações */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          {/* Alternar Role */}
                          <button
                            className="btn-ghost"
                            onClick={() => handleToggleRole(u)}
                            disabled={isActionLoading || isSelf}
                            title={u.role === 'admin' ? 'Remover privilégio Admin' : 'Tornar Administrador'}
                            style={{ padding: '6px 10px', fontSize: 11 }}
                          >
                            <Crown size={12} /> {u.role === 'admin' ? 'Virar Cliente' : 'Tornar Admin'}
                          </button>

                          {/* Bloquear / Desbloquear */}
                          <button
                            className="btn-ghost"
                            onClick={() => handleToggleBlock(u)}
                            disabled={isActionLoading || isSelf}
                            style={{
                              padding: '6px 10px',
                              fontSize: 11,
                              color: isBlocked ? '#22c55e' : '#ef4444',
                              borderColor: isBlocked ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
                            }}
                            title={isBlocked ? 'Desbloquear Acesso' : 'Bloquear Acesso'}
                          >
                            {isBlocked ? <Unlock size={12} /> : <Lock size={12} />}
                            {isBlocked ? 'Desbloquear' : 'Bloquear'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
