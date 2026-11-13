// Chamada à OpenAI (Responses API). Roda só no servidor: a chave nunca vai ao navegador.
const API = 'https://api.openai.com/v1/responses'

// Fixos no código por enquanto: toda a IA do app usa este modelo e este esforço.
const MODEL = 'gpt-6-luna'
const EFFORT = 'high'
const TIMEOUT_MS = 60000

export const config = () => ({
  key: process.env.OPENAI_API_KEY,
  model: MODEL,
  effort: EFFORT,
  timeoutMs: TIMEOUT_MS,
})

/**
 * Chamada genérica à Responses API com saída em JSON estruturado (strict).
 * Mesmo modelo e esforço fixos de toda a IA do app. Devolve o objeto já convertido.
 * @param {{instructions: string, input: string, schema: object, name: string, signal?: AbortSignal}} o
 */
export async function callStructured({ instructions, input, schema, name, signal }) {
  const { key, model, effort, timeoutMs } = config()
  if (!key) throw Object.assign(new Error('OPENAI_API_KEY não configurada'), { status: 503 })
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  const onAbort = () => ctrl.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const res = await fetch(API, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        reasoning: { effort },
        instructions,
        input,
        text: { format: { type: 'json_schema', name, strict: true, schema } },
      }),
    })
    const data = await res.json()
    if (!res.ok) throw Object.assign(new Error(data.error?.message || `OpenAI ${res.status}`), { status: 502 })
    const text = data.output?.flatMap((o) => o.content ?? []).find((c) => c.type === 'output_text')?.text
    return JSON.parse(text ?? '{}')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
