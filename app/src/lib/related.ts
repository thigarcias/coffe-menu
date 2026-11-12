import type { MenuItem, TagGroup } from '../types'

export interface TagInfo {
  id: string
  label: string
  group: string
  weight: number
}

/** Índice das tags: id -> rótulo, família e peso. */
export function tagIndex(groups: TagGroup[] = []): Map<string, TagInfo> {
  const m = new Map<string, TagInfo>()
  for (const g of groups) for (const t of g.tags) m.set(t.id, { id: t.id, label: t.label, group: g.id, weight: g.weight })
  return m
}

const isFood = (i: MenuItem) => i.category === 'doces' || i.category === 'salgados'

/**
 * Produtos parecidos, pelas tags em comum.
 * Cada tag compartilhada soma o peso da família (sabor conta mais que temperatura),
 * e tags raras contam mais que as comuns ("avelã" diz mais que "gelado").
 * A mesma subcategoria dá um empurrãozinho, para desempatar.
 */
export function related(item: MenuItem, items: MenuItem[], tags: Map<string, TagInfo>, limit = 6): MenuItem[] {
  const mine = new Set(item.labels ?? [])
  if (!mine.size) return []

  const df = new Map<string, number>()
  for (const i of items) for (const t of i.labels ?? []) df.set(t, (df.get(t) ?? 0) + 1)
  const rarity = (t: string) => 1 / Math.sqrt(df.get(t) ?? 1)

  const scored: { item: MenuItem; score: number }[] = []
  for (const other of items) {
    if (other.id === item.id) continue
    let score = 0
    for (const t of other.labels ?? []) {
      if (mine.has(t)) score += (tags.get(t)?.weight ?? 1) * rarity(t)
    }
    if (score <= 0) continue
    // comida puxa comida e bebida puxa bebida; a mesma subcategoria só desempata
    if (isFood(other) === isFood(item)) score += 0.6
    if (other.subcategory && other.subcategory === item.subcategory) score += 0.15
    scored.push({ item: other, score })
  }
  return scored
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map((s) => s.item)
}

/** Itens com a tag, na ordem do cardápio. */
export const withTag = (items: MenuItem[], tag: string) => items.filter((i) => i.labels?.includes(tag))
