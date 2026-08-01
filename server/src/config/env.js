import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

export const PORT = process.env.PORT || 3001
export const SUPABASE_URL = process.env.SUPABASE_URL || ''
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
export const EVOLUTION_BASE_URL = (process.env.EVOLUTION_BASE_URL || '').trim().replace(/\/$/, '')
export const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || ''
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'hevertonsalvador.cg@gmail.com').toLowerCase().trim()
export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

export const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())

export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
