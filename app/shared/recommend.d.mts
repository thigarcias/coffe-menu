export const WANTS: string[]
export const CAFFEINE: string[]
export const TASTES: string[]
export const BODIES: string[]
export const FOOD_KINDS: string[]
export const MOMENTS: string[]
export const AVOIDS: string[]
export const MAX_FLAVORS: number
export const FLAVORS: Record<string, { label: string; tags: string[] }>

export interface NormalizedAnswers {
  want: string
  caffeine: string
  taste: string
  body: string
  foodKind: string
  moment: string
  flavors: string[]
  avoid: string[]
  asked: Set<string>
}
export interface Extra {
  prefer?: { tag: string; strength: number }[]
  avoid?: string[]
  avoidTags?: string[]
  avoidHard?: string[]
}
export interface Scored<I = any> {
  item: I
  score: number
  matched: string[]
  family: string
}
export function normalizeAnswers(a?: unknown): NormalizedAnswers
export function tagCatalog(groups?: unknown[]): Map<string, { id: string; label: string; group: string; weight: number }>
export function isFood(item: any): boolean
export function excludedBecause(item: any, a: NormalizedAnswers, extra?: Extra): string | null
export function scoreMenu<I = any>(items: I[], tagGroups: unknown[], a: NormalizedAnswers, extra?: Extra): Scored<I>[]
export function familyOf(item: any): string
export function topCandidates<I = any>(scored: Scored<I>[], n?: number, perFamily?: number): Scored<I>[]
export function topPicks<I = any>(scored: Scored<I>[], limit?: number): Scored<I>[]
export function describeAnswers(a: NormalizedAnswers, tagGroups: unknown[]): string
export function reasonFrom(matched: string[], item: any): string
