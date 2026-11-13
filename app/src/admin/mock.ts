/**
 * Dados do painel do dono, lidos da MESMA tabela fictícia que a IA do chat consulta
 * (`shared/analytics.mjs`). Nada aqui é sorteado de novo: filtrar por período, perguntar no chat
 * ou abrir outra aba dá números que concordam entre si. Quando houver dados reais, a tabela é
 * trocada lá, e este arquivo continua igual.
 */
import menuData from '../data/menu.json'
import type { Menu, MenuItem } from '../types'
import { aiStatsOf, CATEGORY_LABEL, funnelOf, heatOf, radarOf, runQuery, similarOf } from '../../shared/analytics.mjs'

const menu = menuData as Menu
export const cafeName = menu.cafe.name

export type Period = 'hoje' | '7d' | '30d'

export const PERIODS: { id: Period; label: string; prev: string }[] = [
  { id: 'hoje', label: 'Hoje', prev: 'ontem' },
  { id: '7d', label: '7 dias', prev: '7 dias antes' },
  { id: '30d', label: '30 dias', prev: '30 dias antes' },
]

/** Nome do período no motor de consulta. */
const ENGINE: Record<Period, { now: string; ago: string }> = {
  hoje: { now: 'today', ago: 'yesterday' },
  '7d': { now: '7d', ago: 'prev7d' },
  '30d': { now: '30d', ago: 'prev30d' },
}

export interface Kpi {
  value: number
  prev: number
  spark: number[]
}

export interface Dash {
  period: Period
  prevLabel: string
  labels: string[]
  tipLabels: string[]
  revenue: number[]
  prevRevenue: number[]
  orders: number[]
  sessions: number
  kpi: { revenue: Kpi; orders: Kpi; ticket: Kpi; conv: Kpi; ai: Kpi }
  funnel: { label: string; hint: string; value: number }[]
  top: { item: MenuItem; units: number; revenue: number; share: number }[]
  ai: AiBlock
  similar: SimilarBlock
  categories: { name: string; revenue: number; share: number }[]
  sources: { name: string; sessions: number; conv: number }[]
  heat: Heat
  radar: { key: string; title: string; hint: string; rows: { item: MenuItem; views: number; conv: number }[] }[]
}

export interface AiBlock {
  opened: number
  finished: number
  suggested: number
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

export interface SimilarBlock {
  opened: number
  clicks: number
  orders: number
  revenue: number
  flows: { from: MenuItem; to: MenuItem; clicks: number; orders: number }[]
}

export interface Heat {
  rows: { label: string; cells: number[] }[]
  hours: number[]
  max: number
  peak: { dow: string; hour: number; value: number }
  weekendShare: number
}

export function build(period: Period): Dash {
  const { now, ago } = ENGINE[period]
  const by = period === 'hoje' ? 'hour' : 'day'
  const rev = runQuery({ metric: 'revenue', groupBy: by, period: now, compare: true })
  const ord = runQuery({ metric: 'orders', groupBy: by, period: now, compare: true })
  const tkt = runQuery({ metric: 'avg_ticket', groupBy: by, period: now, compare: true })
  const cnv = runQuery({ metric: 'conversion', groupBy: by, period: now, compare: true })
  const ses = runQuery({ metric: 'sessions', period: now })
  const aiNow = aiStatsOf(now)
  const aiAgo = aiStatsOf(ago)

  const top = runQuery({ metric: 'units', groupBy: 'product', period: now, limit: 8 })
  const topRev = runQuery({ metric: 'revenue', groupBy: 'product', period: now, limit: 30 })
  const totalRev = rev.total
  const byId = new Map(menu.items.map((i) => [i.id, i]))
  const cats = runQuery({ metric: 'revenue', groupBy: 'category', period: now })
  const src = runQuery({ metric: 'sessions', groupBy: 'source', period: now })
  const srcConv = runQuery({ metric: 'conversion', groupBy: 'source', period: now })
  const radar = radarOf(now)
  const aiShareSeries = (() => {
    const all = ord.rows.map((r) => r.value)
    const ai = runQuery({ metric: 'orders', groupBy: by, period: now, filter: { ai_usage: 'com_ia' } }).rows.map((r) => r.value)
    return all.map((n, i) => (n ? ai[i] / n : 0))
  })()

  return {
    period,
    prevLabel: PERIODS.find((p) => p.id === period)!.prev,
    labels: rev.rows.map((r) => r.label),
    tipLabels: rev.rows.map((r) => r.tip ?? r.label),
    revenue: rev.rows.map((r) => r.value),
    prevRevenue: rev.rows.map((r) => r.prev ?? 0),
    orders: ord.rows.map((r) => r.value),
    sessions: ses.total,
    kpi: {
      revenue: { value: rev.total, prev: rev.prevTotal ?? 0, spark: rev.rows.map((r) => r.value) },
      orders: { value: ord.total, prev: ord.prevTotal ?? 0, spark: ord.rows.map((r) => r.value) },
      ticket: { value: tkt.total, prev: tkt.prevTotal ?? 0, spark: tkt.rows.map((r) => r.value) },
      conv: { value: cnv.total, prev: cnv.prevTotal ?? 0, spark: cnv.rows.map((r) => r.value) },
      ai: { value: aiNow.shareOfOrders, prev: aiAgo.shareOfOrders, spark: aiShareSeries },
    },
    funnel: funnelOf(now),
    top: top.rows.map((r) => ({
      item: byId.get(String(r.id))!,
      units: r.value,
      revenue: topRev.rows.find((x) => x.id === r.id)?.value ?? 0,
      share: (topRev.rows.find((x) => x.id === r.id)?.value ?? 0) / totalRev,
    })),
    ai: { ...aiNow, suggested: aiNow.finished },
    similar: similarOf(now),
    categories: cats.rows.map((c) => ({ name: CATEGORY_LABEL[String(c.key)] ?? c.label, revenue: c.value, share: c.value / cats.total })),
    sources: src.rows.map((s) => ({ name: s.label, sessions: s.value, conv: srcConv.rows.find((x) => x.key === s.key)?.value ?? 0 })).sort((a, b) => b.sessions - a.sessions),
    // o mapa de calor mostra sempre o padrão dos últimos 30 dias, qualquer que seja o filtro
    heat: heatOf('30d'),
    radar: [
      { key: 'star', title: 'Estrelas', hint: 'Muito vistos e muito pedidos. Mantenha em destaque.', rows: radar.star.slice(0, 2) },
      { key: 'window', title: 'Vitrine que não converte', hint: 'Chamam atenção, mas pouca gente pede. Reveja preço, foto ou tamanho.', rows: radar.window.slice(0, 2) },
      { key: 'hidden', title: 'Escondidos', hint: 'Quem vê, pede. Suba no feed e na ajuda da IA.', rows: radar.hidden.slice(0, 2) },
      { key: 'weak', title: 'Pouca atenção, pouca venda', hint: 'Quase ninguém vê nem pede. Candidatos a sair do cardápio.', rows: radar.weak.slice(0, 2) },
    ],
  }
}
