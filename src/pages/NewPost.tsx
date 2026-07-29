import React, { useState, useEffect } from 'react'
import { Link2, Sparkles, Image, Upload, X, Copy, Check, Loader, CheckCircle, Users, Send } from 'lucide-react'
import { scrapeProduct, type ScrapedProduct } from '../services/scraperService'
import { generateCopy, type CopyTone } from '../services/aiService'
import { useApp } from '../context/AppContext'
import MockupPreview from '../components/MockupPreview'
import { calculateNextScheduleTime, loadQueue, saveQueue, type ScheduledPost } from '../services/schedulerService'
import { getSupabaseClient } from '../services/supabaseClient'
import { getGroups, type WhatsAppGroup } from '../services/whatsappService'

const TONE_OPTIONS: { id: CopyTone; label: string; emoji: string }[] = [
  { id: 'urgent', label: 'Urgente 🔥', emoji: '⚡' },
  { id: 'casual', label: 'Casual / Achadinho 😄', emoji: '😄' },
  { id: 'review', label: 'Review ⭐', emoji: '⭐' },
  { id: 'short', label: 'Curto 💨', emoji: '💨' },
  { id: 'aggressive', label: 'Agressivo (PAS) 😈', emoji: '😈' },
  { id: 'funny', label: 'Engraçado 🤣', emoji: '🤣' },
]

/**
 * Formata um valor numérico em centavos para a máscara monetária BRL (R$ 0,00) de trás para frente
 */
function formatCentsToBRL(cents: number): string {
  const value = cents / 100
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export default function NewPost() {
  const { settings, setActiveTab } = useApp()
  const [url, setUrl] = useState('')
  const [affiliateTag, setAffiliateTag] = useState('')
  const [product, setProduct] = useState<ScrapedProduct | null>(null)
  const [copy, setCopy] = useState('')
  const [tone, setTone] = useState<CopyTone>('urgent')
  const [customImage, setCustomImage] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [generatingCopy, setGeneratingCopy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Seleção de Grupos / Canais
  const [availableGroups, setAvailableGroups] = useState<WhatsAppGroup[]>([])
  const [loadingGroups, setLoadingGroups] = useState<boolean>(false)
  const [selectedTarget, setSelectedTarget] = useState<'all' | 'custom'>('custom')
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [sendToTelegram, setSendToTelegram] = useState<boolean>(false)

  const fetchWhatsAppGroups = async () => {
    setLoadingGroups(true)
    try {
      const list = await getGroups()
      setAvailableGroups(list)
    } catch (e) {
      console.warn('Erro ao carregar grupos:', e)
    } finally {
      setLoadingGroups(false)
    }
  }

  useEffect(() => {
    fetchWhatsAppGroups()
  }, [])

  useEffect(() => {
    const checkReusedOffer = () => {
      try {
        const raw = localStorage.getItem('afiliax_draft_reuse')
        if (raw) {
          const data = JSON.parse(raw)
          if (data.url) setUrl(data.url)
          if (data.copyText) setCopy(data.copyText)
          if (data.imageUrl) setCustomImage(data.imageUrl)
          if (data.title) {
            setProduct({
              title: data.title,
              imageUrl: data.imageUrl,
              platform: 'generic',
            })
          }
          localStorage.removeItem('afiliax_draft_reuse')
        }
      } catch {}
    }
    checkReusedOffer()
    window.addEventListener('afiliax_load_reused_offer', checkReusedOffer)
    return () => window.removeEventListener('afiliax_load_reused_offer', checkReusedOffer)
  }, [])

  const handleExtract = async () => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const data = await scrapeProduct(url.trim())
      setProduct(data)
      if (!customImage) setCustomImage(data.imageUrl)
    } catch (err: any) {
      setError('Erro ao extrair dados. Preencha manualmente.')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateCopy = async () => {
    if (!product) return
    setGeneratingCopy(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const finalLink = affiliateTag ? `${url}?tag=${affiliateTag}` : url

      const result = await generateCopy(
        {
          title: product.title,
          priceFrom: product.priceFrom,
          priceTo: product.priceTo,
          discountPct: product.discountPct,
          coupon: product.coupon,
          rating: product.rating,
          affiliateLink: finalLink,
        },
        tone,
        settings.ai
      )
      setCopy(result.trim())
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar copy. Verifique a chave de API.')
    } finally {
      setGeneratingCopy(false)
    }
  }

  const handleCopyCopy = () => {
    navigator.clipboard.writeText(copy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setCustomImage(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handlePriceFromInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!product) return
    const rawDigits = e.target.value.replace(/\D/g, '')
    const cents = rawDigits ? parseInt(rawDigits, 10) : 0
    const numValue = cents > 0 ? cents / 100 : undefined
    setProduct({ ...product, priceFrom: numValue })
  }

  const handlePriceToInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!product) return
    const rawDigits = e.target.value.replace(/\D/g, '')
    const cents = rawDigits ? parseInt(rawDigits, 10) : 0
    const numValue = cents > 0 ? cents / 100 : undefined
    setProduct({ ...product, priceTo: numValue })
  }

  const toggleGroupSelection = (groupId: string) => {
    setSelectedTarget('custom')
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    )
  }

  const handleSelectAllCustomGroups = () => {
    setSelectedTarget('custom')
    if (selectedGroupIds.length === availableGroups.length) {
      setSelectedGroupIds([])
    } else {
      setSelectedGroupIds(availableGroups.map((g) => g.id))
    }
  }

  const handleAddToQueue = async () => {
    if (!copy.trim()) return

    const affiliateLink = affiliateTag ? `${url}?tag=${affiliateTag}` : url
    const offerTitle = product?.title || 'Oferta de Afiliado'

    const channels: { type: 'whatsapp' | 'telegram'; targetId: string; targetName: string }[] = []

    if (selectedTarget === 'all') {
      channels.push({ type: 'whatsapp', targetId: 'all', targetName: 'Todos os Grupos do WhatsApp' })
    } else {
      if (selectedGroupIds.length === 0) {
        setError('Selecione pelo menos um grupo específico para envio.')
        return
      }
      selectedGroupIds.forEach((id) => {
        const found = availableGroups.find((g) => g.id === id)
        channels.push({
          type: 'whatsapp',
          targetId: id,
          targetName: found?.name || 'Grupo do WhatsApp',
        })
      })
    }

    if (sendToTelegram) {
      channels.push({ type: 'telegram', targetId: 'all', targetName: 'Canal do Telegram' })
    }

    const existingQueue = loadQueue()
    const nextScheduledTime = calculateNextScheduleTime(existingQueue, settings.sendIntervalMinutes)

    const newOfferPost: ScheduledPost = {
      id: String(Date.now()),
      offerId: String(Date.now()),
      title: offerTitle,
      copyText: copy,
      imageUrl: customImage,
      affiliateLink: affiliateLink,
      channels,
      scheduledAt: nextScheduledTime,
      status: 'pending',
    }

    saveQueue([...existingQueue, newOfferPost])

    // Salva oferta e agendamento no Supabase (para o scheduler 24/7 do servidor)
    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        const { data: offerData } = await supabase.from('offers').insert({
          url: url,
          title: offerTitle,
          price_from: product?.priceFrom,
          price_to: product?.priceTo,
          discount_pct: product?.discountPct,
          coupon: product?.coupon,
          image_url: customImage,
          affiliate_link: affiliateLink,
          copy_text: copy,
          status: 'scheduled',
        }).select('id').single()

        if (offerData?.id) {
          await supabase.from('schedules').insert({
            offer_id: offerData.id,
            channels: channels,
            scheduled_at: nextScheduledTime.toISOString(),
            status: 'pending',
          })
        }
      } catch (_e) {}
    }

    setSuccessMsg('🚀 Oferta agendada e adicionada à fila com sucesso!')
    setTimeout(() => {
      setActiveTab('scheduler')
    }, 1200)
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left Panel - Form */}
      <div
        className="animate-fade-in"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          borderRight: '1px solid #1a1a1a',
        }}
      >
        {/* URL Input */}
        <div className="card">
          <label style={{ fontSize: 12, color: '#737373', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 10 }}>
            🔗 Link do Produto
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              className="input-glass"
              placeholder="https://produto.com/link-de-afiliado"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExtract()}
            />
            <button
              className="btn-primary"
              onClick={handleExtract}
              disabled={loading || !url.trim()}
              style={{ whiteSpace: 'nowrap', opacity: loading || !url.trim() ? 0.6 : 1 }}
            >
              {loading ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Link2 size={15} />}
              {loading ? 'Extraindo...' : 'Extrair'}
            </button>
          </div>

          <div style={{ marginTop: 10 }}>
            <input
              className="input-glass"
              placeholder="Tag/ID de afiliado (ex: seuloginAF)"
              value={affiliateTag}
              onChange={(e) => setAffiliateTag(e.target.value)}
              style={{ fontSize: 13 }}
            />
          </div>
        </div>

        {/* Product Data (after scraping) */}
        {product && (
          <div className="card animate-slide-in">
            <label style={{ fontSize: 12, color: '#737373', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 12 }}>
              📦 Dados do Produto
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <p style={{ fontSize: 11, color: '#525252', marginBottom: 4 }}>Título</p>
                <textarea
                  className="input-glass"
                  value={product.title}
                  onChange={(e) => setProduct({ ...product, title: e.target.value })}
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <p style={{ fontSize: 11, color: '#525252', marginBottom: 4 }}>Preço DE</p>
                  <input
                    className="input-glass"
                    type="text"
                    inputMode="numeric"
                    value={product.priceFrom !== undefined ? formatCentsToBRL(Math.round(product.priceFrom * 100)) : 'R$ 0,00'}
                    onChange={handlePriceFromInput}
                    style={{ fontWeight: 600, color: '#22d3ee' }}
                  />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: '#525252', marginBottom: 4 }}>Preço POR</p>
                  <input
                    className="input-glass"
                    type="text"
                    inputMode="numeric"
                    value={product.priceTo !== undefined ? formatCentsToBRL(Math.round(product.priceTo * 100)) : 'R$ 0,00'}
                    onChange={handlePriceToInput}
                    style={{ fontWeight: 600, color: '#22c55e' }}
                  />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: '#525252', marginBottom: 4 }}>Cupom</p>
                  <input
                    className="input-glass"
                    value={product.coupon ?? ''}
                    onChange={(e) => setProduct({ ...product, coupon: e.target.value })}
                    placeholder="CUPOM10"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Media */}
        <div className="card">
          <label style={{ fontSize: 12, color: '#737373', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 12 }}>
            🖼️ Imagem / Mídia
          </label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            {customImage ? (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {customImage.startsWith('data:video/') || customImage.endsWith('.mp4') || customImage.endsWith('.webm') || customImage.endsWith('.mov') ? (
                  <video
                    src={customImage}
                    controls
                    style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 10, border: '1px solid #2a2a2a' }}
                  />
                ) : (
                  <img
                    src={customImage}
                    alt="Preview"
                    style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 10, border: '1px solid #2a2a2a' }}
                  />
                )}
                <button
                  onClick={() => setCustomImage(undefined)}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#ef4444',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={12} color="white" />
                </button>
              </div>
            ) : null}
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px dashed #2a2a2a',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#525252',
                  transition: 'all 0.2s',
                }}
              >
                <Upload size={15} />
                Fazer upload de imagem ou vídeo
                <input type="file" accept="image/*,video/*" onChange={handleImageUpload} style={{ display: 'none' }} />
              </label>
              {product?.imageUrl && (
                <button
                  onClick={() => setCustomImage(product.imageUrl)}
                  className="btn-ghost"
                  style={{ marginTop: 8, width: '100%', fontSize: 12 }}
                >
                  <Image size={14} />
                  Usar imagem do produto
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Copy Generation */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#737373', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ✍️ Copy da Oferta
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {copy && (
                <button className="btn-ghost" onClick={handleCopyCopy} style={{ padding: '6px 12px', fontSize: 12 }}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              )}
              <button
                className="btn-primary"
                onClick={handleGenerateCopy}
                disabled={!product || generatingCopy}
                style={{ padding: '6px 14px', fontSize: 12, opacity: (!product || generatingCopy) ? 0.6 : 1 }}
              >
                {generatingCopy
                  ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Gerando...</>
                  : <><Sparkles size={13} /> Gerar Copy com IA</>
                }
              </button>
            </div>
          </div>

          {/* Tone Selector - 6 Master Approaches */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {TONE_OPTIONS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTone(t.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: tone === t.id ? '1px solid rgba(34,211,238,0.5)' : '1px solid #2a2a2a',
                  background: tone === t.id ? 'rgba(34,211,238,0.08)' : 'transparent',
                  color: tone === t.id ? '#22d3ee' : '#737373',
                  fontSize: 12,
                  fontWeight: tone === t.id ? 600 : 400,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  transition: 'all 0.15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <textarea
            className="input-glass"
            rows={8}
            placeholder="A copy gerada pela IA aparecerá aqui. Você pode editá-la livremente antes de enviar..."
            value={copy}
            onChange={(e) => setCopy(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>

        {/* Target Group Selector */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#737373', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🎯 Grupos e Canais de Destino
            </label>
            <button
              className="btn-ghost"
              onClick={fetchWhatsAppGroups}
              disabled={loadingGroups}
              style={{ fontSize: 11, padding: '4px 10px' }}
            >
              {loadingGroups ? 'Buscando...' : 'Atualizar Grupos'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Opção 1: Todos os grupos */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 8,
                background: selectedTarget === 'all' ? 'rgba(34,211,238,0.08)' : 'rgba(255,255,255,0.02)',
                border: selectedTarget === 'all' ? '1px solid rgba(34,211,238,0.4)' : '1px solid #2a2a2a',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="targetGroup"
                checked={selectedTarget === 'all'}
                onChange={() => {
                  setSelectedTarget('all')
                }}
              />
              <Users size={16} color="#22d3ee" />
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                🌐 Todos os Grupos Conectados ({availableGroups.length > 0 ? availableGroups.length : 'Geral'})
              </span>
            </label>

            {/* Opção 2: Grupos Específicos */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 8,
                background: selectedTarget === 'custom' ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                border: selectedTarget === 'custom' ? '1px solid rgba(99,102,241,0.4)' : '1px solid #2a2a2a',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="targetGroup"
                checked={selectedTarget === 'custom'}
                onChange={() => {
                  setSelectedTarget('custom')
                  if (availableGroups.length > 0 && selectedGroupIds.length === 0) {
                    setSelectedGroupIds(availableGroups.map((g) => g.id))
                  }
                }}
              />
              <Users size={16} color="#818cf8" />
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                🎯 Selecionar Grupos Específicos ({selectedGroupIds.length} selecionados)
              </span>
            </label>

            {/* Checklist dos Grupos */}
            {selectedTarget === 'custom' && (
              <div style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 10, padding: 12, marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: '#818cf8', fontWeight: 600 }}>
                    Marque os grupos que devem receber esta oferta:
                  </span>
                  {availableGroups.length > 0 && (
                    <button
                      className="btn-ghost"
                      onClick={handleSelectAllCustomGroups}
                      style={{ fontSize: 10, padding: '2px 8px' }}
                    >
                      {selectedGroupIds.length === availableGroups.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                    </button>
                  )}
                </div>

                {loadingGroups ? (
                  <p style={{ fontSize: 12, color: '#525252', padding: 10, textAlign: 'center' }}>
                    🔄 Carregando seus grupos do WhatsApp...
                  </p>
                ) : availableGroups.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 14 }}>
                    <p style={{ fontSize: 12, color: '#eab308', marginBottom: 8 }}>
                      Nenhum grupo encontrado na sua instância do WhatsApp.
                    </p>
                    <button className="btn-primary" onClick={fetchWhatsAppGroups} style={{ fontSize: 11, padding: '5px 12px' }}>
                      Buscar Grupos do WhatsApp
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                    {availableGroups.map((group) => {
                      const isChecked = selectedGroupIds.includes(group.id)
                      return (
                        <label
                          key={group.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 10px',
                            borderRadius: 6,
                            background: isChecked ? 'rgba(99,102,241,0.1)' : 'transparent',
                            border: isChecked ? '1px solid rgba(99,102,241,0.3)' : '1px solid #1a1a1a',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleGroupSelection(group.id)}
                          />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 12, color: isChecked ? '#f5f5f5' : '#a3a3a3', fontWeight: isChecked ? 400 : 400 }}>
                              👥 {group.name}
                            </p>
                            {group.memberCount > 0 && (
                              <p style={{ fontSize: 10, color: '#525252' }}>{group.memberCount} membros</p>
                            )}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Option: Telegram */}
            {settings.telegram?.botToken && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: sendToTelegram ? 'rgba(42,171,238,0.08)' : 'rgba(255,255,255,0.02)',
                  border: sendToTelegram ? '1px solid rgba(42,171,238,0.4)' : '1px solid #2a2a2a',
                  cursor: 'pointer',
                  marginTop: 6,
                }}
              >
                <input
                  type="checkbox"
                  checked={sendToTelegram}
                  onChange={(e) => setSendToTelegram(e.target.checked)}
                />
                <Send size={15} color="#2aabee" />
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                  ✈️ Enviar também para o Canal do Telegram
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
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
            ⚠️ {error}
          </div>
        )}

        {/* Success */}
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

        {/* Send Button */}
        <button
          className="btn-primary"
          onClick={handleAddToQueue}
          style={{ fontSize: 15, padding: '14px 24px', opacity: (!copy.trim()) ? 0.5 : 1 }}
          disabled={!copy.trim()}
        >
          🚀 Adicionar à Fila de Envio
        </button>
      </div>

      {/* Right Panel - Live Preview */}
      <div
        style={{
          width: 400,
          flexShrink: 0,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <p style={{ fontSize: 12, color: '#525252', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Live Preview
        </p>
        <div style={{ flex: 1 }}>
          <MockupPreview text={copy} imageUrl={customImage} />
        </div>
      </div>
    </div>
  )
}
