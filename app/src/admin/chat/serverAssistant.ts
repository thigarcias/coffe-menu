import type { Assistant, AssistantEvent } from './assistant'
import type { Message } from './types'

/**
 * A IA de verdade: chama o servidor (`POST /api/admin-chat`), que roda o GPT-6 Luna com o
 * guardrail, consulta os dados e devolve a resposta aos poucos, uma linha de JSON por passo.
 * A chave da OpenAI nunca passa por aqui.
 */
const URL = './api/admin-chat'

/** Histórico enxuto para o servidor: o texto das perguntas e a receita das respostas. */
function condense(history: Message[]) {
  return history.slice(-8).map((m) =>
    m.role === 'user'
      ? { role: 'user', text: m.blocks[0]?.type === 'text' ? m.blocks[0].text : '' }
      : { role: 'assistant', text: '', plan: m.plan ?? null },
  )
}

export const serverAssistant: Assistant = async function* (prompt, history, signal) {
  // a última mensagem do histórico é a pergunta atual (já gravada pelo executor)
  const past = history.slice(0, -2)
  let res: Response
  try {
    res = await fetch(URL, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, history: condense(past) }),
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new Error('Sem conexão com o servidor da IA.')
  }
  if (!res.ok || !res.body) {
    let msg = 'O servidor da IA não respondeu.'
    try {
      msg = (await res.json()).error || msg
    } catch {
      if (res.status === 404) msg = 'A IA não está disponível neste ambiente.'
    }
    throw new Error(msg)
  }
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  const parse = (line: string): AssistantEvent | { type: 'done' } | { type: 'error'; message: string } | null => {
    if (!line.trim()) return null
    try {
      return JSON.parse(line)
    } catch {
      return null
    }
  }
  for (;;) {
    const { done, value } = await reader.read()
    buf += dec.decode(value, { stream: !done })
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const ev = parse(buf.slice(0, nl))
      buf = buf.slice(nl + 1)
      if (!ev) continue
      if (ev.type === 'done') return
      if (ev.type === 'error') throw new Error((ev as { message: string }).message)
      yield ev as AssistantEvent
    }
    if (done) {
      const last = parse(buf)
      if (last && last.type !== 'done' && last.type !== 'error') yield last as AssistantEvent
      return
    }
  }
}
