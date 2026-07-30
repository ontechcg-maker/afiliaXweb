import React, { useState, useEffect } from 'react'
import { Link2, Sparkles, Image, Upload, X, Copy, Check, Loader, CheckCircle, Users, Send, MessageSquare, ShieldCheck } from 'lucide-react'
import { scrapeProduct, type ScrapedProduct } from '../services/scraperService'
import { generateCopy, formatCustomTemplate, type CopyTone } from '../services/aiService'
import { useApp } from '../context/AppContext'
import MockupPreview from '../components/MockupPreview'
import { calculateNextScheduleTime, loadQueue, saveQueue, createBackendSchedule, type ScheduledPost } from '../services/schedulerService'
import { getGroups, sendTextMessage, sendMediaMessage, getRandomAntiBanDelay, delay, type WhatsAppGroup } from '../services/whatsappService'
import { getDiscordChannels, sendDiscordMessage, type DiscordChannel } from '../services/discordService'

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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [customImage, setCustomImage] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [generatingCopy, setGeneratingCopy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [antiBanProgressMsg, setAntiBanProgressMsg] = useState<string | null>(null)

  // Seleção de Grupos / Canais
  const [availableGroups, setAvailableGroups] = useState<WhatsAppGroup[]>([])
  const [availableDiscordChannels] = useState<DiscordChannel[]>(() => getDiscordChannels())
  const [selectedDiscordIds, setSelectedDiscordIds] = useState<string[]>([])
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
    } catch {
      setError('Erro ao extrair dados. Preencha manualmente.')
    } finally {
      setLoading(false)
    }
  }

function buildAffiliateUrl(url: string, tag?: string, platform?: string): string {
  if (!tag || !tag.trim()) return url
  const cleanTag = tag.trim()

  try {
    const parsed = new URL(url)
    const isMagalu = platform === 'magalu' || url.includes('magazineluiza') || url.includes('magalu') || url.includes('mglu') || url.includes('onelink') || url.includes('magazinevoce')
    const isML = platform === 'mercadolivre' || url.includes('mercadolivre') || url.includes('meli.la')

    if (isMagalu) {
      if (/^\d+$/.test(cleanTag)) {
        parsed.searchParams.set('promoter_id', cleanTag)
        if (!parsed.searchParams.has('utm_source')) parsed.searchParams.set('utm_source', 'divulgador')
        if (!parsed.searchParams.has('utm_medium')) parsed.searchParams.set('utm_medium', 'magalu')
      } else {
        if (url.includes('magazinevoce.com.br')) {
          parsed.pathname = parsed.pathname.replace(/^\/magazine[^\/]+/, `/${cleanTag}`)
        } else {
          parsed.searchParams.set('partner_id', cleanTag)
          parsed.searchParams.set('promoter_id', cleanTag)
          parsed.searchParams.set('utm_source', 'divulgador')
          parsed.searchParams.set('utm_medium', 'magalu')
        }
      }
      return parsed.toString()
    }

    if (isML) {
      parsed.searchParams.set('matt_tool', cleanTag)
      return parsed.toString()
    }

    if (url.includes('amazon') || url.includes('amzn')) {
      parsed.searchParams.set('tag', cleanTag)
      return parsed.toString()
    }

    if (url.includes('shopee') || url.includes('shope.ee')) {
      parsed.searchParams.set('smtt', cleanTag)
      return parsed.toString()
    }

    parsed.searchParams.set('tag', cleanTag)
    return parsed.toString()
  } catch {
    return url.includes('?') ? `${url}&tag=${encodeURIComponent(cleanTag)}` : `${url}?tag=${encodeURIComponent(cleanTag)}`
  }
}

  const handleGenerateCopy = async () => {
    if (!product) return
    setGeneratingCopy(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const finalLink = buildAffiliateUrl(url, affiliateTag, product?.platform)
      const productWithLink = {
        title: product.title,
        priceFrom: product.priceFrom,
        priceTo: product.priceTo,
        discountPct: product.discountPct,
        coupon: product.coupon,
        rating: product.rating,
        affiliateLink: finalLink,
      }

      // Se um template customizado do Prompt Studio foi selecionado
      if (selectedTemplateId) {
        const found = (settings.customTemplates || []).find((t) => t.id === selectedTemplateId)
        if (found) {
          const formatted = formatCustomTemplate(found.template, productWithLink)
          setCopy(formatted)
          return
        }
      }

      const result = await generateCopy(productWithLink, tone, settings.ai)
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

  const toggleDiscordSelection = (discordId: string) => {
    setSelectedDiscordIds((prev) =>
      prev.includes(discordId) ? prev.filter((id) => id !== discordId) : [...prev, discordId]
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

  const [sendingNow, setSendingNow] = useState(false)

  const handleSendNow = async () => {
    if (!copy.trim()) return
    setSendingNow(true)
    setError(null)
    setSuccessMsg(null)
    setAntiBanProgressMsg(null)

    try {
      const affiliateLink = affiliateTag ? `${url}?tag=${affiliateTag}` : url
      const offerTitle = product?.title || 'Oferta de Afiliado'

      let targetGroupIds: string[] = []
      if (selectedTarget === 'all') {
        targetGroupIds = ['all']
      } else {
        targetGroupIds = selectedGroupIds
      }

      if (targetGroupIds.length === 0 && selectedDiscordIds.length === 0 && !sendToTelegram) {
        setError('Selecione pelo menos um destino para disparo.')
        setSendingNow(false)
        return
      }

      // 1. WhatsApp Dispatch com Anti-Ban Guard
      if (targetGroupIds.length > 0) {
        const antiBan = settings.antiBan ?? { enabled: true, minDelaySeconds: 15, maxDelaySeconds: 45 }
        for (let i = 0; i < targetGroupIds.length; i++) {
          const groupId = targetGroupIds[i]
          const groupName = groupId === 'all' ? 'Todos os Grupos' : (availableGroups.find((g) => g.id === groupId)?.name || 'Grupo WhatsApp')

          if (i > 0 && antiBan.enabled && targetGroupIds.length > 1) {
            const delayMs = getRandomAntiBanDelay(antiBan.minDelaySeconds, antiBan.maxDelaySeconds)
            setAntiBanProgressMsg(`🛡️ Anti-Ban Guard: aguardando ${(delayMs / 1000).toFixed(0)}s antes de enviar para "${groupName}"...`)
            await delay(delayMs)
          }

          setAntiBanProgressMsg(`Enviando WhatsApp para "${groupName}"...`)
          if (customImage) {
            const isVideo = customImage.startsWith('data:video/') ||
              /\.(mp4|webm|mov|avi|mkv|m4v)(\?.*)?$/i.test(customImage)
            await sendMediaMessage(groupId, customImage, copy, isVideo ? 'video' : 'image')
          } else {
            await sendTextMessage(groupId, copy)
          }
        }
      }

      // 2. Discord Dispatch
      if (selectedDiscordIds.length > 0) {
        for (const discId of selectedDiscordIds) {
          const channel = availableDiscordChannels.find((c) => c.id === discId)
          if (channel) {
            setAntiBanProgressMsg(`Enviando Discord para "${channel.name}"...`)
            await sendDiscordMessage(channel.webhookUrl, {
              title: offerTitle,
              priceFrom: product?.priceFrom,
              priceTo: product?.priceTo,
              discountPct: product?.discountPct,
              coupon: product?.coupon,
              imageUrl: customImage,
              affiliateLink: affiliateLink,
              copyText: copy,
            })
          }
        }
      }

      setAntiBanProgressMsg(null)
      setSuccessMsg('🚀 Oferta disparada com sucesso para os destinos selecionados!')

      // Registra como enviada no histórico
      const existingQueue = loadQueue()
      const newOfferPost: ScheduledPost = {
        id: String(Date.now()),
        offerId: String(Date.now()),
        title: offerTitle,
        copyText: copy,
        imageUrl: customImage,
        affiliateLink: affiliateLink,
        channels: [
          ...targetGroupIds.map((id) => ({
            type: 'whatsapp' as const,
            targetId: id,
            targetName: id === 'all' ? 'Todos os Grupos' : (availableGroups.find((g) => g.id === id)?.name || 'Grupo WhatsApp'),
          })),
          ...selectedDiscordIds.map((id) => ({
            type: 'discord' as const,
            targetId: id,
            targetName: availableDiscordChannels.find((c) => c.id === id)?.name || 'Canal Discord',
          })),
        ],
        scheduledAt: new Date(),
        status: 'sent',
      }
      saveQueue([...existingQueue, newOfferPost])

      setTimeout(() => {
        setActiveTab('history')
      }, 1500)
    } catch (err: any) {
      setError(`Falha ao disparar oferta: ${err.message || 'Erro de envio.'}`)
    } finally {
      setSendingNow(false)
      setAntiBanProgressMsg(null)
    }
  }

  const handleAddToQueue = async () => {
    if (!copy.trim()) return

    const affiliateLink = affiliateTag ? `${url}?tag=${affiliateTag}` : url
    const offerTitle = product?.title || 'Oferta de Afiliado'

    const channels: { type: 'whatsapp' | 'telegram' | 'discord'; targetId: string; targetName: string }[] = []

    if (selectedTarget === 'all') {
      channels.push({ type: 'whatsapp', targetId: 'all', targetName: 'Todos os Grupos do WhatsApp' })
    } else {
      selectedGroupIds.forEach((id) => {
        const found = availableGroups.find((g) => g.id === id)
        channels.push({
          type: 'whatsapp',
          targetId: id,
          targetName: found?.name || 'Grupo do WhatsApp',
        })
      })
    }

    selectedDiscordIds.forEach((id) => {
      const found = availableDiscordChannels.find((c) => c.id === id)
      channels.push({
        type: 'discord',
        targetId: id,
        targetName: found?.name || 'Canal Discord',
      })
    })

    if (sendToTelegram) {
      channels.push({ type: 'telegram', targetId: 'all', targetName: 'Canal do Telegram' })
    }

    if (channels.length === 0) {
      setError('Selecione pelo menos um destino (WhatsApp, Discord ou Telegram) para agendar.')
      return
    }

    const existingQueue = loadQueue()
    const nextScheduledTime = calculateNextScheduleTime(existingQueue, settings.sendIntervalMinutes)

    const tempId = String(Date.now())

    // Salva a oferta e o agendamento no backend ou Supabase
    const backendRes = await createBackendSchedule({
      title: offerTitle,
      copyText: copy,
      imageUrl: customImage,
      affiliateLink: affiliateLink,
      url: url,
      priceFrom: product?.priceFrom,
      priceTo: product?.priceTo,
      discountPct: product?.discountPct,
      coupon: product?.coupon,
      channels: channels,
      scheduledAt: nextScheduledTime,
    })

    const finalId = backendRes?.scheduleId || tempId
    const finalOfferId = backendRes?.offerId || tempId

    const newOfferPost: ScheduledPost = {
      id: finalId,
      offerId: finalOfferId,
      title: offerTitle,
      copyText: copy,
      imageUrl: customImage,
      affiliateLink: affiliateLink,
      channels,
      scheduledAt: nextScheduledTime,
      status: 'pending',
    }

    saveQueue([...existingQueue.filter((p) => p.id !== finalId), newOfferPost])

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
                onClick={() => {
                  setTone(t.id)
                  setSelectedTemplateId('')
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: tone === t.id && !selectedTemplateId ? '1px solid rgba(34,211,238,0.5)' : '1px solid #2a2a2a',
                  background: tone === t.id && !selectedTemplateId ? 'rgba(34,211,238,0.08)' : 'transparent',
                  color: tone === t.id && !selectedTemplateId ? '#22d3ee' : '#737373',
                  fontSize: 12,
                  fontWeight: tone === t.id && !selectedTemplateId ? 600 : 400,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  transition: 'all 0.15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Prompt Studio Templates Selector */}
          {(settings.customTemplates || []).length > 0 && (
            <div style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(99,102,241,0.05)', borderRadius: 10, border: '1px solid rgba(99,102,241,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Sparkles size={12} /> Prompt Studio — Seus Templates Salvos:
                </span>
                {selectedTemplateId && (
                  <button
                    className="btn-ghost"
                    onClick={() => setSelectedTemplateId('')}
                    style={{ fontSize: 10, padding: '2px 6px' }}
                  >
                    Usar Estilo Padrão
                  </button>
                )}
              </div>
              <select
                className="input-glass"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                style={{ fontSize: 12, padding: '6px 10px' }}
              >
                <option value="">-- Selecionar um Template Customizado --</option>
                {settings.customTemplates.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    ✨ {tmpl.name}
                  </option>
                ))}
              </select>
            </div>
          )}

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
                  marginTop: 4,
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

            {/* Option: Discord Webhooks */}
            {availableDiscordChannels.length > 0 && (
              <div style={{ marginTop: 6, background: 'rgba(88,101,242,0.05)', border: '1px solid rgba(88,101,242,0.2)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <MessageSquare size={16} color="#5865F2" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    🎮 Canais do Discord Webhook ({selectedDiscordIds.length} selecionados)
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
                  {availableDiscordChannels.map((ch) => {
                    const isChecked = selectedDiscordIds.includes(ch.id)
                    return (
                      <label
                        key={ch.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '6px 10px',
                          borderRadius: 6,
                          background: isChecked ? 'rgba(88,101,242,0.12)' : 'transparent',
                          border: isChecked ? '1px solid rgba(88,101,242,0.3)' : '1px solid #1a1a1a',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDiscordSelection(ch.id)}
                        />
                        <span style={{ fontSize: 12, color: isChecked ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          💬 {ch.name}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Anti-Ban Progress Notice */}
        {antiBanProgressMsg && (
          <div
            style={{
              background: 'rgba(234,179,8,0.1)',
              border: '1px solid rgba(234,179,8,0.3)',
              borderRadius: 10,
              padding: '12px 16px',
              fontSize: 13,
              color: '#eab308',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <ShieldCheck size={18} color="#eab308" />
            <span>{antiBanProgressMsg}</span>
          </div>
        )}

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

        {/* Send Buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
          <button
            className="btn-primary"
            onClick={handleSendNow}
            disabled={!copy.trim() || sendingNow}
            style={{
              flex: 1,
              fontSize: 14,
              padding: '14px 20px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              opacity: (!copy.trim() || sendingNow) ? 0.5 : 1,
              cursor: (!copy.trim() || sendingNow) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {sendingNow ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
            {sendingNow ? 'Disparando...' : '⚡ Disparar Agora'}
          </button>

          <button
            type="button"
            className="btn-ghost"
            onClick={handleAddToQueue}
            disabled={!copy.trim() || sendingNow}
            style={{
              flex: 1,
              fontSize: 14,
              padding: '14px 20px',
              border: '1px solid var(--border-color)',
              opacity: (!copy.trim() || sendingNow) ? 0.5 : 1,
              cursor: (!copy.trim() || sendingNow) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              color: 'var(--text-primary)',
            }}
          >
            📅 Agendar para a Fila
          </button>
        </div>
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
