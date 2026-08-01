import { generateCopyService } from '../services/aiService.js'
import { getSystemConfig } from '../services/systemConfigService.js'

export async function generateCopyController(req, res) {
  const { prompt } = req.body || {}
  if (!prompt) return res.status(400).json({ error: 'Prompt não fornecido.' })

  try {
    const copy = await generateCopyService(prompt)
    res.json({ copy })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

export async function getAiInfoController(_req, res) {
  try {
    const { aiProvider, aiModel } = await getSystemConfig()
    res.json({ provider: aiProvider || 'gemini', model: aiModel || 'gemini-2.0-flash' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
