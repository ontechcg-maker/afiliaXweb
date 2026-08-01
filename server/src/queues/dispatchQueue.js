import { REDIS_URL } from '../config/env.js'

let dispatchQueue = null
let redisAvailable = false

try {
  const { Queue, Worker } = await import('bullmq')
  const { default: Redis } = await import('ioredis')

  const connection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => {
      if (times > 2) {
        console.warn('⚠️ [Redis] Não foi possível conectar ao servidor Redis. Ativando modo Fallback Gracioso em Memória.')
        return null
      }
      return 1000
    },
    lazyConnect: true,
  })

  connection.on('error', () => {
    redisAvailable = false
  })

  await connection.connect().then(() => {
    redisAvailable = true
    console.log('✅ [Redis] Conectado com sucesso. Fila de disparos assíncronos (BullMQ) ativa.')
  }).catch(() => {
    redisAvailable = false
  })

  if (redisAvailable) {
    dispatchQueue = new Queue('afiliax-dispatches', { connection })

    new Worker(
      'afiliax-dispatches',
      async (job) => {
        const { handlerName, payload } = job.data
        console.log(`[BullMQ Worker] Processando job ${job.id} (${handlerName})...`)
        // O processamento é manipulado pelo schedulerService
      },
      { connection, concurrency: 5 }
    )
  }
} catch (e) {
  console.warn('[Queue Initialization] Executando sem Redis (Fallback Gracioso em Memória):', e.message)
}

export async function enqueueDispatch(jobName, payload) {
  if (redisAvailable && dispatchQueue) {
    try {
      await dispatchQueue.add(jobName, payload, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
      })
      return { inQueue: true }
    } catch {
      return { inQueue: false }
    }
  }
  return { inQueue: false }
}
