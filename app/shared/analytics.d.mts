import type { MenuItem } from '../src/types'

export const DAYS: number
export const TODAY: number
export const NOW_HOUR: number
export const HOURS: number[]
export const DOW: string[]
export const DOW_LONG: string[]
export const PRODUCT_IDS: string[]
export const CATEGORY_LABEL: Record<string, string>
export const SOURCES: [string, number, number][]
export const PERIOD_IDS: string[]
export const PERIOD_LABEL: Record<string, string>
export const COMPARE_WITH: Record<string, string | null>
export const METRICS: Record<string, { label: string; format: 'money' | 'number' | 'percent'; about: string }>
export const DIMENSIONS: Record<string, string>
export const ALLOWED: Record<string, string[]>
export function dayDate(i: number): Date

export interface Fact {
  d: number
  h: number
  w: number
  src: number
}
export function getFacts(): { sessions: any[]; orders: any[]; items: any[] }

export interface QueryRow {
  key: string | number
  label: string
  tip?: string
  id?: string
  value: number
  prev?: number
}
export interface QueryResult {
  metric: string
  groupBy: string
  period: string
  compared: string | null
  rows: QueryRow[]
  filter?: string
  total: number
  prevTotal?: number
}
export interface QueryFilter {
  source?: string | null
  category?: string | null
  product?: string | null
  ai_usage?: string | null
}
export const FILTERS: Record<string, string[]>
export function runQuery(q: { metric: string; groupBy?: string; period?: string; compare?: boolean; limit?: number | null; order?: 'desc' | 'asc' | null; filter?: QueryFilter | null }): QueryResult

export function funnelOf(period?: string): { label: string; hint: string; value: number }[]
export function heatOf(period?: string): {
  rows: { label: string; cells: number[] }[]
  hours: number[]
  max: number
  peak: { dow: string; hour: number; value: number }
  weekendShare: number
}
export function aiStatsOf(period?: string): {
  opened: number
  finished: number
  clicked: number
  added: number
  ordered: number
  shareOfOrders: number
  convAi: number
  convOthers: number
  ticketAi: number
  ticketOthers: number
  fallback: number
  rows: { item: MenuItem; suggested: number; clickRate: number; orders: number }[]
}
export function similarOf(period?: string): {
  opened: number
  clicks: number
  orders: number
  revenue: number
  flows: { from: MenuItem; to: MenuItem; clicks: number; orders: number }[]
}
export function radarOf(period?: string): Record<'star' | 'window' | 'hidden' | 'weak', { item: MenuItem; views: number; conv: number }[]>
export function describeCatalog(): string

export const LABEL_CATALOG: { id: string; label: string; group: string }[]
export const LABEL_IDS: string[]
export interface GroupRule {
  categories: string[]
  labels: string[]
  price_min: number | null
  price_max: number | null
}
export function groupMembers(rule: Partial<GroupRule>): string[]
export function productName(id: string): string
