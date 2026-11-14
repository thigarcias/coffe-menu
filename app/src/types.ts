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
  /** true somente quando a cafeteria confirmou a informação de alergênicos */
  allergensVerified?: boolean
  image: string | null
  /** vídeo de demonstração (mockup, Pexels); a foto vira o poster */
  video?: string
  lookalike: string
  ingredients?: string[]
  story?: string
  tags: ItemTags
  /** id do conjunto de opções (Menu.optionSets) a personalizar; sem ele, o item entra na sacola direto */
  options?: string
  /** tags legíveis (ids de Menu.tagGroups): base dos parecidos, do filtro e da recomendação */
  labels?: string[]
  /** disponibilidade nesta unidade; ausente equivale a disponível */
  available?: boolean
}

/** Família de tags (Temperatura, Base, Sabor…). O peso diz quanto ela conta para "parecido". */
export interface TagGroup {
  id: string
  name: string
  weight: number
  tags: { id: string; label: string }[]
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
  cafe: {
    id?: string
    slug?: string
    name: string
    description?: string | null
    source?: string
    storyNote?: string
    orderBy?: OrderBy
    branding?: {
      /** Chave privada usada apenas pelo painel; o cardápio público deve receber logo_url. */
      logo_key?: string | null
      logo_url?: string | null
      description?: string | null
      accent_color?: string | null
      secondary_color?: string | null
    }
  }
  categories: Category[]
  subcategories?: (Category & { group: string })[]
  items: MenuItem[]
  extras?: { name: string; price: number | null }[]
  optionSets?: Record<string, OptionSet>
  tagGroups?: TagGroup[]
}

/** Formato do RPC público; uma unidade pode não ter uma publicação ativa ainda. */
export interface PublicMenuLookupResponse {
  cafe: { id: string; slug: string; name: string }
  revision: {
    publication_id: string
    draft_id: string
    version_id: string
    version: number
    published_at: string
  } | null
  menu: Menu | null
  /** produtoId -> disponível; ids ausentes ficam disponíveis */
  availability: Record<string, boolean>
}

/** Resposta validada, pronta para renderizar. */
export interface PublishedMenuResponse extends Omit<PublicMenuLookupResponse, 'menu' | 'revision'> {
  menu: Menu
  revision: NonNullable<PublicMenuLookupResponse['revision']>
}

