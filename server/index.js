import express from 'express'
import cors from 'cors'
import { PORT, allowedOrigins, EVOLUTION_BASE_URL } from './src/config/env.js'
import { supabaseAdmin } from './src/config/supabase.js'
import { startSchedulerWorker } from './src/services/schedulerService.js'
import { handleRedirectController } from './src/controllers/linkController.js'

import adminRoutes from './src/routes/adminRoutes.js'
import offerRoutes from './src/routes/offerRoutes.js'
import aiRoutes from './src/routes/aiRoutes.js'
import linkRoutes from './src/routes/linkRoutes.js'
import whatsappRoutes from './src/routes/whatsappRoutes.js'
import instagramRoutes from './src/routes/instagramRoutes.js'
import healthRoutes from './src/routes/healthRoutes.js'

const app = express()

// ─── Middlewares Globais ──────────────────────────────────────────
app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json({ limit: '100mb' }))
app.use(express.urlencoded({ limit: '100mb', extended: true }))

// ─── Rota de Redirecionamento Direto (/r/:code) ────────────────────
app.get('/r/:code', handleRedirectController)

// ─── Router Principal da API (/api) ──────────────────────────────
const apiRouter = express.Router()

apiRouter.use('/', healthRoutes)
apiRouter.use('/admin', adminRoutes)
apiRouter.use('/', offerRoutes)
apiRouter.use('/', aiRoutes)
apiRouter.use('/', linkRoutes)
apiRouter.use('/whatsapp', whatsappRoutes)
apiRouter.use('/instagram', instagramRoutes)

// Suporte para Traefik / Stripprefix e chamadas diretas
app.use('/api/api', apiRouter)
app.use('/api', apiRouter)
app.use('/', apiRouter)

// ─── Inicialização do Worker 24/7 de Agendamentos & Keep-Alive ─────
startSchedulerWorker()

// ─── Inicialização do Servidor Express ───────────────────────────
app.listen(PORT, () => {
  console.log(`✅ AfiliaX Server (SaaS Modular) rodando em http://localhost:${PORT}`)
  console.log(`   Evolution API: ${EVOLUTION_BASE_URL || '⚠️  não configurada'}`)
  console.log(`   Supabase Admin: ${supabaseAdmin ? '✅ conectado' : '⚠️  não configurado'}`)
  console.log(`   Origins permitidas: ${allowedOrigins.join(', ')}`)
})
