export interface EvolutionConfig {
  baseUrl: string
  apiKey: string
  instanceName: string
}

export interface ConnectionStatus {
  connected: boolean
  qrCode?: string
  number?: string
}

export interface WhatsAppGroup {
  id: string
  name: string
  memberCount: number
  isAdmin?: boolean
}

function cleanConfig(config: EvolutionConfig) {
  return {
    baseUrl: config.baseUrl.trim().replace(/\/$/, ''),
    apiKey: config.apiKey.trim(),
    instanceName: config.instanceName.trim() || 'afiliax',
  }
}

async function safeFetchJson(res: Response): Promise<any> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { rawText: text }
  }
}

function parseErrorMessage(data: any, status: number): string {
  if (!data) return `Erro de conexão HTTP ${status}`

  const possibleMsgs = [
    data?.response?.message,
    data?.message,
    data?.error,
    data?.reason,
    Array.isArray(data?.response?.message) ? data.response.message[0] : null,
    Array.isArray(data?.message) ? data.message[0] : null,
    data?.rawText,
  ].filter(Boolean)

  if (possibleMsgs.length > 0) {
    const first = String(possibleMsgs[0])
    if (first.length > 0 && !first.startsWith('<')) return first
  }

  return `Erro HTTP ${status} na Evolution API`
}

export async function createInstance(config: EvolutionConfig): Promise<void> {
  const { baseUrl, apiKey, instanceName } = cleanConfig(config)

  const res = await fetch(`${baseUrl}/instance/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
    },
    body: JSON.stringify({
      instanceName: instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    }),
  })

  const data = await safeFetchJson(res)

  if (!res.ok) {
    const errorMessage = parseErrorMessage(data, res.status)
    if (
      errorMessage.toLowerCase().includes('already exist') ||
      errorMessage.toLowerCase().includes('já existe') ||
      res.status === 403
    ) {
      return
    }

    throw new Error(errorMessage)
  }
}

export async function logoutInstance(config: EvolutionConfig): Promise<void> {
  const { baseUrl, apiKey, instanceName } = cleanConfig(config)
  try {
    await fetch(`${baseUrl}/instance/logout/${instanceName}`, {
      method: 'DELETE',
      headers: { apikey: apiKey },
    })
  } catch {
    await fetch(`${baseUrl}/instance/delete/${instanceName}`, {
      method: 'DELETE',
      headers: { apikey: apiKey },
    }).catch(() => {})
  }
}

export async function getConnectionStatus(config: EvolutionConfig): Promise<ConnectionStatus> {
  const { baseUrl, apiKey, instanceName } = cleanConfig(config)
  if (!baseUrl || !apiKey) return { connected: false }

  try {
    const res = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
      headers: { apikey: apiKey },
    })
    const data = await safeFetchJson(res)
    const state = data?.instance?.state || data?.state
    const isOpen = state === 'open' || state === 'CONNECTED'
    return {
      connected: isOpen,
      number: data?.instance?.profileName || data?.profileName,
    }
  } catch {
    return { connected: false }
  }
}

export async function getQRCode(config: EvolutionConfig): Promise<string> {
  const { baseUrl, apiKey, instanceName } = cleanConfig(config)

  const res = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
    headers: { apikey: apiKey },
  })

  const data = await safeFetchJson(res)
  return (
    data?.base64 ||
    data?.qrcode?.base64 ||
    data?.code ||
    data?.count?.base64 ||
    ''
  )
}

function extractGroupArray(data: any): any[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.response)) return data.response
  if (Array.isArray(data?.groups)) return data.groups
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.result)) return data.result
  if (Array.isArray(data?.chats)) return data.chats
  if (typeof data === 'object' && data !== null) {
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) return data[key]
    }
  }
  return []
}

export async function getGroups(config: EvolutionConfig): Promise<WhatsAppGroup[]> {
  const { baseUrl, apiKey, instanceName } = cleanConfig(config)

  const requests: { url: string; method: 'GET' | 'POST'; body?: string }[] = [
    { url: `${baseUrl}/group/fetchAllGroups/${instanceName}?getParticipants=false`, method: 'GET' },
    { url: `${baseUrl}/group/fetchAllGroups/${instanceName}`, method: 'POST', body: JSON.stringify({ getParticipants: false }) },
    { url: `${baseUrl}/group/fetchAllGroups/${instanceName}`, method: 'GET' },
    { url: `${baseUrl}/chat/findChats/${instanceName}`, method: 'POST', body: JSON.stringify({}) },
    { url: `${baseUrl}/chat/findChats/${instanceName}`, method: 'GET' },
    { url: `${baseUrl}/group/findGroupSubjects/${instanceName}`, method: 'GET' },
  ]

  let data: any = null

  for (const req of requests) {
    try {
      const res = await fetch(req.url, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: req.body,
      })
      if (res.ok) {
        const text = await res.text()
        if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
          const parsed = JSON.parse(text)
          if (parsed) {
            const extracted = extractGroupArray(parsed)
            if (extracted.length > 0) {
              data = parsed
              break
            } else if (!data) {
              data = parsed
            }
          }
        }
      }
    } catch {}
  }

  if (!data) return []

  const list = extractGroupArray(data)

  return list
    .filter((g: any) => g && typeof g === 'object')
    .map((g: any) => {
      const rawId = g.id || g.jid || g.groupJid || g.chatJid || g.remoteJid || ''
      const idString = typeof rawId === 'string' ? rawId : rawId?._serialized || rawId?.user || ''
      const name = g.subject || g.name || g.groupName || g.topic || g.pushName || g.title || ''
      const count = typeof g.size === 'number'
        ? g.size
        : Array.isArray(g.participants)
        ? g.participants.length
        : typeof g.memberCount === 'number'
        ? g.memberCount
        : 0

      return {
        id: idString || String(Math.random()),
        name: String(name || 'Grupo sem nome'),
        memberCount: Number(count),
        isAdmin: g.owner === true || g.isAdmin === true || !!g.admin || !!g.isOwner,
      }
    })
    .filter((g) => {
      const isGroupJid = g.id.includes('@g.us') || g.id.includes('g.us')
      return (isGroupJid || g.name !== 'Grupo sem nome') && g.name.trim().length > 0 && !g.id.startsWith('cms')
    })
}

export async function sendTextMessage(
  config: EvolutionConfig,
  groupId: string,
  text: string
): Promise<void> {
  const { baseUrl, apiKey, instanceName } = cleanConfig(config)
  const number = groupId.includes('@') ? groupId : `${groupId}@g.us`

  const res = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
    },
    body: JSON.stringify({
      number,
      text,
      options: {
        delay: 1000,
        presence: 'composing',
      },
    }),
  })

  const textResp = await res.text()
  let data: any = {}
  try { data = JSON.parse(textResp) } catch {}

  if (res.ok) return

  if (number.includes('@g.us')) {
    const cleanNumber = number.replace('@g.us', '')
    const retryRes = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: cleanNumber,
        text,
      }),
    })
    if (retryRes.ok) return
  }

  const errorMsg = parseErrorMessage(data, res.status)
  throw new Error(errorMsg)
}

export async function sendMediaMessage(
  config: EvolutionConfig,
  groupId: string,
  mediaUrl: string,
  caption: string,
  mediaType: 'image' | 'video' = 'image'
): Promise<void> {
  const { baseUrl, apiKey, instanceName } = cleanConfig(config)
  const number = groupId.includes('@') ? groupId : `${groupId}@g.us`

  let cleanMedia = mediaUrl
  // Se for Data URL (data:video/mp4;base64,AAAA...), extrai a string base64 pura sem o cabeçalho data:
  if (mediaUrl.startsWith('data:')) {
    const commaIdx = mediaUrl.indexOf(',')
    if (commaIdx !== -1) {
      cleanMedia = mediaUrl.substring(commaIdx + 1)
    }
  }

  const payload = {
    number,
    mediatype: mediaType,
    media: cleanMedia,
    mediaUrl: mediaUrl.startsWith('http') ? mediaUrl : undefined,
    caption,
    text: caption,
    fileName: mediaType === 'video' ? 'video.mp4' : 'imagem.jpg',
    mimetype: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
  }

  const res = await fetch(`${baseUrl}/message/sendMedia/${instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
    },
    body: JSON.stringify(payload),
  })

  const textResp = await res.text()
  let data: any = {}
  try { data = JSON.parse(textResp) } catch {}

  if (res.ok) return

  if (number.includes('@g.us')) {
    const cleanNumber = number.replace('@g.us', '')
    const retryRes = await fetch(`${baseUrl}/message/sendMedia/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({
        ...payload,
        number: cleanNumber,
      }),
    })
    if (retryRes.ok) return
  }

  const errorMsg = parseErrorMessage(data, res.status)
  throw new Error(errorMsg)
}

export async function createGroup(
  config: EvolutionConfig,
  groupName: string,
  participants: string[] = []
): Promise<{ groupId: string; inviteLink: string }> {
  const { baseUrl, apiKey, instanceName } = cleanConfig(config)

  const res = await fetch(`${baseUrl}/group/create/${instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
    },
    body: JSON.stringify({
      subject: groupName,
      description: `Grupo oficial criado pelo AfiliaX`,
      participants: participants,
    }),
  })

  const data = await safeFetchJson(res)

  if (!res.ok) {
    throw new Error(parseErrorMessage(data, res.status))
  }

  const groupId = data?.id || data?.gid || data?.groupJid || ''

  let inviteLink = ''
  if (groupId) {
    try {
      const inviteRes = await fetch(`${baseUrl}/group/inviteCode/${instanceName}?groupJid=${groupId}`, {
        headers: { apikey: apiKey },
      })
      const inviteData = await safeFetchJson(inviteRes)
      const code = inviteData?.code || inviteData?.inviteCode || ''
      if (code) inviteLink = `https://chat.whatsapp.com/${code}`
    } catch {}
  }

  return { groupId, inviteLink }
}
