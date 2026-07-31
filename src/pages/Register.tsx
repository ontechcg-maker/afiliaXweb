import { useState } from 'react'
import { Zap, Mail, Lock, Eye, EyeOff, Loader, CheckCircle } from 'lucide-react'
import { register } from '../services/authService'

interface RegisterProps {
  onSuccess: () => void
  onGoToLogin: () => void
}

export default function Register({ onSuccess, onGoToLogin }: RegisterProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    setLoading(true)
    setError('')
    const result = await register(email.trim(), password)
    setLoading(false)
    if (result.success) {
      if (result.needsConfirmation) {
        setNeedsConfirmation(true)
      } else {
        onSuccess()
      }
    } else {
      setError(result.error || 'Erro ao criar conta. Tente novamente.')
    }
  }

  if (needsConfirmation) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...logoBox, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <CheckCircle size={28} color="#22c55e" />
            </div>
            <h1 style={titleStyle}>Verifique seu e-mail</h1>
            <p style={{ color: '#737373', fontSize: 14, lineHeight: 1.6, marginTop: 8 }}>
              Enviamos um link de confirmação para <strong style={{ color: '#f5f5f5' }}>{email}</strong>.
              <br />Clique no link para ativar sua conta.
            </p>
          </div>
          <button className="btn-ghost" onClick={onGoToLogin} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
            Voltar para o Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div
        style={{
          position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div className="card-auth" style={cardStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={logoBox}><Zap size={28} color="#22d3ee" /></div>
          <h1 style={titleStyle}>Criar Conta</h1>
          <p style={{ color: '#525252', fontSize: 13, marginBottom: 0 }}>
            Comece a divulgar suas ofertas com IA
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}><Mail size={12} /> E-mail</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com" autoFocus required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}><Lock size={12} /> Senha</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'} value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres" required
                style={{ ...inputStyle, paddingRight: 40 }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={eyeBtn}>
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label style={labelStyle}><Lock size={12} /> Confirmar Senha</label>
            <input
              type={showPassword ? 'text' : 'password'} value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a senha" required
              style={inputStyle}
            />
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>⚠️ {error}</p>}

          <button
            type="submit" disabled={loading || !email || !password || !confirmPassword}
            style={{
              background: loading || !email ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1, #818cf8)',
              border: 'none', borderRadius: 10,
              color: loading || !email ? 'rgba(255,255,255,0.4)' : '#fff',
              padding: '13px 24px', fontSize: 14, fontWeight: 700,
              fontFamily: 'Inter, sans-serif',
              cursor: loading || !email ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s',
            }}
          >
            {loading ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Criando conta...</> : '🚀 Criar Minha Conta'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#525252', fontSize: 13 }}>
          Já tem conta?{' '}
          <button onClick={onGoToLogin} style={{ background: 'none', border: 'none', color: '#22d3ee', cursor: 'pointer', fontFamily: 'Inter', fontSize: 13, padding: 0 }}>
            Entrar
          </button>
        </p>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  minHeight: '100vh', background: '#0a0a0a',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 24, fontFamily: 'Inter, sans-serif',
}
const cardStyle: React.CSSProperties = {
  width: '100%', maxWidth: 420,
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 20, padding: 40, display: 'flex', flexDirection: 'column', gap: 24,
  backdropFilter: 'blur(20px)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
}
const logoBox: React.CSSProperties = {
  width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
  background: 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(99,102,241,0.15))',
  border: '1px solid rgba(34,211,238,0.25)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const titleStyle: React.CSSProperties = {
  fontSize: 24, fontWeight: 800,
  background: 'linear-gradient(135deg, #22d3ee, #818cf8)',
  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 6,
}
const labelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  fontSize: 12, color: '#737373', marginBottom: 8, fontWeight: 500,
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
  color: '#f5f5f5', padding: '12px 14px', fontSize: 14,
  fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
}
const eyeBtn: React.CSSProperties = {
  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
  background: 'none', border: 'none', cursor: 'pointer', color: '#525252', padding: 0, display: 'flex',
}
