export interface Price {
  size: string
  ml?: number | null
  price: number | null
}

export interface ItemTags {
  sweet: number // 0–3
  bitter: number // 0–3
  milk: boolean
  iced: boolean
  caffeine: boolean
  hunger: number // 0–3
}

export interface MenuItem {
  id: string
  name: string
  category: string
  /** subcategoria original do cardápio (ex.: Cold Brew), usada como rótulo do produto */
  subcategory?: string
  description: string
  prices: Price[]
  badges?: string[]
  allergens?: string[]
  image: string | null
  lookalike: string
  ingredients?: string[]
  story?: string
  tags: ItemTags
  /** id do conjunto de opções (Menu.optionSets) a personalizar; sem ele, o item entra na sacola direto */
  options?: string
}

/** Como o pedido é identificado: pelo nome (balcão), pela mesa (QR) ou pelos dois. */
export type OrderBy = 'nome' | 'mesa' | 'ambos'

export interface Choice {
  id: string
  name: string
  /** acréscimo em R$ */
  add: number
  /** nome curto, usado no resumo da linha ( "+1 dose" ) */
  short?: string
}

/**
 * Grupo de opções, na ordem do site.
 * - size: tamanho (as opções vêm de item.prices)
 * - single: escolhe uma (café, leite)
 * - extras: cada opção pode ter quantidade, até max por opção (adicionais)
 * - toggle: liga/desliga (sem chantilly)
 */
export interface OptionGroup {
  id: string
  name: string
  kind: 'size' | 'single' | 'extras' | 'toggle'
  required: boolean
  max: number
  options: Choice[]
  default: string | null
}

export interface OptionSet {
  name: string
  groups: OptionGroup[]
}

export interface Category {
  id: string
  name: string
}

export interface Menu {
  cafe: { name: string; source?: string; storyNote?: string; orderBy?: OrderBy }
  categories: Category[]
  subcategories?: (Category & { group: string })[]
  items: MenuItem[]
  extras?: { name: string; price: number | null }[]
  optionSets?: Record<string, OptionSet>
}
