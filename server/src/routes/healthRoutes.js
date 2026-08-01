import express from 'express'
import { schedulerRunning } from '../services/schedulerService.js'
import { EVOLUTION_BASE_URL } from '../config/env.js'
import { supabaseAdmin } from '../config/supabase.js'

const router = express.Router()

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    scheduler: schedulerRunning,
    evolution: Boolean(EVOLUTION_BASE_URL),
    supabase: Boolean(supabaseAdmin),
  })
})

export default router
