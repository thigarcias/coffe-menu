import { BUILTIN_IDS, HOME, type BuiltinId, type DashSection, type Layout, type Span } from './model'

/** Operações puras do modo editar: sempre devolvem uma lista nova. */
export function moveItem(layout: Layout, index: number, dir: -1 | 1): Layout {
  const to = index + dir
  if (index < 0 || index >= layout.length || to < 0 || to >= layout.length) return layout
  const next = [...layout]
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}

export const removeItem = (layout: Layout, id: string): Layout => layout.filter((i) => i.id !== id)

export function addBuiltin(layout: Layout, widget: BuiltinId): Layout {
  return layout.some((i) => i.id === widget) ? layout : [...layout, { id: widget, kind: 'builtin', widget }]
}

/** Alterna a largura de um bloco da IA entre metade e inteira (só vale no computador). */
export function toggleSpan(layout: Layout, id: string): Layout {
  return layout.map((i) => (i.id === id && i.kind === 'spec' ? { ...i, span: (i.span === 12 ? 6 : 12) as Span } : i))
}

/**
 * Cartões do padrão que não estão na seção, na ordem do catálogo: `home` são os que nasceram
 * nesta seção (o caso comum de "esconde e quer de volta"); `others` vêm de outras seções.
 */
export function hiddenBuiltins(layout: Layout, section: DashSection): { home: BuiltinId[]; others: BuiltinId[] } {
  const missing = BUILTIN_IDS.filter((id) => !layout.some((i) => i.id === id))
  return { home: missing.filter((id) => HOME[id] === section), others: missing.filter((id) => HOME[id] !== section) }
}

export const sameLayout = (a: Layout, b: Layout) => JSON.stringify(a) === JSON.stringify(b)

export const newSpecId = () => 's_' + (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '').slice(0, 10) : Math.random().toString(36).slice(2, 12))
