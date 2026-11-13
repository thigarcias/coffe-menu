/**
 * Dados de EXEMPLO do painel do dono. Nada aqui vem de um servidor: serve para aprovar o
 * design. Os números nascem de poucas premissas (visitas, taxa de conversão, ticket) e o
 * resto é derivado delas, então funil, vendas e rankings concordam entre si.
 * Quando o painel for ligado a dados reais, só este arquivo é trocado.
 */
import menuData from '../data/menu.json'
import type { Menu, MenuItem } from '../types'

const menu = menuData as Menu
const byId = new Map(menu.items.map((i) => [i.id, i]))
export const cafeName = menu.cafe.name

export type Period = 'hoje' | '7d' | '30d'

export const PERIODS: { id: Period; label: string; prev: string }[] = [
  { id: 'hoje', label: 'Hoje', prev: 'ontem' },
  { id: '7d', label: '7 dias', prev: '7 dias antes' },
  { id: '30d', label: '30 dias', prev: '30 dias antes' },
]

/** Gerador pseudoaleatório com semente: o mesmo período mostra sempre os mesmos números. */
function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
const HOUR_W = [0.7, 1.1, 1.0, 0.9, 1.2, 1.1, 1.0, 1.5, 1.45, 1.2, 0.9, 0.8, 0.55, 0.3]
/** dom, seg, ter, qua, qui, sex, sáb */
const DOW_W = [1.25, 0.8, 0.85, 0.95, 1.05, 1.45, 1.4]
const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const DOW_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Hoje no mock: sexta, 13/11/2026, 16h40 (as datas dos gráficos partem daí). */
const NOW_HOUR = 16

const SESSIONS: Record<Period, number> = { hoje: 640, '7d': 3980, '30d': 15620 }
const CONV: Record<Period, number> = { hoje: 0.098, '7d': 0.104, '30d': 0.101 }
const TICKET = 44.7
const ITEMS_PER_ORDER = 2.4

/** Reparte `total` entre os baldes, proporcional aos pesos (com ruído) e fechando a conta. */
function spread(total: number, weights: number[], rand: () => number, noise = 0.1): number[] {
  const w = weights.map((x) => x * (1 - noise + rand() * noise * 2))
  const sum = w.reduce((a, b) => a + b, 0)
  const out = w.map((x) => Math.round((x / sum) * total))
  out[out.length - 1] += total - out.reduce((a, b) => a + b, 0)
  return out
}

function buckets(period: Period) {
  if (period === 'hoje') {
    const hs = HOURS.filter((h) => h <= NOW_HOUR)
    return {
      labels: hs.map((h) => `${h}h`),
      tip: hs.map((h) => `Hoje, ${h}h às ${h + 1}h`),
      weights: hs.map((h) => HOUR_W[HOURS.indexOf(h)]),
    }
  }
  const n = period === '7d' ? 7 : 30
  const days = Array.from({ length: n }, (_, k) => new Date(2026, 10, 13 - (n - 1 - k)))
  return {
    labels: days.map((d) => (period === '7d' ? DOW[d.getDay()] : String(d.getDate()))),
    tip: days.map((d) => `${DOW_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`),
    // o fim de semana pesa mais; no mês inteiro há uma leve alta ao longo das semanas
    weights: days.map((d, k) => DOW_W[d.getDay()] * (period === '30d' ? 0.88 + (k / n) * 0.24 : 1)),
  }
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

const it = (id: string): MenuItem => byId.get(id) ?? menu.items[0]
const price = (id: string) => it(id).prices.find((p) => p.price != null)?.price ?? 18

const TOP: [string, number][] = [
  ['cafe-latte-gelado', 0.105],
  ['cappuccino-tradicional', 0.08],
  ['avela-caramelo-latte', 0.07],
  ['pao-de-queijo-mineiro', 0.065],
  ['caramelo-frappuccino-base-cafe', 0.058],
  ['croissant-de-presunto-e-queijo', 0.052],
  ['cold-brew-tradicional', 0.05],
  ['brownie-espresso', 0.045],
]

export function build(period: Period): Dash {
  const seed = { hoje: 11, '7d': 29, '30d': 53 }[period]
  const rand = rng(seed)
  const b = buckets(period)
  const sessions = SESSIONS[period]
  const prevSessions = Math.round(sessions * (period === 'hoje' ? 0.96 : 0.93))
  const nOrders = Math.round(sessions * CONV[period])
  const prevOrders = Math.round(prevSessions * (CONV[period] - 0.006))

  const orders = spread(nOrders, b.weights, rand)
  const prevOrdersSeries = spread(prevOrders, b.weights, rng(seed + 100), 0.14)
  const revenue = orders.map((o, k) => Math.round(o * (TICKET + 2.2 * Math.sin(k * 1.7) + rand() * 2)))
  const prevRevenue = prevOrdersSeries.map((o, k) => Math.round(o * (TICKET * 0.96 + 2 * Math.sin(k * 1.3) + rand() * 2)))
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
  const totalRev = sum(revenue)
  const totalOrders = sum(orders)

  // ----- ajuda da IA -----
  const aiOpened = Math.round(sessions * 0.17)
  const aiFinished = Math.round(aiOpened * 0.74)
  const aiOrdered = Math.round(aiFinished * 0.22)
  const aiClicked = Math.round(aiFinished * 0.58)
  const aiAdded = Math.round(aiFinished * 0.31)
  const ticketAi = 51.4
  const ticketOthers = (totalRev - aiOrdered * ticketAi) / (totalOrders - aiOrdered)
  const aiRows = (
    [
      ['cafe-latte-gelado', 0.15, 0.64, 0.27],
      ['matcha-latte-gelado', 0.13, 0.59, 0.24],
      ['avela-caramelo-latte', 0.12, 0.61, 0.3],
      ['chai-latte-gelado', 0.1, 0.47, 0.18],
      ['cappuccino-canela', 0.09, 0.55, 0.22],
      ['cold-brew-com-leite', 0.08, 0.41, 0.15],
    ] as [string, number, number, number][]
  ).map(([id, s, click, ord]) => {
    const suggested = Math.round(aiFinished * 3 * s)
    return { item: it(id), suggested, clickRate: click, orders: Math.round(suggested * click * ord) }
  })

  // ----- parecidos -----
  const detailOpens = Math.round(sessions * 0.38)
  const simOpened = Math.round(detailOpens * 0.27)
  const simClicks = Math.round(simOpened * 0.34)
  const simOrders = Math.round(simClicks * 0.26)
  const flowsRaw: [string, string, number, number][] = [
    ['cappuccino-tradicional', 'cappuccino-canela', 0.24, 0.3],
    ['cafe-latte', 'cafe-latte-gelado', 0.2, 0.27],
    ['pao-de-queijo-mineiro', 'croissant-de-presunto-e-queijo', 0.17, 0.22],
    ['brownie-espresso', 'bolo-de-cenoura-com-chocolate', 0.14, 0.2],
    ['cold-brew-tradicional', 'cold-brew-com-leite', 0.13, 0.25],
    ['matcha-latte-gelado', 'chai-latte-gelado', 0.12, 0.21],
  ]
  const flows = flowsRaw.map(([f, t, s, o]) => {
    const clicks = Math.round(simClicks * s)
    return { from: it(f), to: it(t), clicks, orders: Math.round(clicks * o) }
  })

  // ----- ranking de produtos -----
  const items = totalOrders * ITEMS_PER_ORDER
  const top = TOP.map(([id, w]) => {
    const units = Math.round(items * w)
    const revenueItem = Math.round(units * price(id))
    return { item: it(id), units, revenue: revenueItem, share: revenueItem / totalRev }
  }).sort((a, c) => c.units - a.units)

  const catShares: [string, number][] = [
    ['Gelados', 0.3],
    ['Cafés', 0.26],
    ['Salgados', 0.16],
    ['Doces', 0.12],
    ['Novidades', 0.11],
    ['Bebidas', 0.05],
  ]
  const categories = catShares.map(([name, s]) => ({ name, revenue: Math.round(totalRev * s), share: s }))

  const srcShares: [string, number, number][] = [
    ['QR da mesa', 0.46, 0.134],
    ['QR do balcão', 0.24, 0.112],
    ['Instagram', 0.18, 0.054],
    ['Link direto', 0.12, 0.071],
  ]
  const sources = srcShares.map(([name, s, c]) => ({ name, sessions: Math.round(sessions * s), conv: c }))

  // ----- horários de pico (padrão dos últimos 30 dias, não muda com o filtro) -----
  const hr = rng(7)
  const order = [1, 2, 3, 4, 5, 6, 0]
  const rows = order.map((d) => ({
    label: DOW[d],
    cells: HOURS.map((_, k) => Math.round(14 * DOW_W[d] * HOUR_W[k] * (0.85 + hr() * 0.3))),
  }))
  let peak = { dow: 'sex', hour: 8, value: 0 }
  let total = 0
  let weekend = 0
  rows.forEach((r) =>
    r.cells.forEach((v, k) => {
      total += v
      if (r.label === 'sex' || r.label === 'sáb' || r.label === 'dom') weekend += v
      if (v > peak.value) peak = { dow: r.label, hour: HOURS[k], value: v }
    }),
  )
  const heat: Heat = { rows, hours: HOURS, max: peak.value, peak, weekendShare: weekend / total }

  // ----- vitrine: visto x pedido -----
  const scale = sessions / 3980
  const r = (n: number) => Math.round(n * scale)
  const radar = [
    {
      key: 'star',
      title: 'Estrelas',
      hint: 'Muito vistos e muito pedidos. Mantenha em destaque.',
      rows: [
        { item: it('cafe-latte-gelado'), views: r(1240), conv: 0.19 },
        { item: it('cappuccino-tradicional'), views: r(980), conv: 0.17 },
      ],
    },
    {
      key: 'window',
      title: 'Vitrine que não converte',
      hint: 'Chamam atenção, mas pouca gente pede. Reveja preço, foto ou tamanho.',
      rows: [
        { item: it('cinnamon-roll'), views: r(860), conv: 0.04 },
        { item: it('chocolate-quente'), views: r(710), conv: 0.05 },
      ],
    },
    {
      key: 'hidden',
      title: 'Escondidos',
      hint: 'Quem vê, pede. Suba no feed e na ajuda da IA.',
      rows: [
        { item: it('flat-white'), views: r(190), conv: 0.24 },
        { item: it('muffin-de-blueberry'), views: r(160), conv: 0.22 },
      ],
    },
    {
      key: 'weak',
      title: 'Pouca atenção, pouca venda',
      hint: 'Quase ninguém vê nem pede. Candidatos a sair do cardápio.',
      rows: [
        { item: it('queijo-quente'), views: r(120), conv: 0.03 },
        { item: it('cafe-americano'), views: r(140), conv: 0.04 },
      ],
    },
  ]

  const funnel = [
    { label: 'Abriram o cardápio', hint: 'Sessões pelo QR ou link', value: sessions },
    { label: 'Rolaram o feed', hint: 'Viram mais de um produto', value: Math.round(sessions * 0.71) },
    { label: 'Abriram um produto', hint: 'Tocaram em "Eu quero" ou "Com o que se parece"', value: detailOpens },
    { label: 'Puseram na sacola', hint: 'Adicionaram pelo menos um item', value: Math.round(sessions * 0.17) },
    { label: 'Fizeram o pedido', hint: 'Pedido enviado ao balcão', value: totalOrders },
  ]

  const kpi = {
    revenue: { value: totalRev, prev: sum(prevRevenue), spark: revenue },
    orders: { value: totalOrders, prev: prevOrders, spark: orders },
    ticket: {
      value: totalRev / totalOrders,
      prev: sum(prevRevenue) / prevOrders,
      spark: revenue.map((v, k) => v / Math.max(orders[k], 1)),
    },
    conv: {
      value: totalOrders / sessions,
      prev: prevOrders / prevSessions,
      spark: orders.map((o) => o / Math.max(sessions / orders.length, 1)),
    },
    ai: { value: aiOrdered / totalOrders, prev: (aiOrdered / totalOrders) * 0.8, spark: orders.map((o, k) => (o * (0.2 + 0.012 * k)) / Math.max(o, 1)) },
  }

  return {
    period,
    prevLabel: PERIODS.find((p) => p.id === period)!.prev,
    labels: b.labels,
    tipLabels: b.tip,
    revenue,
    prevRevenue,
    orders,
    sessions,
    kpi,
    funnel,
    top,
    ai: {
      opened: aiOpened,
      finished: aiFinished,
      suggested: aiFinished,
      clicked: aiClicked,
      added: aiAdded,
      ordered: aiOrdered,
      shareOfOrders: aiOrdered / totalOrders,
      convAi: aiOrdered / aiFinished,
      convOthers: (totalOrders - aiOrdered) / (sessions - aiFinished),
      ticketAi,
      ticketOthers,
      fallback: 0.04,
      rows: aiRows.sort((x, y) => y.suggested - x.suggested),
    },
    similar: { opened: simOpened, clicks: simClicks, orders: simOrders, revenue: Math.round(simOrders * 31.8), flows },
    categories,
    sources,
    heat,
    radar,
  }
}
