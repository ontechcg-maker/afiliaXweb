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

export function formatCustomTemplate(template: string, product: ProductData): string {
  const priceFromFormatted = product.priceFrom && product.priceFrom > 0
    ? `R$ ${product.priceFrom.toFixed(2).replace('.', ',')}`
    : ''
  const priceToFormatted = product.priceTo && product.priceTo > 0
    ? `R$ ${product.priceTo.toFixed(2).replace('.', ',')}`
    : ''
  const discountFormatted = product.discountPct ? `${product.discountPct}%` : ''
  const couponFormatted = product.coupon ? `🎟️ Cupom: *${product.coupon}*` : ''

  return template
    .replace(/\{PRODUTO\}|\{NOME_PRODUTO\}/g, product.title || '')
    .replace(/\{PRECO_DE\}/g, priceFromFormatted)
    .replace(/\{PRECO_POR\}/g, priceToFormatted)
    .replace(/\{DESCONTO\}/g, discountFormatted)
    .replace(/\{CUPOM\}/g, couponFormatted)
    .replace(/\{LINK\}|\{LINK_AFILIADO\}/g, product.affiliateLink || '')
    .trim()
}

function buildPrompt(product: ProductData, tone: CopyTone | string): string {
  const toneInstructions = TONE_PROMPTS[tone as CopyTone] || tone
  const priceFromFormatted = product.priceFrom && product.priceFrom > 0 ? `R$ ${product.priceFrom.toFixed(2).replace('.', ',')}` : 'Não informado'
  const priceToFormatted = product.priceTo && product.priceTo > 0 ? `R$ ${product.priceTo.toFixed(2).replace('.', ',')}` : 'Não informado'
  const discountFormatted = product.discountPct ? `${product.discountPct}% OFF` : 'Desconto especial'
  const couponText = product.coupon ? `\n- Cupom: ${product.coupon}` : ''

  return `ATENÇÃO E REGRA ABSOLUTA: Responda DIRETA E EXCLUSIVAMENTE com a mensagem completa e pronta de divulgação para o WhatsApp em português do Brasil.
PROIBIDO incluir raciocínio, explicações ou notas em inglês antes ou depois do texto.

Diretrizes da Mensagem:
- Venda o Resultado e a Transformação prática do produto.
- Formatação WhatsApp: Use *negrito* em preços promocionais e nomes, ~riscado~ em preços antigos.
- CTA no final: Termine obrigatoriamente com a chamada de ação e o link na última linha.

Abordagem Desejada / Instruções do Modelo:
${toneInstructions}

Dados do Produto:
- Nome do Produto: ${product.title}
- Preço DE (Original): ${priceFromFormatted}
- Preço POR (Promocional): ${priceToFormatted}
- Desconto: ${discountFormatted}${couponText}
- Link de Afiliado: ${product.affiliateLink}

MENSAGEM FINAL COMPLETA PRONTA PARA O WHATSAPP:`
}

/**
 * Remove qualquer palavra, raciocínio interno ou rótulo de IA sem cortar o conteúdo real da copy.
 */
export function cleanCopyOutput(rawText: string): string {
  if (!rawText) return ''
  let cleaned = rawText.trim()

  // 1. Remove qualquer bloco <think>...</think> (DeepSeek R1 / Reasoning Models)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

  // 2. Se a resposta contiver préambulo de raciocínio antes da mensagem real da copy
  const firstEmojiOrBold = cleaned.search(/(?:[🔥🚨👀⭐💥💰⚡😈😂✅👉🛒📦😍💨]|(?:\*[^*]+\*))/su)
  if (firstEmojiOrBold > 0 && firstEmojiOrBold < 350) {
    cleaned = cleaned.substring(firstEmojiOrBold).trim()
  } else {
    // Remove frases introdutórias comuns sem apagar linhas de produto/preço
    cleaned = cleaned
      .replace(/^(?:The user wants|Constraints:|Challenge:|Drafting process|Aqui está|Segue a copy|Copy gerada|Mensagem gerada)[\s\S]*?:\s*\n*/i, '')
      .trim()
  }

  // 3. Remove rótulos isolados no topo da mensagem
  cleaned = cleaned
    .replace(/^(?:Subject|Title|Copy|MENSAGEM):\s*/gi, '')
    .trim()

  // 4. Remove rodapés de checagem interna da IA se houver
  cleaned = cleaned
    .replace(/\n+(?:Word count check|Mental Check|Drafting check|Portuguese words)[\s\S]*$/i, '')
    .trim()

  return cleaned
}

import { authHeader } from './authService'
import { getApiUrl } from './apiUrl'

export async function generateCopy(
  product: ProductData,
  tone: CopyTone | string,
  config?: AIConfig
): Promise<string> {
  const prompt = buildPrompt(product, tone)
  let rawCopy = ''

  // 1. Tenta usar a chave pessoal do cliente se fornecida nas configurações
  if (config?.apiKey && config.apiKey.trim().length > 0) {
    try {
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
    } catch (clientErr: any) {
      console.warn('[AI Service] Chave do cliente inválida. Usando IA do SaaS:', clientErr.message)
      rawCopy = '' // Se a chave pessoal falhar, força o fallback para a IA do SaaS
    }
  }

  // 2. Se não gerou via chave pessoal (ou se a chave falhou), usa a IA centralizada do SaaS no backend
  if (!rawCopy) {
    try {
      const headers = await authHeader()
      const res = await fetch(getApiUrl('/generate-copy'), {
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
  let modelName = (config.model || 'gemini-2.0-flash')
    .replace(/^google\//, '')
    .replace(/:\w+$/, '')

  if (modelName === 'gemini-2.0-flash-exp' || modelName === 'gemini-exp-1206') {
    modelName = 'gemini-2.0-flash'
  }

  const fallbackModels = [
    modelName,
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.5-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash-8b',
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
              generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
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
    `Gemini API (${lastError}). DICA: Se a sua cota do Gemini estiver limitada no Google AI Studio, você pode alterar para o provedor "OpenRouter" em Configurações e usar qualquer modelo como "deepseek/deepseek-chat" ou "google/gemini-2.0-flash".`
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
      max_tokens: 2000,
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
      max_tokens: 2000,
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
