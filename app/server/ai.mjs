// Recomendação com IA (OpenAI Responses API). Roda só no servidor: a chave nunca vai ao navegador.
const API = 'https://api.openai.com/v1/responses'

export const config = () => ({
  key: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL || 'gpt-6-luna',
  effort: process.env.OPENAI_REASONING_EFFORT || 'max',
  timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS || 60000),
})

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['suggestions'],
  properties: {
    suggestions: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'reason'],
        properties: {
          id: { type: 'string', description: 'id exato de um item do cardápio' },
          reason: { type: 'string', description: 'uma frase curta, em português do Brasil, falando com o cliente' },
        },
      },
    },
  },
}

function menuForPrompt(menu) {
  return menu.items
    .map((i) => {
      const t = i.tags
      const tags = [
        t.iced ? 'gelado' : 'quente',
        t.milk ? 'com leite' : 'sem leite',
        t.caffeine ? 'com cafeína' : 'sem cafeína',
        `doce ${t.sweet}/3`,
        `amargo ${t.bitter}/3`,
        `fome ${t.hunger}/3`,
      ].join(', ')
      const allergens = i.allergens?.length ? ` | contém: ${i.allergens.join(', ')}` : ''
      return `- ${i.id} | ${i.name} | ${i.category} | ${i.description} | ${tags}${allergens}`
    })
    .join('\n')
}

/**
 * @param {{answers?: object, text?: string}} input respostas do quiz e/ou texto livre do cliente
 * @param {object} menu o menu.json
 */
export async function recommend(input, menu) {
  const { key, model, effort, timeoutMs } = config()
  if (!key) throw Object.assign(new Error('OPENAI_API_KEY não configurada'), { status: 503 })

  const instructions = [
    'Você é o barista de uma cafeteria e ajuda um cliente leigo a escolher o que pedir.',
    'Escolha até 3 itens do cardápio abaixo, do mais indicado para o menos indicado.',
    'Respeite estritamente o que o cliente quer evitar (leite, glúten, cafeína). Na dúvida, não sugira o item.',
    'Use só ids que existem no cardápio. A razão deve ter no máximo 18 palavras, tom simpático, sem jargão.',
    '',
    'Cardápio (id | nome | categoria | descrição | etiquetas | alérgenos):',
    menuForPrompt(menu),
  ].join('\n')

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(API, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        reasoning: { effort },
        instructions,
        input: `Respostas do cliente: ${JSON.stringify(input.answers ?? {})}\nPedido em texto livre: ${input.text?.trim() || '(nenhum)'}`,
        text: { format: { type: 'json_schema', name: 'sugestoes', strict: true, schema: SCHEMA } },
      }),
    })
    const data = await res.json()
    if (!res.ok) throw Object.assign(new Error(data.error?.message || `OpenAI ${res.status}`), { status: 502 })
    const text = data.output?.flatMap((o) => o.content ?? []).find((c) => c.type === 'output_text')?.text
    const parsed = JSON.parse(text ?? '{}')
    const ids = new Set(menu.items.map((i) => i.id))
    return {
      model: data.model,
      suggestions: (parsed.suggestions ?? []).filter((s) => ids.has(s.id)).slice(0, 3),
    }
  } finally {
    clearTimeout(timer)
  }
}

/** Handler HTTP compartilhado pelo Vite (dev) e pelo servidor de produção. */
export async function handleRecommend(req, res, menu) {
  let body = ''
  for await (const chunk of req) body += chunk
  res.setHeader('Content-Type', 'application/json')
  try {
    const out = await recommend(JSON.parse(body || '{}'), menu)
    res.end(JSON.stringify(out))
  } catch (e) {
    res.statusCode = e.status || (e.name === 'AbortError' ? 504 : 500)
    res.end(JSON.stringify({ error: e.name === 'AbortError' ? 'A IA demorou demais' : e.message }))
  }
}
