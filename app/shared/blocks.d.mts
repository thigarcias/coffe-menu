import type { Block } from '../src/admin/chat/types'
import type { BlockSpec } from '../src/admin/layout/model'

export const BLOCK_TYPES: BlockSpec['type'][]
export function clean(text: unknown, max?: number): string
export const isEnum: (v: unknown, list: readonly string[]) => boolean
/** Valida e normaliza uma lista de receitas (descarta o que não existe no catálogo). */
export function normalizePlan(plan: { blocks?: unknown[] } | null | undefined): BlockSpec[]
/** Executa uma receita no motor e devolve o bloco pronto para a tela e um resumo com os números. */
export function resolveBlock(spec: BlockSpec): { block: Block; summary: Record<string, unknown> }
export const NN: (t: string, extra?: Record<string, unknown>) => Record<string, unknown>
export const BLOCK_SCHEMA: Record<string, unknown>
export const BLOCK_TYPES_HELP: string
export const MAX_GROUPS: number
export const GROUP_SCHEMA: Record<string, unknown>
export function normalizeGroup(g: unknown): import('./analytics.mjs').GroupRule & { name: string } | null
export function describeGroups(spec: { groups?: unknown[] }): string
export function describeRule(g: Partial<import('./analytics.mjs').GroupRule>): string
