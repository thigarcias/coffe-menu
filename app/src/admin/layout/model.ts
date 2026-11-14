/**
 * Layout do painel: cada seção do Dashboard é uma lista de itens.
 *
 * O padrão mora no código (`DEFAULT_LAYOUT`). O que o dono muda vira uma sobreposição por
 * seção, salva no Supabase. "Voltar ao padrão" apaga a sobreposição.
 *
 * Um item é um cartão do padrão (`builtin`, identificado pelo nome) ou um bloco criado pela
 * IA (`spec`). O bloco da IA guarda só a RECEITA (tipo, métrica, período, filtros), nunca
 * números: eles são calculados na hora pelo motor, então nunca ficam velhos.
 */
export const DASH_SECTIONS = ['visao', 'vendas', 'produtos', 'ia', 'trafego'] as const
export type DashSection = (typeof DASH_SECTIONS)[number]

export const BUILTIN_IDS = [
  'kpi.revenue',
  'kpi.orders',
  'kpi.ticket',
  'kpi.conv',
  'kpi.ai',
  'why',
  'sales',
  'funnel',
  'top',
  'categories',
  'showcase',
  'ai.reco',
  'similar',
  'heat',
  'sources',
] as const
export type BuiltinId = (typeof BUILTIN_IDS)[number]

/** Receita de um bloco da IA (mesmo formato validado por `normalizeSpec` em shared/blocks.mjs). */
export interface BlockSpec {
  type: 'kpis' | 'line' | 'bars' | 'funnel' | 'heat' | 'table' | 'similar' | 'ai_picks' | 'showcase'
  title: string
  subtitle: string | null
  metric: string | null
  metrics: string[]
  group_by: string | null
  period: string
  compare: boolean
  limit: number | null
  order: 'asc' | 'desc' | null
  filter_source: string | null
  filter_category: string | null
  filter_product: string | null
  filter_ai: string | null
  /** agrupamentos (regra viva) do bloco; ausente em blocos salvos antes de existirem */
  groups?: SpecGroup[]
}

/** "Nova categoria" para analisar: nome e regra (categoria, TODAS as etiquetas, faixa de preço). */
export interface SpecGroup {
  name: string
  categories: string[]
  labels: string[]
  price_min: number | null
  price_max: number | null
}

/** Largura do cartão na grade de 12 colunas (no celular tudo vira uma coluna). */
export type Span = 4 | 5 | 6 | 7 | 8 | 12

export type LayoutItem =
  | { id: string; kind: 'builtin'; widget: BuiltinId }
  | { id: string; kind: 'spec'; spec: BlockSpec; span: Span }

export type Layout = LayoutItem[]

const b = (widget: BuiltinId): LayoutItem => ({ id: widget, kind: 'builtin', widget })

/** O painel padrão: exatamente o que existia antes da personalização. */
export const DEFAULT_LAYOUT: Record<DashSection, Layout> = {
  visao: [b('kpi.revenue'), b('kpi.orders'), b('kpi.ticket'), b('kpi.conv'), b('kpi.ai'), b('why')],
  vendas: [b('sales'), b('funnel')],
  produtos: [b('top'), b('categories'), b('showcase')],
  ia: [b('ai.reco'), b('similar')],
  trafego: [b('heat'), b('sources')],
}

/** Seção de origem de cada cartão do padrão. */
export const HOME: Record<BuiltinId, DashSection> = Object.fromEntries(
  DASH_SECTIONS.flatMap((sec) => DEFAULT_LAYOUT[sec].map((i) => [i.id, sec])),
) as Record<BuiltinId, DashSection>

export const isDashSection = (s: string): s is DashSection => (DASH_SECTIONS as readonly string[]).includes(s)

/** Largura padrão de um bloco da IA, pelo tipo (o dono pode mudar depois). */
export const defaultSpan = (type: BlockSpec['type']): Span => (type === 'kpis' || type === 'line' || type === 'heat' || type === 'table' || type === 'funnel' ? 12 : 6)
