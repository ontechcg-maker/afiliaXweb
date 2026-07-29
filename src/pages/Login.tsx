import { useState } from 'react'
import { Zap, Mail, Lock, Eye, EyeOff, Loader, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { login, resetPassword } from '../services/authService'

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
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')

    if (forgotMode) {
      const result = await resetPassword(email.trim())
      setLoading(false)
      if (result.success) {
        setResetSuccess(true)
      } else {
        setError(result.error || 'Erro ao enviar e-mail de recuperação.')
      }
    } else {
      if (!password.trim()) return
      const result = await login(email.trim(), password)
      setLoading(false)
      if (result.success) {
        onSuccess()
      } else {
        setError(result.error || 'Credenciais inválidas.')
      }
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
          <p style={{ color: '#525252', fontSize: 13 }}>
            {forgotMode ? 'Recuperação de Senha' : 'Divulgador Automático de Afiliados'}
          </p>
        </div>

        {resetSuccess ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <CheckCircle2 size={40} color="#22c55e" />
            <p style={{ color: '#e5e5e5', fontSize: 14, margin: 0 }}>
              E-mail de recuperação enviado para <strong style={{ color: '#22d3ee' }}>{email}</strong>!
            </p>
            <p style={{ color: '#737373', fontSize: 12, margin: 0 }}>
              Verifique sua caixa de entrada e spam para redefinir sua senha.
            </p>
            <button
              onClick={() => { setForgotMode(false); setResetSuccess(false); setError(''); }}
              style={{ ...backBtnStyle, marginTop: 10 }}
            >
              <ArrowLeft size={14} /> Voltar para o Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}><Mail size={12} /> E-mail</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com" autoFocus required style={inputStyle}
              />
            </div>

            {!forgotMode && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}><Lock size={12} /> Senha</label>
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setError(''); }}
                    style={{ background: 'none', border: 'none', color: '#22d3ee', cursor: 'pointer', fontFamily: 'Inter', fontSize: 12, padding: 0 }}
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha" required={!forgotMode}
                    style={{ ...inputStyle, paddingRight: 40 }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={eyeBtn}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            )}

            {error && <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>⚠️ {error}</p>}

            <button
              type="submit" disabled={loading || !email || (!forgotMode && !password)}
              style={{
                background: loading || !email || (!forgotMode && !password) ? 'rgba(34,211,238,0.3)' : 'linear-gradient(135deg, #22d3ee, #818cf8)',
                border: 'none', borderRadius: 10,
                color: loading || !email || (!forgotMode && !password) ? 'rgba(255,255,255,0.4)' : '#000',
                padding: '13px 24px', fontSize: 14, fontWeight: 700,
                fontFamily: 'Inter, sans-serif',
                cursor: loading || !email || (!forgotMode && !password) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s',
              }}
            >
              {loading ? (
                <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Processando...</>
              ) : forgotMode ? (
                '📩 Enviar Link de Recuperação'
              ) : (
                '🔓 Entrar no Painel'
              )}
            </button>

            {forgotMode && (
              <button
                type="button"
                onClick={() => { setForgotMode(false); setError(''); }}
                style={backBtnStyle}
              >
                <ArrowLeft size={14} /> Voltar para o Login
              </button>
            )}
          </form>
        )}

        {!forgotMode && !resetSuccess && (
          <p style={{ textAlign: 'center', color: '#525252', fontSize: 13 }}>
            Não tem conta?{' '}
            <button onClick={onGoToRegister} style={{ background: 'none', border: 'none', color: '#22d3ee', cursor: 'pointer', fontFamily: 'Inter', fontSize: 13, padding: 0 }}>
              Criar conta grátis
            </button>
          </p>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const backBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: '#a3a3a3',
  padding: '10px 16px',
  fontSize: 13,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  fontFamily: 'Inter, sans-serif',
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
