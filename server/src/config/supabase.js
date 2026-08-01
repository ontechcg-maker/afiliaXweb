import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from './env.js'

export let supabaseAnon = null
export let supabaseAdmin = null

try {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
} catch (e) {
  console.error('[Supabase Anon Client] Erro de inicialização:', e.message)
}

try {
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
} catch (e) {
  console.error('[Supabase Admin Client] Erro de inicialização:', e.message)
}
