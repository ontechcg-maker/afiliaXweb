import { getSystemConfig } from './systemConfigService.js'

export function cleanCopyText(rawText) {
  if (!rawText) return ''
  let cleaned = String(rawText).trim()

  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

  const firstEmojiOrBold = cleaned.search(/(?:[🔥🚨👀⭐💥💰⚡😈😂✅👉🛒📦😍💨]|(?:\*[^*]+\*))/su)
  if (firstEmojiOrBold > 0 && firstEmojiOrBold < 350) {
    cleaned = cleaned.substring(firstEmojiOrBold).trim()
  } else {
    cleaned = cleaned
      .replace(/^(?:The user wants|Constraints:|Challenge:|Drafting process|Aqui está|Segue a copy|Copy gerada|Mensagem gerada)[\s\S]*?:\s*\n*/i, '')
      .trim()
  }

  cleaned = cleaned
    .replace(/^(?:Subject|Title|Copy|MENSAGEM):\s*/gi, '')
    .trim()

  cleaned = cleaned
    .replace(/\n+(?:Word count check|Mental Check|Drafting check|Portuguese words)[\s\S]*$/i, '')
    .trim()

  return cleaned
}

export async function generateCopyService(prompt) {
  const { openrouterKey, geminiKey, openaiApiKey, aiModel } = await getSystemConfig()
  const attempts = []

  // 1. Gemini
  if (geminiKey && geminiKey.trim()) {
    let modelName = (aiModel || 'gemini-2.0-flash').replace(/^google\//, '').replace(/:\w+$/, '')
    if (modelName === 'gemini-2.0-flash-exp' || modelName === 'gemini-exp-1206' || modelName === '__custom__') {
      modelName = 'gemini-2.0-flash'
    }

    const fallbackModels = Array.from(new Set([
      modelName,
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-2.5-flash',
      'gemini-1.5-pro',
    ]))

    for (const m of fallbackModels) {
      for (const ver of ['v1beta', 'v1']) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/${ver}/models/${m}:generateContent?key=${geminiKey.trim()}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
              }),
            }
          )
          const data = await response.json()
          if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
            return cleanCopyText(data.candidates[0].content.parts[0].text)
          }
          if (data.error?.message) {
            attempts.push(`Gemini (${m}): ${data.error.message}`)
          }
        } catch (err) {
          attempts.push(`Gemini (${m}): ${err.message}`)
        }
      }
    }
  }

  // 2. OpenRouter
  if (openrouterKey && openrouterKey.trim()) {
    const targetOpenRouterModel = aiModel && aiModel !== '__custom__' && aiModel !== 'google/gemini-2.0-flash-exp:free' 
      ? aiModel 
      : 'meta-llama/llama-3.3-70b-instruct:free'

    const modelsToTry = Array.from(new Set([
      targetOpenRouterModel,
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemini-2.0-flash-exp:free',
      'deepseek/deepseek-r1:free',
      'qwen/qwen-2.5-coder-32b-instruct:free',
    ]))

    for (const m of modelsToTry) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openrouterKey.trim()}`,
            'HTTP-Referer': 'https://app.ontechcg.cloud',
            'X-Title': 'AfiliaX SaaS',
          },
          body: JSON.stringify({
            model: m,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 2000,
            temperature: 0.7,
          }),
        })
        const data = await response.json()
        if (response.ok && data.choices?.[0]?.message?.content) {
          return cleanCopyText(data.choices[0].message.content)
        }
        if (data.error?.message) {
          attempts.push(`OpenRouter (${m}): ${data.error.message}`)
          if (data.error.code === 401 || data.error.message.includes('User not found')) {
            break
          }
        }
      } catch (err) {
        attempts.push(`OpenRouter (${m}): ${err.message}`)
      }
    }
  }

  // 3. OpenAI
  if (openaiApiKey && openaiApiKey.trim()) {
    try {
      const targetModel = aiModel && !aiModel.includes('/') && aiModel !== '__custom__' ? aiModel : 'gpt-4o-mini'
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey.trim()}`,
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2000,
          temperature: 0.7,
        }),
      })
      const data = await response.json()
      if (response.ok && data.choices?.[0]?.message?.content) {
        return cleanCopyText(data.choices[0].message.content)
      }
      if (data.error?.message) {
        attempts.push(`OpenAI (${targetModel}): ${data.error.message}`)
      }
    } catch (err) {
      attempts.push(`OpenAI: ${err.message}`)
    }
  }

  if (attempts.length > 0) {
    throw new Error(`Não foi possível gerar a copy. Detalhes: ${attempts.join(' | ')}. Dica: Acesse o Painel Admin > Configurações de IA e verifique suas chaves de API.`)
  }

  throw new Error('Nenhuma chave de API de Inteligência Artificial está configurada no servidor. Acesse o Painel Admin > Configurações de IA.')
}
