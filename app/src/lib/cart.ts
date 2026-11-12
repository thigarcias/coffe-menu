import menuData from '../data/menu.json'
import type { Menu, MenuItem, OptionGroup, OptionSet } from '../types'

const menu = menuData as Menu

/**
 * Escolhas de uma linha da sacola, por id de grupo:
 * - tamanho e opções únicas (café, leite): o id da opção (no tamanho, o nome: "Grande")
 * - adicionais e "sem chantilly": { idDaOpção: quantidade }
 */
export type Choices = Record<string, string | Record<string, number>>

export interface CartLine {
  /** item + escolhas + observação: o mesmo item com escolhas diferentes é outra linha */
  key: string
  itemId: string
  choices: Choices
  note: string
  qty: number
}

export interface Order {
  code: string
  name: string
  table: string
  lines: CartLine[]
  total: number
  sentAt: number
}

const CART_KEY = 'cm.cart'
const ORDER_KEY = 'cm.order'
const NAME_KEY = 'cm.name'
const FAV_KEY = 'cm.favorites' // legado: migrado uma vez para a sacola

/** Andamento simulado do pedido, em ms desde o envio (curto de propósito, para a demo). */
export const PREPARING_AT = 8_000
export const READY_AT = 20_000

// ---------- conjuntos de opções ----------

export const optionSetOf = (item: MenuItem): OptionSet | null => (item.options && menu.optionSets?.[item.options]) || null

export const sizesOf = (item: MenuItem) => item.prices.filter((p) => p.price != null)

/** Tamanho padrão: Tall, ou o primeiro que existir. */
export const defaultSize = (item: MenuItem): string | null => {
  const sizes = sizesOf(item)
  return (sizes.find((s) => s.size === 'Tall') ?? sizes[0])?.size ?? null
}

/** A pessoa só escolhe tamanho quando o item tem mais de um. */
export const hasSizes = (item: MenuItem) => sizesOf(item).length > 1

/** Grupos que aparecem na personalização deste item (sem o tamanho, se só há um). */
export const groupsOf = (item: MenuItem, set: OptionSet): OptionGroup[] =>
  set.groups.filter((g) => g.kind !== 'size' || hasSizes(item))

export function defaultChoices(item: MenuItem, set: OptionSet | null): Choices {
  const out: Choices = {}
  if (!set) return out
  for (const g of groupsOf(item, set)) {
    if (g.kind === 'size') {
      const s = defaultSize(item)
      if (s) out[g.id] = s
    } else if (g.kind === 'single' && g.default) out[g.id] = g.default
  }
  return out
}

/** Tira o que está vazio e ordena, para que escolhas iguais gerem a mesma chave. */
export function normalize(choices: Choices): Choices {
  const out: Choices = {}
  for (const id of Object.keys(choices).sort()) {
    const v = choices[id]
    if (typeof v === 'string') {
      if (v) out[id] = v
    } else {
      const ex: Record<string, number> = {}
      for (const o of Object.keys(v).sort()) if (v[o] > 0) ex[o] = v[o]
      if (Object.keys(ex).length) out[id] = ex
    }
  }
  return out
}

export const lineKey = (itemId: string, choices: Choices, note: string) =>
  `${itemId}|${JSON.stringify(normalize(choices))}|${note.trim()}`

export function makeLine(item: MenuItem, choices: Choices, note = '', qty = 1): CartLine {
  const c = normalize(choices)
  const n = note.trim()
  return { key: lineKey(item.id, c, n), itemId: item.id, choices: c, note: n, qty }
}

// ---------- preço e resumo ----------

/** Preço de uma unidade: tamanho + acréscimos das opções. */
export function unitPrice(item: MenuItem, choices: Choices): number {
  const set = optionSetOf(item)
  const sizes = sizesOf(item)
  const wanted = typeof choices.tamanho === 'string' ? choices.tamanho : defaultSize(item)
  let total = (sizes.find((s) => s.size === wanted) ?? sizes.find((s) => s.size === defaultSize(item)))?.price ?? 0
  if (!set) return total
  for (const g of set.groups) {
    if (g.kind === 'size') continue
    const v = choices[g.id]
    if (typeof v === 'string') total += g.options.find((o) => o.id === v)?.add ?? 0
    else if (v) for (const [id, qty] of Object.entries(v)) total += (g.options.find((o) => o.id === id)?.add ?? 0) * qty
  }
  return Math.round(total * 100) / 100
}

export const linePrice = (item: MenuItem, line: CartLine) => Math.round(unitPrice(item, line.choices) * line.qty * 100) / 100

/** "Grande · Leite de aveia · +1 dose": só o que foge do padrão (e o tamanho, quando há mais de um). */
export function summary(item: MenuItem, choices: Choices): string {
  const set = optionSetOf(item)
  if (!set) return ''
  const parts: string[] = []
  for (const g of groupsOf(item, set)) {
    const v = choices[g.id]
    if (g.kind === 'size') {
      if (typeof v === 'string') parts.push(v)
    } else if (g.kind === 'single') {
      if (typeof v === 'string' && v !== g.default) parts.push(g.options.find((o) => o.id === v)?.name ?? v)
    } else if (v && typeof v !== 'string') {
      for (const o of g.options) {
        const q = v[o.id] ?? 0
        if (!q) continue
        parts.push(g.kind === 'toggle' ? o.name : `+${q} ${o.short ?? o.name.toLowerCase()}`)
      }
    }
  }
  return parts.join(' · ')
}

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty, 0)

export const cartTotal = (lines: CartLine[], byId: Map<string, MenuItem>) =>
  Math.round(lines.reduce((t, l) => t + (byId.get(l.itemId) ? linePrice(byId.get(l.itemId)!, l) : 0), 0) * 100) / 100

/** Alérgenos de tudo o que está na sacola, sem repetir. */
export const allergensOf = (lines: CartLine[], byId: Map<string, MenuItem>): string[] => [
  ...new Set(lines.flatMap((l) => byId.get(l.itemId)?.allergens ?? [])),
]

// ---------- andamento do pedido ----------

export type Stage = 0 | 1 | 2 // 0 recebido, 1 preparando, 2 pronto
export const STAGES = ['Recebido', 'Preparando', 'Pronto'] as const

/** Calculado a partir de sentAt, então sobrevive a recarregar a página. */
export const stageOf = (order: Order, now: number): Stage => {
  const t = now - order.sentAt
  return t >= READY_AT ? 2 : t >= PREPARING_AT ? 1 : 0
}

/** Número do pedido, no estilo do balcão: A27. */
export const newCode = () => {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // sem I e O, que se confundem com 1 e 0
  const letter = letters[Math.floor(Math.random() * letters.length)]
  return `${letter}${10 + Math.floor(Math.random() * 90)}`
}

// ---------- no celular (sempre com try/catch: o app funciona sem storage) ----------

const read = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
const write = (key: string, value: unknown) => {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* sem storage: segue sem guardar */
  }
}

/** Sacola guardada; na primeira vez, os favoritos antigos entram nela com o padrão. */
export function loadCart(items: MenuItem[]): CartLine[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  const saved = read<CartLine[]>(CART_KEY)
  let lines = Array.isArray(saved)
    ? saved.filter((l) => l && byId.has(l.itemId) && l.qty > 0 && typeof l.key === 'string')
    : []
  const favs = read<string[]>(FAV_KEY)
  if (Array.isArray(favs)) {
    for (const id of favs) {
      const item = byId.get(id)
      if (!item) continue
      const line = makeLine(item, defaultChoices(item, optionSetOf(item)))
      if (!lines.some((l) => l.key === line.key)) lines = [...lines, line]
    }
    write(CART_KEY, lines)
    try {
      localStorage.removeItem(FAV_KEY)
    } catch {
      /* ignora */
    }
  }
  return lines
}
export const saveCart = (lines: CartLine[]) => write(CART_KEY, lines.length ? lines : null)

export const loadOrder = (items: MenuItem[]): Order | null => {
  const o = read<Order>(ORDER_KEY)
  if (!o || typeof o.sentAt !== 'number' || !Array.isArray(o.lines)) return null
  const ids = new Set(items.map((i) => i.id))
  return { ...o, lines: o.lines.filter((l) => ids.has(l.itemId)) }
}
export const saveOrder = (order: Order | null) => write(ORDER_KEY, order)

export const loadName = (): string => {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}
export const saveName = (name: string) => {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    /* ignora */
  }
}

/** Mesa lida do QR (?mesa=7). */
export const tableFromUrl = (): string => {
  try {
    return (new URLSearchParams(location.search).get('mesa') ?? '').trim().slice(0, 12)
  } catch {
    return ''
  }
}
