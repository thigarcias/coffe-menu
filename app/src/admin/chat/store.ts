import { useMemo, useSyncExternalStore } from 'react'
import type { Session } from './types'

/**
 * Sessões do chat, guardadas no navegador (localStorage). Todas as guias do painel abertas
 * no mesmo navegador enxergam as mesmas sessões e são avisadas das mudanças (evento `storage`),
 * então a mesma conversa pode estar ao mesmo tempo no painel lateral, em tela cheia e numa guia só do chat.
 */
const KEY = 'cm.admin.chats'

/** Identifica esta guia. Quem roda uma resposta carimba o próprio id nela. */
export const TAB_ID = Math.random().toString(36).slice(2, 10)

function load(): Record<string, Session> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

let snap = load()
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

function save(next: Record<string, Session>) {
  snap = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* armazenamento cheio ou bloqueado: a sessão continua viva só nesta guia */
  }
  emit()
}

window.addEventListener('storage', (e) => {
  if (e.key === KEY || e.key === null) {
    snap = load()
    emit()
  }
})

const subscribe = (f: () => void) => {
  subs.add(f)
  return () => subs.delete(f)
}
const getAll = () => snap

export const allSessions = () => Object.values(snap).sort((a, b) => b.updatedAt - a.updatedAt)
export const getSession = (id: string | null) => (id ? snap[id] : undefined)

export function useSessions(): Session[] {
  const all = useSyncExternalStore(subscribe, getAll)
  return useMemo(() => Object.values(all).sort((a, b) => b.updatedAt - a.updatedAt), [all])
}

export function useSession(id: string | null): Session | undefined {
  const all = useSyncExternalStore(subscribe, getAll)
  return id ? all[id] : undefined
}

const newId = () => 's-' + Math.random().toString(36).slice(2, 10)

export function createSession(): Session {
  const now = Date.now()
  const s: Session = { id: newId(), title: 'Nova conversa', createdAt: now, updatedAt: now, status: 'idle', messages: [] }
  save({ ...snap, [s.id]: s })
  return s
}

/** Altera uma sessão e grava. `touch: false` não mexe no "atualizada em" (usado no sinal de vida). */
export function mutate(id: string, fn: (s: Session) => Session, touch = true) {
  const cur = snap[id]
  if (!cur) return
  const next = fn(cur)
  save({ ...snap, [id]: touch ? { ...next, updatedAt: Date.now() } : next })
}

export function removeSession(id: string) {
  const { [id]: _gone, ...rest } = snap
  save(rest)
}

/* ------------------------------------------------------ estado da tela (por guia) */

export interface ChatUi {
  open: boolean
  mode: 'side' | 'full'
  sessionId: string | null
}
const UI_KEY = 'cm.admin.chat.ui'
function loadUi(): ChatUi {
  try {
    return { open: false, mode: 'side', sessionId: null, ...JSON.parse(sessionStorage.getItem(UI_KEY) ?? '{}') }
  } catch {
    return { open: false, mode: 'side', sessionId: null }
  }
}
let ui = loadUi()
const uiSubs = new Set<() => void>()
export function setChatUi(patch: Partial<ChatUi>) {
  ui = { ...ui, ...patch }
  try {
    sessionStorage.setItem(UI_KEY, JSON.stringify(ui))
  } catch {
    /* ignora */
  }
  uiSubs.forEach((f) => f())
}
export const useChatUi = () =>
  useSyncExternalStore(
    (f) => {
      uiSubs.add(f)
      return () => uiSubs.delete(f)
    },
    () => ui,
  )
