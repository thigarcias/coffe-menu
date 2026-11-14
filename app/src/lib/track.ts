import type { Choices } from './cart'

/**
 * Registro de eventos de interesse do cliente.
 * No protótipo fica no localStorage; é a base do painel do dono
 * (o que foi visto, por quanto tempo, o que foi pedido e sugerido).
 */
export type TrackEvent =
  | { type: 'view'; itemId: string; ms: number }
  | { type: 'open_details'; itemId: string }
  | { type: 'category'; categoryId: string }
  | { type: 'category_end'; categoryId: string }
  | { type: 'quiz_open' }
  | { type: 'quiz_result'; answers: Record<string, string | string[] | undefined>; itemIds: string[] }
  | { type: 'view_mode'; mode: 'feed' | 'grid' }
  | { type: 'tag'; tagId: string; from: string | null }
  | { type: 'related_open'; fromId: string; itemId: string }
  | { type: 'cart_add'; itemId: string; from: 'feed' | 'grid' | 'detail' | 'quiz'; customized: boolean }
  | { type: 'cart_customize'; itemId: string; choices: Choices }
  | { type: 'cart_remove'; itemId: string }
  | { type: 'checkout_start'; items: number; total: number }
  | { type: 'order_sent'; items: number; total: number; by: 'nome' | 'mesa' | 'ambos' }

const KEY = 'cm.events'
const SESSION = Math.random().toString(36).slice(2, 10)

export function track(e: TrackEvent) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    all.push({ ...e, at: Date.now(), session: SESSION })
    localStorage.setItem(KEY, JSON.stringify(all.slice(-5000)))
  } catch {
    /* sem storage: segue sem registrar */
  }
}

export function readEvents(): (TrackEvent & { at: number; session: string })[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}
