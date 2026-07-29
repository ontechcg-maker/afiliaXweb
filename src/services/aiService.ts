export type AIProvider = 'gemini' | 'openai' | 'openrouter' | 'ollama'
export type CopyTone = 'urgent' | 'casual' | 'review' | 'short' | 'aggressive' | 'funny'

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  model: string
  ollamaUrl?: string
}

export interface ProductData {
  title: string
  priceFrom?: number
  priceTo?: number
  discountPct?: number
  coupon?: string
  rating?: number
  affiliateLink: string
}

const TONE_PROMPTS: Record<CopyTone, string> = {
  urgent: `ESTILO URGENTE (ALERTA DE PREÇO) 🔥
Crie uma mensagem direta de urgência. NÃO use rótulos como "Result:", "Proof:" ou "Scarcity:". Exemplo de estrutura:
🔥 O Percarbonato de Sódio 3kg caiu de ~R$ 68,90~ para *R$ 55,12*!

Tire manchas impossíveis, clareie roupas brancas e higienize a casa toda sem esforço.

⭐ Um dos mais vendidos da semana! Estoque promocional acabando rápido.

👉 Garanta o seu antes que volte ao preço cheio: [Link]`,

  casual: `ESTILO CASUAL (ACHADINHO DO DIA) 😄
Crie uma indicação informal de amigo. NÃO use rótulos como "Result:", "Proof:" ou "Hook:". Exemplo de estrutura:
👀 Gente, achadinho de lavanderia que tá salvando minhas roupas!

Todo mundo perguntando o segredo das roupas brancas de verdade... é esse pó mágico. Tira amarelado sem esforço.

Saiu de ~R$ 68,90~ por apenas *R$ 55,12*!

👉 Veja a oferta enquanto está disponível: [Link]`,

  review: `ESTILO REVIEW / RECOMENDAÇÃO ⭐
Crie um review curto com nota de comprador. NÃO use rótulos como "Result:" ou "Proof:". Exemplo de estrutura:
⭐ VALE A PENA COMPRAR?

✅ Rende muito mais que alvejante comum
✅ Clareia tecidos sem agredir
✅ Mais de 50 mil unidades vendidas

De ~R$ 68,90~ por apenas *R$ 55,12*!

👉 Confira todos os detalhes no link: [Link]`,

  short: `ESTILO CURTO (30 A 50 PALAVRAS) 💨
Crie uma mensagem minimalista de 3 a 4 linhas. NÃO use rótulos. Exemplo:
💥 *Percarbonato de Sódio 3kg em Oferta!*
⚡ Clareia roupas brancas e tira manchas sem esforço.
💰 De ~R$ 68,90~ por *R$ 55,12*!
👉 Garanta o seu aqui: [Link]`,

  aggressive: `ESTILO AGRESSIVO / PROBLEMA-SOLUÇÃO 😈
Crie uma mensagem focada na dor do cliente. NÃO use rótulos. Exemplo:
Cansado de passar raiva com roupas amareladas e manchas que não saem?

Esfregar na mão e gastar com cloro forte só estraga o tecido. Esse pó faz o trabalho sozinho em minutos.

De ~R$ 68,90~ por apenas *R$ 55,12*!

👉 Resolva isso hoje e garanta o seu: [Link]`,

  funny: `ESTILO ENGRAÇADO / HUMOR 🤣
Crie uma mensagem divertida e bem humorada. NÃO use rótulos. Exemplo de estrutura:
😂 Minha mãe disse que se essa roupa branca não limpasse, eu é quem ia morar fora!

Descobri esse pote mágico e agora sou o rei da lavanderia. Tira até a mancha de pecado do passado.

Caiu de ~R$ 68,90~ por só *R$ 55,12*!

👉 Vem ver antes que minha mãe use tudo: [Link]`,
}

function buildPrompt(product: ProductData, tone: CopyTone): string {
  const toneInstructions = TONE_PROMPTS[tone]
  return `Escreva UMA MENSAGEM DIRETA de vendas de afiliados para WhatsApp em português do Brasil.

PROIBIDO: NÃO escreva palavras em inglês como "Result:", "Scarcity:", "Proof:", "Hook:", "Drafting:", "Constraints:". Escreva APENAS o texto corrido da mensagem.

Diretrizes da Mensagem:
- Tamanho: 40 a 80 palavras (escaneável em 10 segundos).
- Venda o Resultado e a Transformação prática do produto.
- Formatação WhatsApp: Use *negrito* em preços promocionais e nomes, ~riscado~ em preços antigos.
- CTA no final: Termine exatamente com a chamada e o link na última linha.

Abordagem Desejada:
${toneInstructions}

Dados do Produto:
- Nome do Produto: ${product.title}
- Preço DE (Original): ${product.priceFrom && product.priceFrom > 0 ? `R$ ${product.priceFrom.toFixed(2).replace('.', ',')}` : 'Não informado'}
- Preço POR (Promocional): ${product.priceTo && product.priceTo > 0 ? `R$ ${product.priceTo.toFixed(2).replace('.', ',')}` : 'Não informado'}
- Desconto: ${product.discountPct ? `${product.discountPct}% OFF` : 'Desconto especial'}
- Link de Afiliado: ${product.affiliateLink}

MENSAGEM FINAL PRONTA PARA O WHATSAPP:`
}

/**
 * Remove qualquer palavra ou rótulo de raciocínio de IA (Result:, Scarcity/Proof:, Hook:, etc.)
 */
export function cleanCopyOutput(rawText: string): string {
  let cleaned = rawText.trim()

  // 1. Remove rótulos em inglês que a IA às vezes inclui no corpo da mensagem
  cleaned = cleaned
    .replace(/(?:Result|Scarcity\/Proof|Scarcity|Proof|Hook|Curiosity|Benefit|Offer|CTA):\s*/gi, '')
    .replace(/^Subject:\s*/gi, '')
    .replace(/^Title:\s*/gi, '')
    .trim()

  // 2. Localiza a primeira ocorrência de emoji de início de mensagem
  const emojiIndex = cleaned.search(/(?:👀|🔥|⭐|💥|🚨|💰|⚡|😈|😂|✅|👉|🛒|📦|😍)/)
  if (emojiIndex !== -1 && emojiIndex < 120) {
    cleaned = cleaned.substring(emojiIndex)
  }

  // 3. Remove seções finais de "Word count check" ou "Mental check"
  const endCheckIndex = cleaned.search(/(?:Word count check|Mental Check|Drafting check|Portuguese words)/i)
  if (endCheckIndex !== -1) {
    cleaned = cleaned.substring(0, endCheckIndex)
  }

  // 4. Limpeza final de cabeçalhos genéricos
  cleaned = cleaned
    .replace(/^The user wants[\s\S]*?(Drafting the copy|\(Mental Check\)|Drafting strategy):\s*/i, '')
    .replace(/^(Aqui está|Segue a copy|Copy gerada)[\s\S]*?:\n*/i, '')
    .trim()

  return cleaned
}

import { authHeader } from './authService'

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export async function generateCopy(
  product: ProductData,
  tone: CopyTone,
  config?: AIConfig
): Promise<string> {
  const prompt = buildPrompt(product, tone)
  let rawCopy = ''

  // 1. Se o cliente forneceu uma chave pessoal de IA nas configurações, usa direto
  if (config?.apiKey && config.apiKey.trim().length > 0) {
    switch (config.provider) {
      case 'gemini':
        rawCopy = await generateWithGemini(prompt, config)
        break
      case 'openai':
        rawCopy = await generateWithOpenAI(prompt, config)
        break
      case 'openrouter':
        rawCopy = await generateWithOpenRouter(prompt, config)
        break
      case 'ollama':
        rawCopy = await generateWithOllama(prompt, config)
        break
    }
  }

  // 2. Se não gerou via chave pessoal, chama a IA centralizada no backend do SaaS
  if (!rawCopy) {
    try {
      const headers = await authHeader()
      const res = await fetch(`${API_BASE_URL}/api/generate-copy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      if (res.ok && data.copy) {
        rawCopy = data.copy
      } else if (data.error) {
        throw new Error(data.error)
      }
    } catch (e: any) {
      throw new Error(e.message || 'Erro ao se comunicar com a Inteligência Artificial do SaaS.')
    }
  }

  return cleanCopyOutput(rawCopy)
}

async function generateWithGemini(prompt: string, config: AIConfig): Promise<string> {
  const primaryModel = config.model || 'gemini-1.5-flash'
  const fallbackModels = [
    primaryModel,
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro',
    'gemini-2.0-flash',
    'gemini-1.5-flash-latest',
  ]
  const modelsToTry = Array.from(new Set(fallbackModels))

  let lastError = ''

  for (const model of modelsToTry) {
    const apiVersions = ['v1beta', 'v1']
    for (const version of apiVersions) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${config.apiKey.trim()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
            }),
          }
        )
        const data = await res.json()
        if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          return data.candidates[0].content.parts[0].text
        }
        if (data.error?.message) {
          lastError = data.error.message
        }
      } catch (e: any) {
        lastError = e.message
      }
    }
  }

  throw new Error(
    `Gemini API (${lastError}). DICA: Se a sua cota do Gemini estiver limitada no Google AI Studio, você pode alterar para o provedor "OpenRouter" em Configurações e usar qualquer modelo como "deepseek/deepseek-chat" ou "google/gemini-2.0-flash-exp:free".`
  )
}

async function generateWithOpenAI(prompt: string, config: AIConfig): Promise<string> {
  const model = config.model || 'gpt-4o-mini'
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Erro na OpenAI')
  return data.choices?.[0]?.message?.content ?? ''
}

async function generateWithOpenRouter(prompt: string, config: AIConfig): Promise<string> {
  const model = config.model || 'deepseek/deepseek-chat'
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey.trim()}`,
      'HTTP-Referer': 'https://afiliax.app',
      'X-Title': 'AfiliaX',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Erro no OpenRouter')
  return data.choices?.[0]?.message?.content ?? ''
}

async function generateWithOllama(prompt: string, config: AIConfig): Promise<string> {
  const baseUrl = config.ollamaUrl || 'http://localhost:11434'
  const model = config.model || 'llama3.2'
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error('Erro no Ollama')
  return data.response ?? ''
}
