export interface TelegramConfig {
  botToken: string
}

export async function sendTelegramMessage(
  config: TelegramConfig,
  chatId: string,
  text: string
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.description || 'Erro ao enviar mensagem no Telegram')
  }
}

export async function sendTelegramPhoto(
  config: TelegramConfig,
  chatId: string,
  photoUrl: string,
  caption: string
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: 'HTML',
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.description || 'Erro ao enviar foto no Telegram')
  }
}

export async function sendTelegramVideo(
  config: TelegramConfig,
  chatId: string,
  videoUrl: string,
  caption: string
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendVideo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      video: videoUrl,
      caption,
      parse_mode: 'HTML',
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.description || 'Erro ao enviar vídeo no Telegram')
  }
}

export async function getTelegramBotInfo(config: TelegramConfig): Promise<{ username: string; name: string } | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${config.botToken}/getMe`)
    const data = await res.json()
    if (!data.ok) return null
    return {
      username: data.result.username,
      name: data.result.first_name,
    }
  } catch {
    return null
  }
}
