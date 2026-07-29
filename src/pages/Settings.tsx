import React, { useState } from 'react'
import { Save, Eye, EyeOff, Loader, CheckCircle, XCircle, Bot, MessageSquare, Send, Copy, Check, Code, User, Sun, Moon, Palette } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { INITIAL_SQL_SCHEMA } from '../services/supabaseClient'
import { getTelegramBotInfo } from '../services/telegramService'
import type { AIProvider } from '../services/aiService'

const AI_PROVIDERS = [
  {
    id: 'gemini' as AIProvider,
    label: 'Google Gemini',
    models: [
      'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-pro',
      'gemini-2.0-flash', 'gemini-2.5-flash', 'custom',
    ],
  },
  {
    id: 'openai' as AIProvider,
    label: 'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'custom'],
  },
  {
    id: 'openrouter' as AIProvider,
    label: 'OpenRouter',
    models: [
      'deepseek/deepseek-r1', 'deepseek/deepseek-chat', 'meta-llama/llama-3.3-70b-instruct',
      'google/gemini-2.5-flash', 'anthropic/claude-3.5-sonnet', 'custom',
    ],
  },
  { id: 'ollama' as AIProvider, label: 'Ollama (Local)', models: ['llama3.2', 'mistral', 'deepseek-r1:7b', 'custom'] },
]

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input-glass" type={show ? 'text' : 'password'}
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ paddingRight: 40 }}
      />
      <button onClick={() => setShow(!show)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#525252' }}>
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(34,211,238,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color="#22d3ee" />
        </div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
      </div>
      <div className="divider-gradient" />
      {children}
    </div>
  )
}

export default function Settings() {
  const { settings, updateSettings, user, userProfile, theme, setTheme } = useApp()
  const [saving, setSaving] = useState(false)
  const [testingTg, setTestingTg] = useState(false)
  const [tgStatus, setTgStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [tgBotName, setTgBotName] = useState('')
  const [showSql, setShowSql] = useState(false)
  const [copiedSql, setCopiedSql] = useState(false)

  const handleTestTelegram = async () => {
    setTestingTg(true)
    setTgStatus('idle')
    const info = await getTelegramBotInfo(settings.telegram)
    if (info) { setTgStatus('ok'); setTgBotName(`@${info.username}`) }
    else setTgStatus('error')
    setTestingTg(false)
  }

  const handleCopySql = () => {
    navigator.clipboard.writeText(INITIAL_SQL_SCHEMA)
    setCopiedSql(true)
    setTimeout(() => setCopiedSql(false), 2000)
  }

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => setSaving(false), 800)
  }

  return (
    <div
      className="animate-fade-in"
      style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', height: '100%', maxWidth: 760, margin: '0 auto', width: '100%' }}
    >
      {/* Conta do usuário */}
      <Section icon={User} title="Minha Conta">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, color: '#525252', marginBottom: 6 }}>E-mail</p>
              <input className="input-glass" value={user?.email || '–'} disabled style={{ opacity: 0.6 }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, color: '#525252', marginBottom: 6 }}>Instância WhatsApp</p>
              <input className="input-glass" value={userProfile?.instance_name || '–'} disabled style={{ opacity: 0.6, fontFamily: 'monospace' }} />
            </div>
          </div>
          <p style={{ fontSize: 11, color: '#525252' }}>
            💡 Sua instância WhatsApp é criada automaticamente e fica na página <strong style={{ color: '#22d3ee' }}>Grupos</strong>.
          </p>
        </div>
      </Section>

      {/* Aparência / Tema */}
      <Section icon={Palette} title="Aparência">
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>Modo de Visualização</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: 12,
                border: theme === 'dark' ? '2px solid #6366f1' : '1px solid var(--border-color)',
                background: theme === 'dark' ? 'rgba(99,102,241,0.12)' : 'var(--bg-input)',
                color: theme === 'dark' ? '#818cf8' : 'var(--text-secondary)',
                fontWeight: theme === 'dark' ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                transition: 'all 0.2s',
              }}
            >
              <Moon size={16} /> Modo Escuro (Dark)
            </button>
            <button
              type="button"
              onClick={() => setTheme('light')}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: 12,
                border: theme === 'light' ? '2px solid #6366f1' : '1px solid var(--border-color)',
                background: theme === 'light' ? 'rgba(99,102,241,0.12)' : 'var(--bg-input)',
                color: theme === 'light' ? '#6366f1' : 'var(--text-secondary)',
                fontWeight: theme === 'light' ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                transition: 'all 0.2s',
              }}
            >
              <Sun size={16} /> Modo Claro (Light)
            </button>
          </div>
        </div>
      </Section>

      {/* AI */}
      <Section icon={Bot} title="Inteligência Artificial (Geração de Ofertas)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            ⚡ A inteligência artificial é <strong style={{ color: '#22d3ee' }}>fornecida e otimizada pela plataforma AfiliaX</strong>.
          </p>
          <p style={{ fontSize: 12, color: '#737373', margin: 0 }}>
            Você não precisa configurar chaves de API nem pagar por tokens adicionais. Suas ofertas serão reescritas automaticamente usando modelos avançados de IA para máxima conversão.
          </p>
        </div>
      </Section>

      {/* Telegram */}
      <Section icon={Send} title="Telegram — Bot API (opcional)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <p style={{ fontSize: 12, color: '#525252', marginBottom: 6 }}>Bot Token</p>
            <PasswordInput
              value={settings.telegram.botToken}
              onChange={(v) => updateSettings({ telegram: { botToken: v } })}
              placeholder="1234567890:ABCdef..."
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn-ghost" onClick={handleTestTelegram} disabled={testingTg || !settings.telegram.botToken} style={{ fontSize: 13, opacity: testingTg || !settings.telegram.botToken ? 0.6 : 1 }}>
              {testingTg ? <Loader size={13} /> : '✈️'} Testar Bot
            </button>
            {tgStatus === 'ok' && <span style={{ color: '#22c55e', fontSize: 13 }}><CheckCircle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{tgBotName}</span>}
            {tgStatus === 'error' && <span style={{ color: '#ef4444', fontSize: 13 }}><XCircle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Token inválido</span>}
          </div>
          <p style={{ fontSize: 11, color: '#525252' }}>💡 Crie seu bot com o <strong style={{ color: '#2aabee' }}>@BotFather</strong> no Telegram.</p>
        </div>
      </Section>

      {/* Agendamento */}
      <Section icon={Save} title="Agendamento">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <p style={{ fontSize: 12, color: '#525252', marginBottom: 6 }}>Intervalo entre envios (minutos)</p>
            <input className="input-glass" type="number" min={1} max={120} value={settings.sendIntervalMinutes} onChange={(e) => updateSettings({ sendIntervalMinutes: Number(e.target.value) })} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <p style={{ fontSize: 12, color: '#525252', marginBottom: 6 }}>Limite máximo de membros por grupo</p>
            <input className="input-glass" type="number" min={100} max={1024} value={settings.maxGroupMembers} onChange={(e) => updateSettings({ maxGroupMembers: Number(e.target.value) })} />
          </div>
        </div>
      </Section>

      {/* Script SQL */}
      <Section icon={MessageSquare} title="Script SQL do Banco de Dados">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 12, color: '#525252' }}>
            Execute este script no <strong style={{ color: '#22d3ee' }}>SQL Editor</strong> do seu painel Supabase para criar as tabelas e configurar o RLS multi-tenant.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" onClick={() => setShowSql(!showSql)} style={{ fontSize: 12 }}>
              <Code size={13} /> {showSql ? 'Ocultar SQL' : 'Ver Script SQL'}
            </button>
            <button className="btn-ghost" onClick={handleCopySql} style={{ fontSize: 12 }}>
              {copiedSql ? <Check size={13} /> : <Copy size={13} />}
              {copiedSql ? 'Copiado!' : 'Copiar SQL'}
            </button>
          </div>
          {showSql && (
            <pre style={{ fontSize: 11, color: '#a3a3a3', background: '#0a0a0a', border: '1px solid #2a2a2a', padding: 12, borderRadius: 8, overflowX: 'auto', maxHeight: 280 }}>
              {INITIAL_SQL_SCHEMA}
            </pre>
          )}
        </div>
      </Section>

      <button className="btn-primary" onClick={handleSave} style={{ fontSize: 14, padding: '14px 24px', alignSelf: 'flex-start' }}>
        {saving ? <><Loader size={15} /> Salvando...</> : <><Save size={15} /> Salvar Configurações</>}
      </button>
    </div>
  )
}
