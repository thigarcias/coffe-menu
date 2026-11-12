import type { MenuItem } from '../types'
import { recommend, type QuizAnswers } from './recommend'

export interface Pick {
  item: MenuItem
  why: string
}

export interface PickResult {
  picks: Pick[]
  source: 'ia' | 'regras'
}

/**
 * Pede a sugestão à IA pela rota do servidor (/api/recommend).
 * Sem servidor (ex.: página estática) ou se a IA falhar, cai nas regras locais.
 */
export async function suggest(items: MenuItem[], answers: QuizAnswers, text: string): Promise<PickResult> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 65000)
    const res = await fetch('api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, text }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`api ${res.status}`)
    const data: { suggestions: { id: string; reason: string }[] } = await res.json()
    const byId = new Map(items.map((i) => [i.id, i]))
    const picks = data.suggestions
      .map((s) => ({ item: byId.get(s.id)!, why: s.reason }))
      .filter((p) => p.item)
    if (!picks.length) throw new Error('vazio')
    return { picks, source: 'ia' }
  } catch {
    const picks = recommend(items, answers).map((s) => ({
      item: s.item,
      why: s.reasons.length ? `Combina com você: ${s.reasons.join(', ')}.` : s.item.lookalike,
    }))
    return { picks, source: 'regras' }
  }
}
