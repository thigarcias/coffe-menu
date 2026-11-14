import menuData from '../data/menu.json'
import type { Menu, MenuItem, TagGroup } from '../types'
import { normalizeAnswers, reasonFrom, scoreMenu, topPicks } from '../../shared/recommend.mjs'

export type Want = 'quente' | 'gelada' | 'comer' | 'tanto-faz'
export type Caffeine = 'com' | 'sem' | 'tanto-faz'
export type Taste = 'doce' | 'equilibrado' | 'forte'
export type Body = 'cremoso' | 'leve' | 'tanto-faz'
export type FoodKind = 'doce' | 'salgado' | 'tanto-faz'
export type Moment = 'cafe-da-manha' | 'lanche' | 'sobremesa' | 'proteico' | 'levar' | 'qualquer'
export type Avoid = 'leite' | 'gluten' | 'cafeina'
export type FlavorId = 'chocolate' | 'caramelo' | 'frutas' | 'avela-baunilha' | 'especiarias' | 'citrico' | 'matcha' | 'queijo' | 'frango' | 'presunto'

/** O que a pessoa respondeu. Pergunta que não entrou no caminho dela fica de fora (e não pesa). */
export interface QuizAnswers {
  want: Want
  caffeine?: Caffeine
  foodKind?: FoodKind
  flavors: FlavorId[]
  taste?: Taste
  body?: Body
  moment?: Moment
  avoid: Avoid[]
  /** quais perguntas apareceram para ela ('taste', 'body'): só essas pesam na nota */
  asked: string[]
}

export interface Suggestion {
  item: MenuItem
  score: number
  /** o que casou com as respostas (rótulos das etiquetas) */
  reasons: string[]
}

const tagGroups = (menuData as unknown as Menu).tagGroups ?? []

/**
 * Plano B, sem IA: o mesmo algoritmo por etiquetas que o servidor usa (shared/recommend.mjs).
 * Filtra o que a pessoa não pode ou não quer e pontua o resto; as 3 melhores, sem repetir a mesma bebida.
 */
export function recommend(items: MenuItem[], a: QuizAnswers, limit = 3, groups: TagGroup[] = tagGroups): Suggestion[] {
  const scored = scoreMenu(items, groups, normalizeAnswers(a))
  return topPicks(scored, limit).map((s) => ({ item: s.item, score: s.score, reasons: s.matched }))
}

/** Frase de motivo, sem IA. */
export const reasonOf = (s: Suggestion) => reasonFrom(s.reasons, s.item)

