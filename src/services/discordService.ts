export interface DiscordWebhookPayload {
  title: string
  priceFrom?: number
  priceTo?: number
  discountPct?: number
  coupon?: string
  imageUrl?: string
  affiliateLink: string
  copyText?: string
}

export interface DiscordChannel {
  id: string
  name: string
  webhookUrl: string
  isActive: boolean
}

const DISCORD_CHANNELS_KEY = 'afiliax_discord_channels'

export function getDiscordChannels(): DiscordChannel[] {
  try {
    const raw = localStorage.getItem(DISCORD_CHANNELS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveDiscordChannel(channel: Omit<DiscordChannel, 'id'> & { id?: string }): DiscordChannel[] {
  const channels = getDiscordChannels()
  const newChannel: DiscordChannel = {
    id: channel.id || `discord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: channel.name,
    webhookUrl: channel.webhookUrl.trim(),
    isActive: channel.isActive ?? true,
  }

  const existingIndex = channels.findIndex((c) => c.id === newChannel.id)
  let updated: DiscordChannel[] = []
  if (existingIndex !== -1) {
    updated = [...channels]
    updated[existingIndex] = newChannel
  } else {
    updated = [...channels, newChannel]
  }

  localStorage.setItem(DISCORD_CHANNELS_KEY, JSON.stringify(updated))
  return updated
}

export function deleteDiscordChannel(id: string): DiscordChannel[] {
  const channels = getDiscordChannels().filter((c) => c.id !== id)
  localStorage.setItem(DISCORD_CHANNELS_KEY, JSON.stringify(channels))
  return channels
}

export async function sendDiscordMessage(
  webhookUrl: string,
  data: DiscordWebhookPayload
): Promise<{ success: boolean; message: string }> {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return { success: false, message: 'URL do Webhook do Discord inválida.' }
  }

  const fields = []

  if (data.priceFrom && data.priceTo && data.priceFrom > data.priceTo) {
    fields.push({
      name: 'De',
      value: `~~R$ ${data.priceFrom.toFixed(2).replace('.', ',')}~~`,
      inline: true,
    })
  }

  if (data.priceTo && data.priceTo > 0) {
    fields.push({
      name: 'Por apenas',
      value: `**R$ ${data.priceTo.toFixed(2).replace('.', ',')}**`,
      inline: true,
    })
  }

  if (data.discountPct && data.discountPct > 0) {
    fields.push({
      name: 'Desconto',
      value: `🔥 **${data.discountPct}% OFF**`,
      inline: true,
    })
  }

  if (data.coupon) {
    fields.push({
      name: 'Cupom',
      value: `🎟️ \`${data.coupon}\``,
      inline: true,
    })
  }

  const embed: Record<string, any> = {
    title: data.title,
    url: data.affiliateLink,
    description: data.copyText || `Confira essa oferta imperdível!\n\n👉 [Clique aqui para comprar](${data.affiliateLink})`,
    color: 0x6366f1, // #6366f1 Indigo Accent
    fields: fields,
    footer: {
      text: 'AfiliaX — Divulgador Automático de Ofertas',
    },
    timestamp: new Date().toISOString(),
  }

  if (data.imageUrl) {
    embed.image = { url: data.imageUrl }
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [embed],
      }),
    })

    if (res.ok || res.status === 204) {
      return { success: true, message: 'Mensagem enviada para o Discord com sucesso!' }
    }

    const errText = await res.text()
    return { success: false, message: `Erro no Discord API (${res.status}): ${errText}` }
  } catch (e: any) {
    return { success: false, message: e.message || 'Falha ao conectar com o Webhook do Discord.' }
  }
}
