import type { MenuItem } from '../types'
import { reasonOf, recommend, type QuizAnswers } from './recommend'

export interface Pick {
  item: MenuItem
  why: string
  /** o que casou com as respostas, para mostrar como etiquetas */
  matched: string[]
}

export interface PickResult {
  picks: Pick[]
  source: 'ia' | 'regras'
}

/**
 * Pede a sugestão ao servidor (/api/recommend): ele filtra e pontua o cardápio por etiquetas e a IA
 * escolhe os 3 finais entre os melhores. Sem servidor (ex.: página estática) ou se algo falhar,
 * cai no mesmo algoritmo por etiquetas, rodando aqui.
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
    const data: { source?: string; suggestions: { id: string; reason: string; matched?: string[] }[] } = await res.json()
    const byId = new Map(items.map((i) => [i.id, i]))
    const picks = data.suggestions
      .map((s) => ({ item: byId.get(s.id)!, why: s.reason, matched: s.matched ?? [] }))
      .filter((p) => p.item)
    if (!picks.length) throw new Error('vazio')
    return { picks, source: data.source === 'regras' ? 'regras' : 'ia' }
  } catch {
    const picks = recommend(items, answers).map((s) => ({ item: s.item, why: reasonOf(s), matched: s.reasons }))
    return { picks, source: 'regras' }
  }
}
