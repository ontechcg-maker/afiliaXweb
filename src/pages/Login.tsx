import { useState } from 'react'
import { Zap, Mail, Lock, Eye, EyeOff, Loader } from 'lucide-react'
import { login } from '../services/authService'

interface LoginProps {
  onSuccess: () => void
  onGoToRegister: () => void
}

export default function Login({ onSuccess, onGoToRegister }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    setLoading(true)
    setError('')
    const result = await login(email.trim(), password)
    setLoading(false)
    if (result.success) {
      onSuccess()
    } else {
      setError(result.error || 'Credenciais inválidas.')
    }
  }

  return (
    <div style={containerStyle}>
      <div
        style={{
          position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34,211,238,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div style={cardStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={logoBox}><Zap size={28} color="#22d3ee" /></div>
          <h1 style={titleStyle}>AfiliaX</h1>
          <p style={{ color: '#525252', fontSize: 13 }}>Divulgador Automático de Afiliados</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}><Mail size={12} /> E-mail</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com" autoFocus required style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}><Lock size={12} /> Senha</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha" required
                style={{ ...inputStyle, paddingRight: 40 }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={eyeBtn}>
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>⚠️ {error}</p>}

          <button
            type="submit" disabled={loading || !email || !password}
            style={{
              background: loading || !email ? 'rgba(34,211,238,0.3)' : 'linear-gradient(135deg, #22d3ee, #818cf8)',
              border: 'none', borderRadius: 10,
              color: loading || !email ? 'rgba(255,255,255,0.4)' : '#000',
              padding: '13px 24px', fontSize: 14, fontWeight: 700,
              fontFamily: 'Inter, sans-serif',
              cursor: loading || !email ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s',
            }}
          >
            {loading ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Entrando...</> : '🔓 Entrar no Painel'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#525252', fontSize: 13 }}>
          Não tem conta?{' '}
          <button onClick={onGoToRegister} style={{ background: 'none', border: 'none', color: '#22d3ee', cursor: 'pointer', fontFamily: 'Inter', fontSize: 13, padding: 0 }}>
            Criar conta grátis
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
  width: '100%', maxWidth: 400,
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 20, padding: 40, display: 'flex', flexDirection: 'column', gap: 26,
  backdropFilter: 'blur(20px)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
}
const logoBox: React.CSSProperties = {
  width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
  background: 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(99,102,241,0.2))',
  border: '1px solid rgba(34,211,238,0.3)',
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
