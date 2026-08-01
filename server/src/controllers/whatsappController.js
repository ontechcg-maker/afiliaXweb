import { supabaseAdmin } from '../config/supabase.js'
import { getUserProfile } from '../middlewares/authMiddleware.js'
import { evolutionFetch, resolveTargetGroups } from '../services/evolutionService.js'
import { incrementUserPostCount } from '../middlewares/limitMiddleware.js'

export async function connectWhatsappController(req, res) {
  try {
    const profile = await getUserProfile(req.user)
    if (!profile?.instance_name) {
      return res.status(400).json({ error: 'Perfil de usuário não encontrado.' })
    }
    const { instance_name } = profile

    await evolutionFetch('/instance/create', 'POST', {
      instanceName: instance_name,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    }).catch(() => {})

    const qrData = await evolutionFetch(`/instance/connect/${instance_name}`)
    const qrCode = qrData?.base64 || qrData?.qrcode?.base64 || qrData?.code || ''

    if (supabaseAdmin) {
      await supabaseAdmin.from('profiles')
        .update({ instance_status: 'connecting' })
        .eq('id', req.user.id)
    }

    res.json({ qrCode, instanceName: instance_name })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Erro ao criar instância.' })
  }
}

export async function getWhatsappStatusController(req, res) {
  try {
    const profile = await getUserProfile(req.user)
    if (!profile?.instance_name) {
      return res.json({ connected: false, instanceName: null })
    }
    const { instance_name } = profile

    const data = await evolutionFetch(`/instance/connectionState/${instance_name}`)
    const state = data?.instance?.state || data?.state
    const connected = state === 'open' || state === 'CONNECTED'
    const whatsappNumber = data?.instance?.profileName || data?.profileName || ''

    if (supabaseAdmin) {
      await supabaseAdmin.from('profiles')
        .update({
          instance_status: connected ? 'connected' : 'disconnected',
          whatsapp_number: connected ? whatsappNumber : null,
        })
        .eq('id', req.user.id)
    }

    res.json({ connected, instanceName: instance_name, whatsappNumber })
  } catch {
    res.json({ connected: false, instanceName: null })
  }
}

export async function disconnectWhatsappController(req, res) {
  try {
    const profile = await getUserProfile(req.user)
    if (!profile?.instance_name) return res.json({ success: true })

    await evolutionFetch(`/instance/logout/${profile.instance_name}`, 'DELETE').catch(() => {})

    if (supabaseAdmin) {
      await supabaseAdmin.from('profiles')
        .update({ instance_status: 'disconnected', whatsapp_number: null })
        .eq('id', req.user.id)
    }
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

export async function getWhatsappGroupsController(req, res) {
  try {
    const profile = await getUserProfile(req.user)
    if (!profile?.instance_name) return res.json([])

    const data = await evolutionFetch(
      `/group/fetchAllGroups/${profile.instance_name}?getParticipants=false`
    )

    const list = Array.isArray(data) ? data
      : data?.groups || data?.response || data?.data || []

    const groups = list
      .filter((g) => g && typeof g === 'object')
      .map((g) => ({
        id: g.id || g.jid || g.groupJid || '',
        name: g.subject || g.name || g.groupName || 'Grupo sem nome',
        memberCount: g.size || (Array.isArray(g.participants) ? g.participants.length : 0),
        isAdmin: g.owner === true || g.isAdmin === true || !!g.isOwner,
      }))
      .filter((g) => g.id.includes('@g.us') && g.name.trim().length > 0)

    res.json(groups)
  } catch {
    res.json([])
  }
}

export async function createWhatsappGroupController(req, res) {
  try {
    const profile = await getUserProfile(req.user)
    if (!profile?.instance_name) {
      return res.status(400).json({ error: 'Perfil de usuário ou instância WhatsApp não encontrada.' })
    }
    const { name, subject, description, participants } = req.body || {}
    const groupName = (subject || name || '').trim()

    if (!groupName) {
      return res.status(400).json({ error: 'O nome do grupo é obrigatório.' })
    }

    let participantNumbers = []
    if (Array.isArray(participants)) {
      participantNumbers = participants
        .map((p) => String(p).replace(/\D/g, ''))
        .filter((p) => p.length >= 10)
    }

    const payload = {
      subject: groupName,
      description: description || '',
      participants: participantNumbers,
    }

    const createRes = await evolutionFetch(`/group/create/${profile.instance_name}`, 'POST', payload)
    const groupId = createRes?.id || createRes?.jid || createRes?.groupJid || createRes?.response?.id || ''
    
    let inviteLink = ''
    if (groupId) {
      try {
        const inviteRes = await evolutionFetch(`/group/inviteCode/${profile.instance_name}?groupJid=${encodeURIComponent(groupId)}`)
        const code = inviteRes?.code || inviteRes?.inviteCode || ''
        if (code) {
          inviteLink = `https://chat.whatsapp.com/${code}`
        }
      } catch {}
    }

    res.json({
      success: true,
      group: {
        id: groupId,
        name: groupName,
        description: description || '',
        inviteLink,
      },
    })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Erro ao criar grupo no WhatsApp.' })
  }
}

export async function sendWhatsappTextController(req, res) {
  const { groupId, text } = req.body || {}
  if (!groupId || !text) return res.status(400).json({ error: 'groupId e text são obrigatórios.' })

  try {
    const profile = await getUserProfile(req.user)
    if (!profile?.instance_name) {
      return res.status(400).json({ error: 'WhatsApp não conectado.' })
    }

    const targets = await resolveTargetGroups(profile.instance_name, groupId)
    if (targets.length === 0) {
      return res.status(400).json({ error: 'Nenhum grupo do WhatsApp encontrado para disparo.' })
    }

    let successCount = 0
    let lastError = ''
    for (const number of targets) {
      try {
        await evolutionFetch(`/message/sendText/${profile.instance_name}`, 'POST', {
          number,
          text,
          options: { delay: 1200, presence: 'composing' },
        })
        successCount++
      } catch (err) {
        lastError = err.message
      }
    }

    if (successCount === 0 && lastError) {
      throw new Error(lastError)
    }

    await incrementUserPostCount(req.user.id)
    res.json({ success: true, count: successCount })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

export async function sendWhatsappMediaController(req, res) {
  const { groupId, mediaUrl, caption, mediaType } = req.body || {}
  if (!groupId || !mediaUrl) return res.status(400).json({ error: 'groupId e mediaUrl são obrigatórios.' })

  try {
    const profile = await getUserProfile(req.user)
    if (!profile?.instance_name) {
      return res.status(400).json({ error: 'WhatsApp não conectado.' })
    }

    const targets = await resolveTargetGroups(profile.instance_name, groupId)
    if (targets.length === 0) {
      return res.status(400).json({ error: 'Nenhum grupo do WhatsApp encontrado para disparo.' })
    }

    const isDataUri = mediaUrl.startsWith('data:')
    const isHttp = mediaUrl.startsWith('http')

    let finalMediaType = mediaType || 'image'
    let mimetype = 'image/jpeg'
    let fileName = 'imagem.jpg'

    if (isDataUri) {
      const mimeMatch = mediaUrl.match(/^data:([^;]+);base64,/)
      if (mimeMatch) {
        mimetype = mimeMatch[1]
        if (mimetype.startsWith('video/')) {
          finalMediaType = 'video'
          const ext = mimetype.split('/')[1] || 'mp4'
          fileName = `video.${ext}`
        } else if (mimetype.startsWith('image/')) {
          finalMediaType = 'image'
          const ext = mimetype.split('/')[1] || 'jpeg'
          fileName = `imagem.${ext}`
        }
      }
    } else if (isHttp) {
      const lower = mediaUrl.toLowerCase()
      if (lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.mov') || lower.includes('.avi') || lower.includes('.mkv') || lower.includes('.m4v')) {
        finalMediaType = 'video'
        if (lower.includes('.webm')) mimetype = 'video/webm'
        else if (lower.includes('.mov')) mimetype = 'video/quicktime'
        else mimetype = 'video/mp4'
        fileName = 'video.mp4'
      } else if (lower.includes('.png')) {
        mimetype = 'image/png'
        fileName = 'imagem.png'
      } else if (lower.includes('.gif')) {
        mimetype = 'image/gif'
        fileName = 'imagem.gif'
      } else if (lower.includes('.webp')) {
        mimetype = 'image/webp'
        fileName = 'imagem.webp'
      }
    }

    if (mediaType === 'video') {
      finalMediaType = 'video'
      if (!mimetype.startsWith('video/')) mimetype = 'video/mp4'
      if (!fileName.startsWith('video')) fileName = 'video.mp4'
    }

    const payload = {
      mediaType: finalMediaType,
      mediatype: finalMediaType,
      media: isHttp ? mediaUrl : (isDataUri ? mediaUrl.substring(mediaUrl.indexOf(',') + 1) : mediaUrl),
      mediaUrl: isHttp ? mediaUrl : undefined,
      caption: caption || '',
      text: caption || '',
      fileName,
      mimetype,
    }

    let successCount = 0
    let lastError = ''
    for (const number of targets) {
      try {
        await evolutionFetch(
          `/message/sendMedia/${profile.instance_name}`,
          'POST',
          {
            ...payload,
            number,
          },
          180000
        )
        successCount++
      } catch (err) {
        lastError = err.message
      }
    }

    if (successCount === 0 && lastError) {
      throw new Error(lastError)
    }

    await incrementUserPostCount(req.user.id)
    res.json({ success: true, count: successCount })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
