/**
 * Dados FICTÍCIOS do painel do dono e o motor de consulta.
 *
 * Uma única tabela de fatos (60 dias de visitas e pedidos, gerada de forma determinística)
 * alimenta o painel E o chat da IA, então os números nunca se contradizem. A IA não calcula:
 * ela pede uma consulta (métrica + agrupar por + período) e este motor devolve os números.
 *
 * Quando houver dados reais, troque `getFacts()` por uma leitura do banco e mantenha `runQuery`.
 * Roda no navegador (painel) e no servidor (chat), por isso é JavaScript puro.
 */
import menu from '../src/data/menu.json' with { type: 'json' }

/* ------------------------------------------------------------------ calendário */
export const DAYS = 61
export const TODAY = DAYS - 1
/** "Agora" no mock: sexta, 13/11/2026, 16h40. Hoje só tem horas até as 16h. */
export const NOW_HOUR = 16
export const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
const HOUR_W = [0.7, 1.1, 1.0, 0.9, 1.2, 1.1, 1.0, 1.5, 1.45, 1.2, 0.9, 0.8, 0.55, 0.3]
/** dom, seg, ter, qua, qui, sex, sáb */
const DOW_W = [1.25, 0.8, 0.85, 0.95, 1.05, 1.45, 1.4]
export const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export const DOW_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
/** 0 = 14/09/2026 ... 60 = 13/11/2026 (hoje) */
export const dayDate = (i) => new Date(2026, 8, 14 + i)
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

/* ------------------------------------------------------------------ catálogo */
const byId = new Map(menu.items.map((i) => [i.id, i]))
const unitPrice = (id) => byId.get(id)?.prices.find((p) => p.price != null)?.price ?? 18

export const CATEGORY_LABEL = { cafes: 'Cafés', gelados: 'Gelados', bebidas: 'Bebidas', salgados: 'Salgados', doces: 'Doces', novidades: 'Novidades' }

/** Etiquetas do cardápio (ids usados em `labels` dos itens), com o nome e a família de cada uma. */
export const LABEL_CATALOG = menu.tagGroups.flatMap((g) => g.tags.map((t) => ({ id: t.id, label: t.label, group: g.name })))
export const LABEL_IDS = LABEL_CATALOG.map((l) => l.id)

/** [id, peso de venda, peso de visualização, multiplicador de conversão de quem vê] */
const PRODUCTS = [
  ['cafe-latte-gelado', 10.5, 10.5, 1],
  ['cappuccino-tradicional', 8, 8.5, 1],
  ['avela-caramelo-latte', 7, 7, 1],
  ['pao-de-queijo-mineiro', 6.5, 5, 1.2],
  ['caramelo-frappuccino-base-cafe', 5.8, 5.5, 1],
  ['croissant-de-presunto-e-queijo', 5.2, 4.5, 1.1],
  ['cold-brew-tradicional', 5, 4.5, 1],
  ['brownie-espresso', 4.5, 4, 1],
  ['cafe-latte', 4, 3.5, 1],
  ['avela-caramelo-latte-gelado', 4, 4, 1],
  ['bolo-de-cenoura-com-chocolate', 3, 2.6, 1],
  ['cold-brew-com-leite', 3, 2.5, 1],
  ['chocolate-quente', 3, 9, 0.18],
  ['matcha-latte-gelado', 3, 3, 1],
  ['cappuccino-canela', 3, 3.2, 1],
  ['chai-latte-gelado', 2.5, 2.6, 1],
  ['morango-mocha-latte', 2.5, 2.8, 1],
  ['misto-quente', 2.5, 2.4, 1],
  ['flat-white', 2.2, 1, 1.6],
  ['croissant-de-frango', 2, 2, 1],
  ['cappuccino-brigadeiro', 2, 2.2, 1],
  ['muffin-de-blueberry', 1.8, 0.9, 1.5],
  ['cinnamon-roll', 1.5, 8, 0.15],
  ['pink-drink', 1.5, 1.6, 1],
  ['caramelo-frappuccino-base-creme', 1.2, 1.4, 1],
  ['cafe-americano', 1.2, 1, 0.9],
  ['queijo-quente', 0.8, 0.8, 0.8],
]
export const PRODUCT_IDS = PRODUCTS.map((p) => p[0])
const IDX = new Map(PRODUCT_IDS.map((id, i) => [id, i]))
const itemOf = (i) => byId.get(PRODUCT_IDS[i])

/**
 * Agrupamento por REGRA VIVA: os produtos que vendem no painel e se encaixam na regra, hoje.
 * Categoria: qualquer uma da lista. Etiquetas: TODAS. Preço: do primeiro tamanho com preço.
 * Produto novo que se encaixa entra sozinho; a regra nunca vira uma lista fixa.
 * @param {{categories?: string[], labels?: string[], price_min?: number|null, price_max?: number|null}} rule
 * @returns {string[]} ids de produto
 */
export function groupMembers(rule) {
  const cats = rule?.categories ?? []
  const labels = rule?.labels ?? []
  const min = rule?.price_min ?? null
  const max = rule?.price_max ?? null
  return PRODUCT_IDS.filter((id) => {
    const it = byId.get(id)
    if (!it) return false
    if (cats.length && !cats.includes(it.category)) return false
    if (labels.length && !labels.every((l) => it.labels?.includes(l))) return false
    const price = unitPrice(id)
    if (min != null && price < min) return false
    if (max != null && price > max) return false
    return true
  })
}
export const productName = (id) => byId.get(id)?.name ?? id

/** Origem das visitas: [nome, participação, multiplicador de compra] */
export const SOURCES = [
  ['QR da mesa', 0.46, 1.25],
  ['QR do balcão', 0.24, 1.1],
  ['Instagram', 0.18, 0.6],
  ['Link direto', 0.12, 0.8],
]

/** O que a IA do cardápio sugere, e quanto cada sugestão costuma ser clicada. */
const AI_POOL = [
  ['cafe-latte-gelado', 0.15, 0.64],
  ['matcha-latte-gelado', 0.13, 0.59],
  ['avela-caramelo-latte', 0.12, 0.61],
  ['chai-latte-gelado', 0.1, 0.47],
  ['cappuccino-canela', 0.09, 0.55],
  ['cold-brew-com-leite', 0.08, 0.41],
  ['cappuccino-tradicional', 0.08, 0.5],
  ['flat-white', 0.06, 0.5],
  ['pink-drink', 0.05, 0.4],
  ['brownie-espresso', 0.05, 0.5],
  ['muffin-de-blueberry', 0.04, 0.5],
].map(([id, w, c]) => [IDX.get(id), w, c])

/** Trocas em "Parecidos": [de, para, participação] */
const SIMILAR = [
  ['cappuccino-tradicional', 'cappuccino-canela', 0.24],
  ['cafe-latte', 'cafe-latte-gelado', 0.2],
  ['pao-de-queijo-mineiro', 'croissant-de-presunto-e-queijo', 0.17],
  ['brownie-espresso', 'bolo-de-cenoura-com-chocolate', 0.14],
  ['cold-brew-tradicional', 'cold-brew-com-leite', 0.13],
  ['matcha-latte-gelado', 'chai-latte-gelado', 0.12],
].map(([a, b, w]) => [IDX.get(a), IDX.get(b), w])

/* ------------------------------------------------------------------ geração */
function rng(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function sampler(weights) {
  const cum = []
  let s = 0
  for (const w of weights) cum.push((s += w))
  return (r) => {
    const x = r() * s
    let lo = 0
    let hi = cum.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (cum[mid] < x) lo = mid + 1
      else hi = mid
    }
    return lo
  }
}

let cache
/**
 * @returns {{sessions: any[], orders: any[], items: any[]}}
 * sessions: {d,h,w,src,scrolled,detail,added,ordered,ai,aiFb,sg,sc,viewed,swap}
 * orders:   {id,d,h,w,src,ai,sim,total,items:[[produto,qtd],...]}
 * items:    {d,h,w,src,ai,p,qty,rev,order}  (uma linha por produto de cada pedido)
 */
export function getFacts() {
  if (cache) return cache
  const r = rng(20261113)
  const sessions = []
  const orders = []
  const items = []
  const pickProduct = sampler(PRODUCTS.map((p) => p[1]))
  const pickView = sampler(PRODUCTS.map((p) => p[2]))
  const pickSource = sampler(SOURCES.map((s) => s[1]))
  const pickAi = sampler(AI_POOL.map((a) => a[1]))
  const pickPair = sampler(SIMILAR.map((s) => s[2]))
  const hourSum = HOUR_W.reduce((a, b) => a + b, 0)

  for (let d = 0; d < DAYS; d++) {
    const w = dayDate(d).getDay()
    const full = Math.round(515 * DOW_W[w] * (0.8 + 0.4 * (d / (DAYS - 1))) * (0.94 + 0.12 * r()))
    const hours = d === TODAY ? HOURS.filter((h) => h <= NOW_HOUR) : HOURS
    const pickHour = sampler(hours.map((h) => HOUR_W[HOURS.indexOf(h)]))
    const n = d === TODAY ? Math.round((full * HOUR_W.slice(0, hours.length).reduce((a, b) => a + b, 0)) / hourSum) : full
    for (let k = 0; k < n; k++) {
      const h = hours[pickHour(r)]
      const src = pickSource(r)
      const mult = SOURCES[src][2]
      const s = { d, h, w, src, scrolled: 0, detail: 0, added: 0, ordered: 0, ai: 0, aiFb: 0, aiOpen: 0, sg: null, sc: -1, viewed: -1, swap: -1 }
      s.aiOpen = r() < 0.17 ? 1 : 0
      if (s.aiOpen && r() < 0.74) {
        // pediu ajuda e recebeu 3 sugestões
        s.ai = 1
        s.aiFb = r() < 0.04 ? 1 : 0
        const sg = []
        while (sg.length < 3) {
          const a = AI_POOL[pickAi(r)]
          if (!sg.includes(a[0])) sg.push(a[0])
        }
        s.sg = sg
        s.scrolled = 1
        s.detail = 1
        if (r() < 0.58) s.sc = sg[Math.min(2, Math.floor(r() * 3))]
        s.added = s.sc >= 0 ? (r() < 0.55 ? 1 : 0) : r() < 0.05 ? 1 : 0
        s.ordered = s.added && r() < 0.65 ? 1 : 0
      } else {
        s.scrolled = r() < 0.668 ? 1 : 0
        s.detail = s.scrolled && r() < 0.46 ? 1 : 0
        s.added = s.detail && r() < 0.46 * mult ? 1 : 0
        s.ordered = s.added && r() < 0.58 ? 1 : 0
      }
      if (s.detail) {
        s.viewed = s.sc >= 0 ? s.sc : pickView(r)
        // aba "Parecidos": abre, troca por outro produto e às vezes pede
        if (r() < 0.27 && r() < 0.34) {
          s.swap = pickPair(r)
          s.viewed = SIMILAR[s.swap][0]
          s.added = r() < 0.5 ? 1 : 0
          s.ordered = s.added && r() < 0.52 ? 1 : 0
        }
      }
      sessions.push(s)
      if (!s.ordered) continue

      // pedido: de 1 a 4 itens (média ~2,4), com os itens "forçados" pelo caminho da pessoa
      const picks = []
      if (s.swap >= 0) picks.push(SIMILAR[s.swap][1])
      else if (s.sc >= 0) picks.push(s.sc)
      else if (s.viewed >= 0 && r() < Math.min(0.95, 0.62 * PRODUCTS[s.viewed][3])) picks.push(s.viewed)
      // quem usa a ajuda da IA costuma levar um item a mais (ela sugere um complemento)
      const total = 1 + (r() < 0.55 ? 1 : 0) + (r() < 0.5 ? 1 : 0) + (r() < 0.35 ? 1 : 0) + (s.ai && r() < 0.5 ? 1 : 0)
      while (picks.length < total) picks.push(pickProduct(r))
      const qty = new Map()
      for (const p of picks) qty.set(p, (qty.get(p) ?? 0) + 1)
      const lines = [...qty.entries()]
      const id = orders.length
      const sum = lines.reduce((a, [p, q]) => a + unitPrice(PRODUCT_IDS[p]) * q, 0)
      const order = { id, d, h, w, src, ai: s.ai, sim: s.swap >= 0 ? 1 : 0, total: Math.round(sum * 100) / 100, items: lines }
      orders.push(order)
      for (const [p, q] of lines) items.push({ d, h, w, src, ai: s.ai, p, qty: q, rev: Math.round(unitPrice(PRODUCT_IDS[p]) * q * 100) / 100, order: id })
    }
  }
  cache = { sessions, orders, items }
  return cache
}

/* ------------------------------------------------------------------ períodos */
/** Cada período é um intervalo de dias [de, ate]; `hoje` só vai até as 16h. */
export const PERIOD_IDS = ['today', 'yesterday', '7d', '30d', 'prev7d', 'prev30d']
export const PERIOD_LABEL = {
  today: 'hoje (até as 16h)',
  yesterday: 'ontem',
  '7d': 'últimos 7 dias completos (até ontem)',
  '30d': 'últimos 30 dias completos (até ontem)',
  prev7d: 'os 7 dias antes dos últimos 7',
  prev30d: 'os 30 dias antes dos últimos 30',
}
const RANGE = {
  today: { from: 60, to: 60, cap: NOW_HOUR },
  yesterday: { from: 59, to: 59, cap: 99 },
  '7d': { from: 53, to: 59, cap: 99 },
  '30d': { from: 30, to: 59, cap: 99 },
  prev7d: { from: 46, to: 52, cap: 99 },
  prev30d: { from: 0, to: 29, cap: 99 },
}
/** Com o que cada período se compara. */
export const COMPARE_WITH = { today: 'yesterday', yesterday: 'yesterday-1', '7d': 'prev7d', '30d': 'prev30d', prev7d: null, prev30d: null }

function rangeOf(period) {
  if (period === 'yesterday-1') return { from: 58, to: 58, cap: 99 }
  const r = RANGE[period]
  if (!r) throw new Error(`período desconhecido: ${period}`)
  return r
}
const inRange = (row, rg) => row.d >= rg.from && row.d <= rg.to && row.h <= rg.cap

/* ------------------------------------------------------------------ consulta */
export const METRICS = {
  revenue: { label: 'Vendas (R$)', format: 'money', about: 'soma dos pedidos, em reais' },
  orders: { label: 'Pedidos', format: 'number', about: 'quantidade de pedidos' },
  units: { label: 'Unidades vendidas', format: 'number', about: 'quantidade de itens vendidos' },
  avg_ticket: { label: 'Ticket médio (R$)', format: 'money', about: 'vendas ÷ pedidos' },
  sessions: { label: 'Visitas', format: 'number', about: 'pessoas que abriram o cardápio' },
  conversion: { label: 'Conversão', format: 'percent', about: 'pedidos ÷ visitas' },
}
export const DIMENSIONS = {
  none: 'sem agrupar (um total só)',
  day: 'por dia',
  hour: 'por hora do dia (8h às 21h)',
  weekday: 'por dia da semana (seg a dom)',
  product: 'por produto',
  category: 'por categoria (Cafés, Gelados, Bebidas, Salgados, Doces, Novidades)',
  source: 'por origem da visita (QR da mesa, QR do balcão, Instagram, Link direto)',
  ai_usage: 'com ou sem a ajuda da IA do cardápio',
}
const ITEM_DIMS_METRICS = ['revenue', 'orders', 'units']

/** Filtros que a IA pode usar (texto) → o que o motor entende. */
export const FILTERS = {
  source: SOURCES.map((x) => x[0]),
  category: Object.keys(CATEGORY_LABEL),
  product: PRODUCT_IDS,
  ai_usage: ['com_ia', 'sem_ia'],
}
function parseFilter(f) {
  if (!f) return undefined
  const out = {}
  if (f.source != null) {
    const i = SOURCES.findIndex((x) => x[0] === f.source)
    if (i < 0) throw new Error(`origem desconhecida: ${f.source}`)
    out.source = i
  }
  if (f.category != null) {
    if (!(f.category in CATEGORY_LABEL)) throw new Error(`categoria desconhecida: ${f.category}`)
    out.category = f.category
  }
  if (f.products != null) {
    // lista de produtos (agrupamento): ids desconhecidos são ignorados
    out.products = new Set(f.products.map((id) => IDX.get(id)).filter((i) => i !== undefined))
  }
  if (f.product != null) {
    const i = IDX.get(f.product)
    if (i === undefined) throw new Error(`produto desconhecido: ${f.product}`)
    out.product = i
  }
  if (f.ai_usage != null) {
    if (!FILTERS.ai_usage.includes(f.ai_usage)) throw new Error(`filtro de IA desconhecido: ${f.ai_usage}`)
    out.ai = f.ai_usage === 'com_ia' ? 1 : 0
  }
  return Object.keys(out).length ? out : undefined
}
function describeFilter(f) {
  const parts = []
  if (f.source != null) parts.push(`origem: ${f.source}`)
  if (f.category != null) parts.push(`categoria: ${CATEGORY_LABEL[f.category]}`)
  if (f.product != null) parts.push(`produto: ${byId.get(f.product)?.name ?? f.product}`)
  if (f.products != null) parts.push(`grupo: ${f.group ?? `${f.products.length} produtos`}`)
  if (f.ai_usage != null) parts.push(f.ai_usage === 'com_ia' ? 'só quem usou a IA' : 'só quem não usou a IA')
  return parts.join(' · ')
}

/** Quais agrupamentos cada métrica aceita. */
const ITEM_DIMS = ['none', 'day', 'hour', 'weekday', 'source', 'ai_usage', 'product', 'category']
const ORDER_DIMS = ['none', 'day', 'hour', 'weekday', 'source', 'ai_usage']
export const ALLOWED = { revenue: ITEM_DIMS, orders: ITEM_DIMS, units: ITEM_DIMS, avg_ticket: ORDER_DIMS, sessions: ORDER_DIMS, conversion: ORDER_DIMS }

const fmtDay = (i) => {
  const d = dayDate(i)
  return `${DOW_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** Chaves (e rótulos) de cada agrupamento, na ordem natural. */
function dimKeys(dim, rg) {
  switch (dim) {
    case 'none':
      return [{ key: 'all', label: 'Total' }]
    case 'day': {
      const out = []
      const many = rg.to - rg.from > 7
      for (let d = rg.from; d <= rg.to; d++) out.push({ key: d, label: many ? String(dayDate(d).getDate()) : DOW[dayDate(d).getDay()], tip: fmtDay(d) })
      return out
    }
    case 'hour':
      return HOURS.filter((h) => h <= rg.cap).map((h) => ({ key: h, label: `${h}h`, tip: `${h}h às ${h + 1}h` }))
    case 'weekday':
      return WEEK_ORDER.map((w) => ({ key: w, label: DOW[w], tip: DOW_LONG[w] }))
    case 'source':
      return SOURCES.map((s, i) => ({ key: i, label: s[0] }))
    case 'ai_usage':
      return [
        { key: 1, label: 'Com ajuda da IA' },
        { key: 0, label: 'Sem ajuda da IA' },
      ]
    case 'product':
      return PRODUCT_IDS.map((id, i) => ({ key: i, label: byId.get(id)?.name ?? id, id }))
    case 'category':
      return Object.entries(CATEGORY_LABEL).map(([k, v]) => ({ key: k, label: v }))
    default:
      throw new Error(`agrupamento desconhecido: ${dim}`)
  }
}

const rowKey = (dim, row) => {
  switch (dim) {
    case 'none':
      return 'all'
    case 'day':
      return row.d
    case 'hour':
      return row.h
    case 'weekday':
      return row.w
    case 'source':
      return row.src
    case 'ai_usage':
      return row.ai
    case 'product':
      return row.p
    case 'category':
      return itemOf(row.p)?.category
    default:
      return undefined
  }
}

/** Filtros opcionais: origem (índice), categoria (id), produto (índice), IA (1 com, 0 sem). */
const passes = (row, f) => {
  if (!f) return true
  if (f.source !== undefined && row.src !== f.source) return false
  if (f.ai !== undefined && row.ai !== f.ai) return false
  if (row.p !== undefined) {
    if (f.product !== undefined && row.p !== f.product) return false
    if (f.products !== undefined && !f.products.has(row.p)) return false
    if (f.category !== undefined && itemOf(row.p)?.category !== f.category) return false
  }
  return true
}

/** Soma por chave. */
function tally(rows, dim, rg, pick, filter) {
  const m = new Map()
  for (const row of rows) {
    if (!inRange(row, rg) || !passes(row, filter)) continue
    const k = rowKey(dim, row)
    m.set(k, (m.get(k) ?? 0) + pick(row))
  }
  return m
}

function computeValues(metric, dim, rg, filter) {
  const f = getFacts()
  // com produto/categoria (agrupando ou filtrando) a conta é feita pelos itens dos pedidos
  const byProduct = dim === 'product' || dim === 'category' || filter?.product !== undefined || filter?.products !== undefined || filter?.category !== undefined
  switch (metric) {
    case 'revenue':
      return byProduct ? tally(f.items, dim, rg, (i) => i.rev, filter) : tally(f.orders, dim, rg, (o) => o.total, filter)
    case 'orders': {
      if (!byProduct) return tally(f.orders, dim, rg, () => 1, filter)
      // pedidos que têm o produto/categoria (um pedido conta uma vez por produto)
      const seen = new Set()
      const m = new Map()
      for (const i of f.items) {
        if (!inRange(i, rg) || !passes(i, filter)) continue
        const k = rowKey(dim, i)
        const id = `${i.order}:${k}`
        if (seen.has(id)) continue
        seen.add(id)
        m.set(k, (m.get(k) ?? 0) + 1)
      }
      return m
    }
    case 'units':
      return tally(f.items, dim, rg, (i) => i.qty, filter)
    case 'sessions':
      return tally(f.sessions, dim, rg, () => 1, filter)
    case 'avg_ticket': {
      const rev = tally(f.orders, dim, rg, (o) => o.total, filter)
      const n = tally(f.orders, dim, rg, () => 1, filter)
      return new Map([...n].map(([k, v]) => [k, (rev.get(k) ?? 0) / v]))
    }
    case 'conversion': {
      const o = tally(f.orders, dim, rg, () => 1, filter)
      const s = tally(f.sessions, dim, rg, () => 1, filter)
      return new Map([...s].map(([k, v]) => [k, (o.get(k) ?? 0) / v]))
    }
    default:
      throw new Error(`métrica desconhecida: ${metric}`)
  }
}

/** Valor geral da métrica no período (não é a soma das linhas quando há produto ou categoria). */
function totalOf(metric, rg, filter) {
  return computeValues(metric, 'none', rg, filter).get('all') ?? 0
}

const round2 = (n) => Math.round(n * 100) / 100
const round4 = (n) => Math.round(n * 10000) / 10000

/**
 * @param {{metric: string, groupBy?: string, period?: string, compare?: boolean, limit?: number|null, order?: 'desc'|'asc'|null, filter?: {source?: string|null, category?: string|null, product?: string|null, ai_usage?: string|null}|null}} q
 * @returns {{metric, groupBy, period, compared, rows: {key, label, tip?, value, prev?}[], total, prevTotal?}}
 */
export function runQuery(q) {
  const metric = q.metric
  const groupBy = q.groupBy ?? 'none'
  const period = q.period ?? '7d'
  if (!METRICS[metric]) throw new Error(`métrica desconhecida: ${metric}`)
  if (!(groupBy in DIMENSIONS)) throw new Error(`agrupamento desconhecido: ${groupBy}`)
  if (!ALLOWED[metric].includes(groupBy)) throw new Error(`a métrica ${metric} não pode ser agrupada por ${groupBy}`)
  if (!PERIOD_IDS.includes(period)) throw new Error(`período desconhecido: ${period}`)
  const filter = parseFilter(q.filter)
  if ((filter?.product !== undefined || filter?.products !== undefined || filter?.category !== undefined) && !ITEM_DIMS_METRICS.includes(metric)) {
    throw new Error(`a métrica ${metric} não aceita filtro por produto, grupo ou categoria`)
  }

  const rg = rangeOf(period)
  const cmpId = q.compare ? COMPARE_WITH[period] : null
  let cmp = cmpId ? rangeOf(cmpId) : null
  if (cmp && period === 'today') cmp = { ...cmp, cap: NOW_HOUR } // ontem até a mesma hora, para comparar o que é comparável
  const cur = computeValues(metric, groupBy, rg, filter)
  const prv = cmp ? computeValues(metric, groupBy, cmp, filter) : null
  const keys = dimKeys(groupBy, rg)
  const prevKeys = cmp && groupBy === 'day' ? dimKeys('day', cmp) : null

  const rnd = METRICS[metric].format === 'percent' ? round4 : round2
  let rows = keys.map((k, i) => {
    const row = { key: k.key, label: k.label, ...(k.tip ? { tip: k.tip } : {}), ...(k.id ? { id: k.id } : {}), value: rnd(cur.get(k.key) ?? 0) }
    if (prv) row.prev = rnd(groupBy === 'day' ? (prv.get(prevKeys[i].key) ?? 0) : (prv.get(k.key) ?? 0))
    return row
  })
  if (['product', 'category', 'source', 'ai_usage'].includes(groupBy)) {
    rows = rows.filter((r) => r.value > 0 || groupBy === 'ai_usage' || groupBy === 'source')
    rows.sort((a, b) => (q.order === 'asc' ? a.value - b.value : b.value - a.value))
    rows = rows.slice(0, Math.max(1, Math.min(q.limit ?? (groupBy === 'product' ? 8 : 12), 20)))
  } else if (q.limit && q.order) {
    rows = [...rows].sort((a, b) => (q.order === 'asc' ? a.value - b.value : b.value - a.value)).slice(0, Math.max(1, Math.min(q.limit, 20)))
  }
  return {
    metric,
    groupBy,
    period,
    compared: cmpId,
    rows,
    ...(q.filter ? { filter: describeFilter(q.filter) } : {}),
    total: rnd(totalOf(metric, rg, filter)),
    ...(cmp ? { prevTotal: rnd(totalOf(metric, cmp, filter)) } : {}),
  }
}

/* ------------------------------------------------------------------ consultas prontas (funil, mapa de calor, IA, parecidos, vitrine) */
export function funnelOf(period = '7d') {
  const rg = rangeOf(period)
  const s = getFacts().sessions.filter((x) => inRange(x, rg))
  const n = (fn) => s.filter(fn).length
  return [
    { label: 'Abriram o cardápio', hint: 'Sessões pelo QR ou link', value: s.length },
    { label: 'Rolaram o feed', hint: 'Viram mais de um produto', value: n((x) => x.scrolled) },
    { label: 'Abriram um produto', hint: 'Tocaram em "Eu quero" ou "Com o que se parece"', value: n((x) => x.detail) },
    { label: 'Puseram na sacola', hint: 'Adicionaram pelo menos um item', value: n((x) => x.added) },
    { label: 'Fizeram o pedido', hint: 'Pedido enviado ao balcão', value: n((x) => x.ordered) },
  ]
}

/** Pedidos por dia da semana × hora. */
export function heatOf(period = '30d') {
  const rg = rangeOf(period)
  const grid = new Map()
  for (const o of getFacts().orders) {
    if (!inRange(o, rg)) continue
    const k = `${o.w}:${o.h}`
    grid.set(k, (grid.get(k) ?? 0) + 1)
  }
  const rows = WEEK_ORDER.map((w) => ({ label: DOW[w], cells: HOURS.map((h) => grid.get(`${w}:${h}`) ?? 0) }))
  let peak = { dow: 'seg', hour: 8, value: 0 }
  let total = 0
  let weekend = 0
  for (const r of rows)
    r.cells.forEach((v, k) => {
      total += v
      if (['sex', 'sáb', 'dom'].includes(r.label)) weekend += v
      if (v > peak.value) peak = { dow: r.label, hour: HOURS[k], value: v }
    })
  return { rows, hours: HOURS, max: peak.value, peak, weekendShare: total ? weekend / total : 0 }
}

export function aiStatsOf(period = '7d') {
  const rg = rangeOf(period)
  const f = getFacts()
  const s = f.sessions.filter((x) => inRange(x, rg))
  const o = f.orders.filter((x) => inRange(x, rg))
  const opened = s.filter((x) => x.aiOpen).length
  const fin = s.filter((x) => x.ai)
  const aiOrders = o.filter((x) => x.ai)
  const others = o.filter((x) => !x.ai)
  const sum = (a, fn) => a.reduce((t, x) => t + fn(x), 0)
  const sug = new Map()
  for (const x of fin) for (const p of x.sg) sug.set(p, (sug.get(p) ?? 0) + 1)
  const clicks = new Map()
  const ords = new Map()
  for (const x of fin) {
    if (x.sc >= 0) clicks.set(x.sc, (clicks.get(x.sc) ?? 0) + 1)
    if (x.sc >= 0 && x.ordered) ords.set(x.sc, (ords.get(x.sc) ?? 0) + 1)
  }
  const rows = [...sug.entries()]
    .map(([p, n]) => ({ item: itemOf(p), suggested: n, clickRate: n ? (clicks.get(p) ?? 0) / n : 0, orders: ords.get(p) ?? 0 }))
    .sort((a, b) => b.suggested - a.suggested)
  const nonAi = s.length - fin.length
  return {
    opened,
    finished: fin.length,
    clicked: fin.filter((x) => x.sc >= 0).length,
    added: fin.filter((x) => x.added).length,
    ordered: aiOrders.length,
    shareOfOrders: o.length ? aiOrders.length / o.length : 0,
    convAi: fin.length ? aiOrders.length / fin.length : 0,
    convOthers: nonAi ? others.length / nonAi : 0,
    ticketAi: aiOrders.length ? sum(aiOrders, (x) => x.total) / aiOrders.length : 0,
    ticketOthers: others.length ? sum(others, (x) => x.total) / others.length : 0,
    fallback: fin.length ? fin.filter((x) => x.aiFb).length / fin.length : 0,
    rows,
  }
}

export function similarOf(period = '7d') {
  const rg = rangeOf(period)
  const f = getFacts()
  const s = f.sessions.filter((x) => inRange(x, rg))
  const o = f.orders.filter((x) => inRange(x, rg) && x.sim)
  const detail = s.filter((x) => x.detail).length
  const swaps = s.filter((x) => x.swap >= 0)
  const flows = SIMILAR.map(([a, b], i) => {
    const sw = swaps.filter((x) => x.swap === i)
    return { from: itemOf(a), to: itemOf(b), clicks: sw.length, orders: sw.filter((x) => x.ordered).length }
  })
    .filter((x) => x.clicks > 0)
    .sort((x, y) => y.clicks - x.clicks)
  return {
    // quantas pessoas abriram a aba é estimado a partir de quem trocou (a aba não é registrada à parte neste mock)
    opened: Math.round(detail * 0.27),
    clicks: swaps.length,
    orders: o.length,
    revenue: round2(o.reduce((t, x) => t + x.total, 0)),
    flows,
  }
}

/** Visto × pedido, por produto: quantas pessoas abriram o produto e quantas pediram esse mesmo produto. */
export function radarOf(period = '7d') {
  const rg = rangeOf(period)
  const f = getFacts()
  // casa cada sessão que abriu um produto com o pedido dela (a ordem dos pedidos segue a das sessões)
  const views = new Map()
  const conv = new Map()
  let oi = 0
  const orders = f.orders
  const sessionOrder = new Map()
  for (const s of f.sessions) if (s.ordered) sessionOrder.set(s, orders[oi++])
  for (const s of f.sessions) {
    if (!inRange(s, rg) || s.viewed < 0) continue
    views.set(s.viewed, (views.get(s.viewed) ?? 0) + 1)
    const o = sessionOrder.get(s)
    if (o && o.items.some(([p]) => p === s.viewed)) conv.set(s.viewed, (conv.get(s.viewed) ?? 0) + 1)
  }
  const rows = [...views.entries()]
    .filter(([, v]) => v >= 5)
    .map(([p, v]) => ({ item: itemOf(p), views: v, conv: (conv.get(p) ?? 0) / v }))
  const medViews = [...rows.map((r) => r.views)].sort((a, b) => a - b)[Math.floor(rows.length / 2)] ?? 0
  const medConv = [...rows.map((r) => r.conv)].sort((a, b) => a - b)[Math.floor(rows.length / 2)] ?? 0
  const quad = (r) => (r.views >= medViews ? (r.conv >= medConv ? 'star' : 'window') : r.conv >= medConv ? 'hidden' : 'weak')
  const groups = { star: [], window: [], hidden: [], weak: [] }
  for (const r of rows) groups[quad(r)].push(r)
  groups.star.sort((a, b) => b.views * b.conv - a.views * a.conv)
  groups.window.sort((a, b) => b.views * (medConv - b.conv) - a.views * (medConv - a.conv))
  groups.hidden.sort((a, b) => b.conv - a.conv)
  groups.weak.sort((a, b) => a.views * a.conv - b.views * b.conv)
  return groups
}

/** Texto para o prompt da IA: o que existe para consultar. */
export function describeCatalog() {
  const metrics = Object.entries(METRICS)
    .map(([k, m]) => `- ${k}: ${m.label} (${m.about}). Agrupamentos aceitos: ${ALLOWED[k].join(', ')}`)
    .join('\n')
  const dims = Object.entries(DIMENSIONS)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')
  const periods = PERIOD_IDS.map((p) => `- ${p}: ${PERIOD_LABEL[p]}`).join('\n')
  const filters = [
    `- filter_source: ${FILTERS.source.join(' | ')}`,
    `- filter_category: ${FILTERS.category.join(' | ')}`,
    `- filter_product: um id de produto (${PRODUCT_IDS.map((id) => `${id} = ${byId.get(id)?.name}`).join('; ')})`,
    `- filter_ai: com_ia | sem_ia`,
  ].join('\n')
  return `MÉTRICAS\n${metrics}\n\nAGRUPAMENTOS (group_by)\n${dims}\n\nFILTROS (opcionais; só revenue, orders e units aceitam filtro por produto ou categoria)\n${filters}\n\nPERÍODOS\n${periods}\nHoje é sexta, 13/11/2026, 16h40. Os dados cobrem 61 dias. Só "today" inclui o dia de hoje (parcial); os demais períodos terminam ontem.`
}
