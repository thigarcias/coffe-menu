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
  description: string
  prices: Price[]
  badges?: string[]
  allergens?: string[]
  image: string | null
  lookalike: string
  tags: ItemTags
}

export interface Category {
  id: string
  name: string
}

export interface Menu {
  cafe: { name: string; source?: string }
  categories: Category[]
  items: MenuItem[]
  extras?: { name: string; price: number | null }[]
}
