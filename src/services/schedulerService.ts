import type { EvolutionConfig } from './evolutionService'
import { getGroups, sendMediaMessage, sendTextMessage } from './evolutionService'

export interface ScheduledPost {
  id: string
  offerId: string
  title: string
  copyText: string
  imageUrl?: string
  affiliateLink: string
  channels: ScheduleChannel[]
  scheduledAt: Date
  status: 'pending' | 'sent' | 'failed' | 'skipped'
}

export interface ScheduleChannel {
  type: 'whatsapp' | 'telegram'
  targetId: string
  targetName: string
}

export interface HealthScore {
  score: 'excellent' | 'good' | 'warning' | 'danger'
  label: string
  color: string
  message: string
}

export interface ScheduleSuggestion {
  posts: ScheduledPost[]
  healthScore: HealthScore
  totalDuration: string
}

const BEST_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21]

/**
 * Calcula a próxima data de envio na fila baseando-se no intervalo de minutos cadastrado
 */
export function calculateNextScheduleTime(existingQueue: ScheduledPost[], intervalMinutes: number): Date {
  const pendingPosts = existingQueue.filter((p) => p.status === 'pending')
  const now = new Date()

  if (pendingPosts.length === 0) {
    return new Date(now.getTime() + intervalMinutes * 60 * 1000)
  }

  const latestDate = pendingPosts.reduce((latest, post) => {
    const postDate = new Date(post.scheduledAt)
    return postDate > latest ? postDate : latest
  }, new Date(0))

  const baseDate = latestDate > now ? latestDate : now
  return new Date(baseDate.getTime() + intervalMinutes * 60 * 1000)
}

/**
 * Calcula o Health Score da fila com base no intervalo médio entre envios
 */
export function calculateHealthScore(intervalMinutes: number): HealthScore {
  if (intervalMinutes >= 20) {
    return {
      score: 'excellent',
      label: 'EXCELENTE',
      color: '#22c55e',
      message: `Intervalo de ${intervalMinutes}min — risco de spam: mínimo`,
    }
  } else if (intervalMinutes >= 10) {
    return {
      score: 'good',
      label: 'BOM',
      color: '#22d3ee',
      message: `Intervalo de ${intervalMinutes}min — risco de spam: baixo`,
    }
  } else if (intervalMinutes >= 5) {
    return {
      score: 'warning',
      label: 'ATENÇÃO',
      color: '#eab308',
      message: `Intervalo de ${intervalMinutes}min — risco moderado de bloqueio`,
    }
  } else {
    return {
      score: 'danger',
      label: 'PERIGO',
      color: '#ef4444',
      message: `Intervalo de ${intervalMinutes}min — risco alto de banimento!`,
    }
  }
}

/**
 * Sugere automaticamente os melhores horários para uma lista de posts
 */
export function suggestSchedule(
  posts: Omit<ScheduledPost, 'scheduledAt' | 'status'>[],
  intervalMinutes: number,
  startFrom?: Date
): ScheduleSuggestion {
  const now = startFrom || new Date()
  const scheduled: ScheduledPost[] = []

  let currentTime = new Date(now)

  if (!BEST_HOURS.includes(currentTime.getHours())) {
    const nextBestHour = BEST_HOURS.find((h) => h > currentTime.getHours()) || BEST_HOURS[0]
    if (nextBestHour <= currentTime.getHours()) {
      currentTime.setDate(currentTime.getDate() + 1)
    }
    currentTime.setHours(nextBestHour, 0, 0, 0)
  }

  for (const post of posts) {
    if (currentTime.getHours() >= 22) {
      currentTime.setDate(currentTime.getDate() + 1)
      currentTime.setHours(8, 0, 0, 0)
    }

    scheduled.push({
      ...post,
      scheduledAt: new Date(currentTime),
      status: 'pending',
    })

    currentTime = new Date(currentTime.getTime() + intervalMinutes * 60 * 1000)
  }

  const healthScore = calculateHealthScore(intervalMinutes)

  const first = scheduled[0]?.scheduledAt
  const last = scheduled[scheduled.length - 1]?.scheduledAt
  const durationMs = last && first ? last.getTime() - first.getTime() : 0
  const durationHours = Math.round(durationMs / (1000 * 60 * 60))
  const totalDuration = durationHours > 0
    ? `${durationHours}h de distribuição`
    : `${Math.round(durationMs / (1000 * 60))}min de distribuição`

  return { posts: scheduled, healthScore, totalDuration }
}

/**
 * Formata uma data para exibição amigável
 */
export function formatScheduleTime(date: Date): string {
  const d = new Date(date)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow = d.toDateString() === tomorrow.toDateString()

  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  if (isToday) return `Hoje às ${time}`
  if (isTomorrow) return `Amanhã às ${time}`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ` às ${time}`
}

/**
 * Dispara um post agendado específico sem duplicações
 */
export async function sendPostNow(
  post: ScheduledPost,
  evolutionConfig: EvolutionConfig
): Promise<void> {
  if (!evolutionConfig.baseUrl || !evolutionConfig.apiKey) {
    throw new Error('Configure a URL e API Key da Evolution API nas Configurações primeiro.')
  }

  let successCount = 0
  const errors: string[] = []

  for (const channel of post.channels) {
    if (channel.type === 'whatsapp') {
      let targetIds: string[] = []

      if (channel.targetId === 'all' || !channel.targetId) {
        const groups = await getGroups(evolutionConfig)
        targetIds = groups.map((g) => g.id)
      } else {
        targetIds = [channel.targetId]
      }

      for (const rawTarget of targetIds) {
        if (!rawTarget || rawTarget.startsWith('cms')) continue

        const target = rawTarget.includes('@') ? rawTarget : `${rawTarget}@g.us`
        let groupSent = false

        if (post.imageUrl && post.imageUrl.trim().length > 0) {
          const lower = post.imageUrl.toLowerCase()
          const isVideo =
            lower.startsWith('data:video/') ||
            lower.endsWith('.mp4') ||
            lower.endsWith('.webm') ||
            lower.endsWith('.mov') ||
            lower.endsWith('.m4v')

          try {
            await sendMediaMessage(
              evolutionConfig,
              target,
              post.imageUrl,
              post.copyText,
              isVideo ? 'video' : 'image'
            )
            groupSent = true
          } catch (mediaErr: any) {
            console.error(`Erro no envio de mídia para ${target}:`, mediaErr)
            throw new Error(`Falha no envio de vídeo/imagem para a Evolution API: ${mediaErr.message || 'Erro no envio'}`)
          }
        }

        if (!groupSent) {
          try {
            await sendTextMessage(evolutionConfig, target, post.copyText)
            groupSent = true
          } catch (textErr: any) {
            console.error(`Falha no envio para ${target}:`, textErr)
            errors.push(textErr.message || 'Erro no grupo')
          }
        }

        if (groupSent) {
          successCount++
        }
      }
    }
  }

  if (successCount === 0 && errors.length > 0) {
    throw new Error(errors[0])
  }
}

/**
 * Processa posts pendentes vencidos na fila
 */
export async function processDuePosts(
  evolutionConfig: EvolutionConfig,
  onPostSent?: (post: ScheduledPost) => void
): Promise<void> {
  if (!evolutionConfig.baseUrl || !evolutionConfig.apiKey) return

  const queue = loadQueue()
  const now = new Date()
  let updated = false

  for (const post of queue) {
    if (post.status === 'pending' && new Date(post.scheduledAt) <= now) {
      try {
        await sendPostNow(post, evolutionConfig)
        post.status = 'sent'
        updated = true
        if (onPostSent) onPostSent(post)
      } catch (err) {
        console.error('Erro ao disparar post agendado:', err)
        post.status = 'failed'
        updated = true
      }
    }
  }

  if (updated) {
    saveQueue(queue)
  }
}

const QUEUE_KEY = 'afiliax_queue'

export function saveQueue(queue: ScheduledPost[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('afiliax_queue_updated'))
  }
}

export function loadQueue(): ScheduledPost[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as any[]
      return parsed.map((p) => ({ ...p, scheduledAt: new Date(p.scheduledAt) }))
    }
  } catch {}

  return []
}
