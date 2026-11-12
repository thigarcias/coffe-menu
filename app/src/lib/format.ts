import type { MenuItem } from '../types'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export const money = (v: number) => brl.format(v)

/**
 * Tamanho do nome do produto: nomes longos (ex.: "… com Cold Foam Proteico (19g)") ganham
 * fonte menor, para a foto do feed e o painel do detalhe não perderem espaço.
 */
export const nameSize = (name: string): '' | 'l' | 'xl' => (name.length > 36 ? 'xl' : name.length > 18 ? 'l' : '')

/** Menor preço do item, para mostrar "a partir de". */
export function fromPrice(item: MenuItem): string | null {
  const values = item.prices.map((p) => p.price).filter((p): p is number => p != null)
  if (!values.length) return null
  const min = Math.min(...values)
  return values.length > 1 ? `a partir de ${money(min)}` : money(min)
}

/** Preço em duas partes, para o feed: rótulo pequeno + valor. */
export function priceParts(item: MenuItem): { label: string | null; value: string } | null {
  const values = item.prices.map((p) => p.price).filter((p): p is number => p != null)
  if (!values.length) return null
  return { label: values.length > 1 ? 'a partir de' : null, value: money(Math.min(...values)) }
}
