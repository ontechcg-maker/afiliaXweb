import { supabaseAdmin } from '../config/supabase.js'
import { EVOLUTION_BASE_URL, EVOLUTION_API_KEY } from '../config/env.js'

export async function getSystemConfig() {
  let baseUrl = (EVOLUTION_BASE_URL || '').replace(/\/manager.*$/i, '').replace(/\/$/, '')
  let apiKey = EVOLUTION_API_KEY
  let openrouterKey = process.env.OPENROUTER_API_KEY || ''
  let geminiKey = process.env.GEMINI_API_KEY || ''
  let openaiKey = process.env.OPENAI_API_KEY || ''
  let aiProvider = 'openrouter'
  let aiModel = 'google/gemini-2.0-flash-exp:free'
  let shopeeAppId = process.env.SHOPEE_APP_ID || ''
  let shopeeAppSecret = process.env.SHOPEE_APP_SECRET || ''
  let customModel = ''


  if (supabaseAdmin) {
    try {
      const { data } = await supabaseAdmin.from('system_config').select('*')
      if (data && data.length > 0) {
        const map = data.reduce((acc, i) => {
          acc[i.key] = i.value
          return acc
        }, {})
        if (map.evolution_base_url) baseUrl = map.evolution_base_url.trim().replace(/\/manager.*$/i, '').replace(/\/$/, '')
        if (map.evolution_api_key) apiKey = map.evolution_api_key.trim()
        if (map.openrouter_api_key) openrouterKey = map.openrouter_api_key.trim()
        if (map.gemini_api_key) geminiKey = map.gemini_api_key.trim()
        if (map.openai_api_key) openaiKey = map.openai_api_key.trim()
        if (map.shopee_app_id) shopeeAppId = map.shopee_app_id.trim()
        if (map.shopee_app_secret) shopeeAppSecret = map.shopee_app_secret.trim()
        if (map.ai_provider) aiProvider = map.ai_provider.trim()
        if (map.ai_model) aiModel = map.ai_model.trim()
        if (map.custom_model) customModel = map.custom_model.trim()
      }
    } catch {}
  }

  let effectiveModel = aiModel
  if (aiModel === '__custom__' || !aiModel) {
    effectiveModel = customModel || 'google/gemini-2.0-flash-exp:free'
  }

  return { baseUrl, apiKey, openrouterKey, geminiKey, openaiApiKey: openaiKey, shopeeAppId, shopeeAppSecret, aiProvider, aiModel: effectiveModel, customModel }
}
