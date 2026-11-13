import { mockAssistant, type Assistant } from './assistant'
import { allSessions, createSession, getSession, mutate, TAB_ID } from './store'
import type { Message, Session } from './types'

/**
 * Executa as respostas FORA da tela: o executor mora no módulo, não num componente. Fechar o
 * painel lateral, a tela cheia ou trocar de aba do painel não interrompe nada. A resposta
 * é gravada na sessão a cada passo, e qualquer guia aberta acompanha.
 *
 * Limite deste modelo (decisão: "plano A"): a resposta roda NESTA guia do navegador. Se a guia
 * que começou for fechada no meio, a sessão fica "interrompida" e dá para retomar.
 */
let assistant: Assistant = mockAssistant
export const setAssistant = (a: Assistant) => {
  assistant = a
}

const controllers = new Map<string, AbortController>()
const newId = () => 'm-' + Math.random().toString(36).slice(2, 10)

const patchMessage = (sessionId: string, id: string, fn: (m: Message) => Message) =>
  mutate(sessionId, (s) => ({ ...s, messages: s.messages.map((m) => (m.id === id ? fn(m) : m)) }))

/** Envia uma pergunta. Sem sessão, cria uma. Devolve o id da sessão. */
export function send(sessionId: string | null, text: string): string | null {
  const prompt = text.trim()
  if (!prompt) return sessionId
  const s = (sessionId && getSession(sessionId)) || createSession()
  if (s.status === 'running') return s.id
  const user: Message = { id: newId(), role: 'user', createdAt: Date.now(), blocks: [{ type: 'text', text: prompt }], state: 'done' }
  const reply: Message = { id: newId(), role: 'assistant', createdAt: Date.now(), blocks: [], state: 'streaming', status: 'Entendendo o pedido…' }
  mutate(s.id, (cur) => ({
    ...cur,
    title: cur.messages.length ? cur.title : prompt.length > 44 ? prompt.slice(0, 43) + '…' : prompt,
    status: 'running',
    owner: TAB_ID,
    pulse: Date.now(),
    messages: [...cur.messages, user, reply],
  }))
  void run(s.id, reply.id, prompt)
  return s.id
}

/** Retoma uma resposta interrompida (guia fechada no meio): refaz o último pedido. */
export function resume(sessionId: string) {
  const s = getSession(sessionId)
  if (!s || s.status === 'running') return
  const lastReply = [...s.messages].reverse().find((m) => m.role === 'assistant')
  const lastUser = [...s.messages].reverse().find((m) => m.role === 'user')
  if (!lastReply || !lastUser) return
  mutate(sessionId, (cur) => ({
    ...cur,
    status: 'running',
    owner: TAB_ID,
    pulse: Date.now(),
    messages: cur.messages.map((m) => (m.id === lastReply.id ? { ...m, blocks: [], state: 'streaming', status: 'Retomando…' } : m)),
  }))
  void run(sessionId, lastReply.id, lastUser.blocks[0]?.type === 'text' ? lastUser.blocks[0].text : '')
}

export function stop(sessionId: string) {
  controllers.get(sessionId)?.abort()
}

async function run(sessionId: string, replyId: string, prompt: string) {
  const ctl = new AbortController()
  controllers.set(sessionId, ctl)
  // sinal de vida: outras guias só consideram a sessão abandonada se ele parar
  const beat = setInterval(() => mutate(sessionId, (s) => ({ ...s, pulse: Date.now() }), false), 1000)
  try {
    const history = getSession(sessionId)?.messages ?? []
    for await (const ev of assistant(prompt, history, ctl.signal)) {
      if (ev.type === 'status') patchMessage(sessionId, replyId, (m) => ({ ...m, status: ev.text }))
      else patchMessage(sessionId, replyId, (m) => ({ ...m, blocks: [...m.blocks, ev], status: undefined }))
    }
    patchMessage(sessionId, replyId, (m) => ({ ...m, state: 'done', status: undefined }))
    mutate(sessionId, (s) => ({ ...s, status: 'idle', owner: undefined, pulse: undefined }))
  } catch (e) {
    const stopped = e instanceof DOMException && e.name === 'AbortError'
    patchMessage(sessionId, replyId, (m) => ({ ...m, state: stopped ? 'stopped' : 'error', status: undefined }))
    mutate(sessionId, (s) => ({ ...s, status: stopped ? 'idle' : 'error', owner: undefined, pulse: undefined }))
  } finally {
    clearInterval(beat)
    controllers.delete(sessionId)
  }
}

/** Marca como interrompida a sessão cuja guia dona sumiu (sem sinal de vida há mais de 5 s). */
export function sweep() {
  const now = Date.now()
  for (const s of allSessions() as Session[]) {
    if (s.status !== 'running' || s.owner === TAB_ID || controllers.has(s.id)) continue
    if (now - (s.pulse ?? 0) < 5000) continue
    mutate(s.id, (cur) => ({
      ...cur,
      status: 'interrupted',
      owner: undefined,
      pulse: undefined,
      messages: cur.messages.map((m) => (m.state === 'streaming' ? { ...m, state: 'interrupted', status: undefined } : m)),
    }))
  }
}
