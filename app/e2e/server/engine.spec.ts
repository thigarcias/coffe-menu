import { expect, test } from '@playwright/test'
import { ALLOWED, DIMENSIONS, funnelOf, getFacts, heatOf, METRICS, NOW_HOUR, PERIOD_IDS, runQuery } from '../../shared/analytics.mjs'

// Motor de consulta e dados fictícios: a IA e o painel leem daqui, então os números têm que fechar.

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const close = (a: number, b: number, eps = 0.011) => Math.abs(a - b) <= eps

test('os dados são determinísticos: duas leituras dão o mesmo resultado', () => {
  const a = runQuery({ metric: 'revenue', groupBy: 'day', period: '30d' })
  const b = runQuery({ metric: 'revenue', groupBy: 'day', period: '30d' })
  expect(a).toEqual(b)
  expect(getFacts().orders.length).toBeGreaterThan(3000)
})

for (const period of PERIOD_IDS) {
  test(`período ${period}: as linhas por dia/hora fecham com o total`, () => {
    for (const metric of ['revenue', 'orders', 'units', 'sessions']) {
      const by = period === 'today' ? 'hour' : 'day'
      const q = runQuery({ metric, groupBy: by, period })
      expect(close(sum(q.rows.map((r) => r.value)), q.total, 0.05), `${metric} por ${by}`).toBe(true)
    }
  })
}

test('por categoria, origem e uso da IA, vendas somam o total', () => {
  const total = runQuery({ metric: 'revenue', period: '7d' }).total
  for (const g of ['category', 'source', 'ai_usage', 'weekday', 'hour'] as const) {
    const q = runQuery({ metric: 'revenue', groupBy: g, period: '7d', limit: 20 })
    expect(close(sum(q.rows.map((r) => r.value)), total, 0.05), g).toBe(true)
  }
})

test('por produto, os 20 maiores cobrem quase tudo e nunca passam do total', () => {
  const total = runQuery({ metric: 'revenue', period: '30d' }).total
  const q = runQuery({ metric: 'revenue', groupBy: 'product', period: '30d', limit: 20 })
  const s = sum(q.rows.map((r) => r.value))
  expect(q.rows).toHaveLength(20) // o motor limita a 20 linhas
  expect(s).toBeLessThanOrEqual(total + 0.01)
  expect(s).toBeGreaterThan(total * 0.9)
  // do mais vendido para o menos vendido
  expect(q.rows.every((r, i, a) => i === 0 || a[i - 1].value >= r.value)).toBe(true)
})

test('ticket médio = vendas ÷ pedidos e conversão = pedidos ÷ visitas', () => {
  for (const period of ['7d', '30d', 'yesterday']) {
    const rev = runQuery({ metric: 'revenue', period }).total
    const ord = runQuery({ metric: 'orders', period }).total
    const ses = runQuery({ metric: 'sessions', period }).total
    expect(close(runQuery({ metric: 'avg_ticket', period }).total, rev / ord, 0.011)).toBe(true)
    expect(close(runQuery({ metric: 'conversion', period }).total, ord / ses, 0.0001)).toBe(true)
  }
})

test('comparação: o "antes" é o período anterior equivalente', () => {
  const q = runQuery({ metric: 'revenue', period: '7d', compare: true })
  expect(q.compared).toBe('prev7d')
  expect(q.prevTotal).toBe(runQuery({ metric: 'revenue', period: 'prev7d' }).total)
  const day = runQuery({ metric: 'revenue', groupBy: 'day', period: '7d', compare: true })
  expect(day.rows).toHaveLength(7)
  expect(close(sum(day.rows.map((r) => r.prev ?? 0)), q.prevTotal!, 0.05)).toBe(true)
})

test('hoje só vai até as 16h e compara com ontem até a mesma hora', () => {
  const q = runQuery({ metric: 'orders', groupBy: 'hour', period: 'today', compare: true })
  expect(Math.max(...q.rows.map((r) => Number(r.key)))).toBe(NOW_HOUR)
  const yesterdayFull = runQuery({ metric: 'orders', period: 'yesterday' }).total
  expect(q.prevTotal!).toBeLessThanOrEqual(yesterdayFull)
  expect(close(sum(q.rows.map((r) => r.prev ?? 0)), q.prevTotal!, 0.05)).toBe(true)
})

test('7 e 30 dias terminam ontem (dias completos), sem misturar o dia de hoje', () => {
  const f = getFacts()
  const todayOrders = f.orders.filter((o: { d: number }) => o.d === 60).length
  const all30 = runQuery({ metric: 'orders', period: '30d' }).total
  const direct = f.orders.filter((o: { d: number }) => o.d >= 30 && o.d <= 59).length
  expect(all30).toBe(direct)
  expect(todayOrders).toBeGreaterThan(0)
})

test('filtros: categoria, origem, produto e IA reduzem o total de forma coerente', () => {
  const all = runQuery({ metric: 'revenue', period: '30d' }).total
  const gel = runQuery({ metric: 'revenue', period: '30d', filter: { category: 'gelados' } }).total
  expect(gel).toBeGreaterThan(0)
  expect(gel).toBeLessThan(all)
  const insta = runQuery({ metric: 'orders', period: '30d', filter: { source: 'Instagram' } }).total
  expect(insta).toBeLessThan(runQuery({ metric: 'orders', period: '30d' }).total)
  const com = runQuery({ metric: 'orders', period: '30d', filter: { ai_usage: 'com_ia' } }).total
  const sem = runQuery({ metric: 'orders', period: '30d', filter: { ai_usage: 'sem_ia' } }).total
  expect(com + sem).toBe(runQuery({ metric: 'orders', period: '30d' }).total)
  const latte = runQuery({ metric: 'units', period: '7d', filter: { product: 'cafe-latte-gelado' } }).total
  const top = runQuery({ metric: 'units', groupBy: 'product', period: '7d', limit: 1 })
  expect(top.rows[0].id).toBe('cafe-latte-gelado')
  expect(top.rows[0].value).toBe(latte)
})

test('combinações inválidas são recusadas, nunca viram número', () => {
  expect(() => runQuery({ metric: 'avg_ticket', groupBy: 'product' })).toThrow()
  expect(() => runQuery({ metric: 'sessions', groupBy: 'category' })).toThrow()
  expect(() => runQuery({ metric: 'sessions', filter: { category: 'doces' } })).toThrow()
  expect(() => runQuery({ metric: 'lucro' })).toThrow()
  expect(() => runQuery({ metric: 'revenue', groupBy: 'cliente' })).toThrow()
  expect(() => runQuery({ metric: 'revenue', period: '1a' })).toThrow()
  expect(() => runQuery({ metric: 'revenue', filter: { source: 'TikTok' } })).toThrow()
  expect(() => runQuery({ metric: 'revenue', filter: { product: 'pizza' } })).toThrow()
})

test('toda métrica aceita exatamente os agrupamentos que declara', () => {
  for (const [metric, dims] of Object.entries(ALLOWED) as [string, string[]][]) {
    for (const d of Object.keys(DIMENSIONS)) {
      const ok = dims.includes(d)
      if (ok) expect(() => runQuery({ metric, groupBy: d, period: '7d' }), `${metric} por ${d}`).not.toThrow()
      else expect(() => runQuery({ metric, groupBy: d, period: '7d' }), `${metric} por ${d}`).toThrow()
    }
    expect(METRICS[metric]).toBeTruthy()
  }
})

test('funil: nunca cresce de uma etapa para a seguinte e fecha com os pedidos', () => {
  for (const p of ['7d', '30d', 'today']) {
    const f = funnelOf(p)
    for (let i = 1; i < f.length; i++) expect(f[i].value, `${p} etapa ${i}`).toBeLessThanOrEqual(f[i - 1].value)
    expect(f[0].value).toBe(runQuery({ metric: 'sessions', period: p }).total)
  }
  // pedidos do funil = sessões que pediram (um pedido por sessão)
  expect(funnelOf('30d')[4].value).toBe(runQuery({ metric: 'orders', period: '30d' }).total)
})

test('mapa de calor: soma dos pedidos do período e pico dentro do horário de funcionamento', () => {
  const h = heatOf('30d')
  const total = sum(h.rows.flatMap((r: { cells: number[] }) => r.cells))
  expect(total).toBe(runQuery({ metric: 'orders', period: '30d' }).total)
  expect(h.peak.hour).toBeGreaterThanOrEqual(8)
  expect(h.peak.hour).toBeLessThanOrEqual(21)
})
