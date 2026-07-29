import { useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'

interface MockupPreviewProps {
  text: string
  imageUrl?: string
  platform?: 'whatsapp' | 'telegram'
}

function isVideoUrl(url?: string): boolean {
  if (!url) return false
  const lower = url.toLowerCase()
  return (
    lower.startsWith('data:video/') ||
    lower.endsWith('.mp4') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.mov') ||
    lower.endsWith('.m4v') ||
    lower.includes('video')
  )
}

export default function MockupPreview({ text, imageUrl, platform = 'whatsapp' }: MockupPreviewProps) {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'telegram'>(platform)

  return (
    <div
      style={{
        background: '#111111',
        border: '1px solid #1e1e1e',
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Tab Switcher */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #1a1a1a',
          padding: '0 16px',
        }}
      >
        {(['whatsapp', 'telegram'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: activeTab === tab ? 700 : 400,
              color: activeTab === tab
                ? tab === 'whatsapp' ? '#25d366' : '#2aabee'
                : '#525252',
              borderBottom: activeTab === tab
                ? `2px solid ${tab === 'whatsapp' ? '#25d366' : '#2aabee'}`
                : '2px solid transparent',
              transition: 'all 0.2s ease',
              fontFamily: 'Inter, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {tab === 'whatsapp' ? '📱 WhatsApp' : '✈️ Telegram'}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#525252', alignSelf: 'center' }}>Pré-visualização</span>
      </div>

      {/* Phone Mockup */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: 20 }}>
        {activeTab === 'whatsapp'
          ? <WhatsAppMockup text={text} imageUrl={imageUrl} />
          : <TelegramMockup text={text} imageUrl={imageUrl} />
        }
      </div>
    </div>
  )
}

function WhatsAppMockup({ text, imageUrl }: { text: string; imageUrl?: string }) {
  const formattedText = formatWhatsApp(text)
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  const isVideo = isVideoUrl(imageUrl)

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 340,
        background: '#0b141a',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* WA Header */}
      <div
        style={{
          background: '#202c33',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #25d366, #128c7e)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MessageCircle size={18} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e9edef' }}>🔥 Ofertas Imperdíveis</div>
          <div style={{ fontSize: 12, color: '#8696a0' }}>Grupo · 892 participantes</div>
        </div>
      </div>

      {/* WA Chat Background */}
      <div
        style={{
          background: '#0b141a',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z' fill='%23ffffff' fill-opacity='0.01'/%3E%3C/svg%3E")`,
          minHeight: 200,
          padding: '12px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {/* Message Bubble */}
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <div
            style={{
              maxWidth: '90%',
              background: '#202c33',
              borderRadius: '0px 10px 10px 10px',
              overflow: 'hidden',
              boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}
          >
            {imageUrl && (
              isVideo ? (
                <video
                  src={imageUrl}
                  controls
                  autoPlay
                  loop
                  muted
                  style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <img
                  src={imageUrl}
                  alt="Produto"
                  style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )
            )}
            <div style={{ padding: '8px 12px 6px' }}>
              <div
                style={{ fontSize: 13, color: '#e9edef', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}
                dangerouslySetInnerHTML={{ __html: formattedText || '<em style="color:#8696a0">Sua mensagem aparecerá aqui...</em>' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: '#8696a0' }}>{time} ✓✓</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* WA Input */}
      <div
        style={{
          background: '#202c33',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            flex: 1,
            background: '#2a3942',
            borderRadius: 24,
            padding: '8px 14px',
            fontSize: 13,
            color: '#8696a0',
          }}
        >
          Mensagem
        </div>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: '#00a884',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Send size={16} color="white" />
        </div>
      </div>
    </div>
  )
}

function TelegramMockup({ text, imageUrl }: { text: string; imageUrl?: string }) {
  const formattedText = formatTelegram(text)
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  const isVideo = isVideoUrl(imageUrl)

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 340,
        background: '#17212b',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* TG Header */}
      <div
        style={{
          background: '#232e3c',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2aabee, #006fbf)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Send size={16} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>🛒 Ofertas AfiliaX</div>
          <div style={{ fontSize: 12, color: '#6b7f8d' }}>Canal · 3.4k assinantes</div>
        </div>
      </div>

      {/* TG Chat */}
      <div style={{ background: '#17212b', minHeight: 200, padding: '12px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <div
            style={{
              maxWidth: '90%',
              background: '#182533',
              borderRadius: '2px 12px 12px 12px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }}
          >
            {imageUrl && (
              isVideo ? (
                <video
                  src={imageUrl}
                  controls
                  autoPlay
                  loop
                  muted
                  style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <img
                  src={imageUrl}
                  alt="Produto"
                  style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )
            )}
            <div style={{ padding: '8px 12px 6px' }}>
              <div
                style={{ fontSize: 13, color: '#d4d4d4', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}
                dangerouslySetInnerHTML={{ __html: formattedText || '<em style="color:#6b7f8d">Sua mensagem aparecerá aqui...</em>' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: '#6b7f8d' }}>{time}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TG Input */}
      <div
        style={{
          background: '#232e3c',
          padding: '8px 12px',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            flex: 1,
            background: '#17212b',
            borderRadius: 20,
            padding: '8px 14px',
            fontSize: 13,
            color: '#6b7f8d',
          }}
        >
          Mensagem
        </div>
      </div>
    </div>
  )
}

function formatWhatsApp(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/~([^~]+)~/g, '<del>$1</del>')
    .replace(/`([^`]+)`/g, '<code style="background:#2a3942;padding:2px 4px;borderRadius:4px;fontSize:12px">$1</code>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:#53bdeb;textDecoration:underline">$1</a>')
}

function formatTelegram(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/~([^~]+)~/g, '<del>$1</del>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:#64b5f6;textDecoration:underline">$1</a>')
}
