import type { MenuItem } from '../types'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export const money = (v: number) => brl.format(v)

/** Menor preço do item, para mostrar "a partir de". */
export function fromPrice(item: MenuItem): string | null {
  const values = item.prices.map((p) => p.price).filter((p): p is number => p != null)
  if (!values.length) return null
  const min = Math.min(...values)
  return values.length > 1 ? `a partir de ${money(min)}` : money(min)
}
