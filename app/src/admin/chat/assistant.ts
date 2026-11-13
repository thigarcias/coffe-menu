import { build } from '../mock'
import type { Block, Message } from './types'

/**
 * A "IA" desta fatia: respostas de exemplo montadas no código, com os mesmos blocos que a IA
 * de verdade vai usar. Troque `assistant` por uma chamada ao servidor e o resto continua igual.
 */
/** A IA "fala" em passos: um status (o que está fazendo) ou um bloco pronto da resposta. */
export type AssistantEvent = { type: 'status'; text: string } | { type: 'plan'; plan: unknown } | Block
export type Assistant = (prompt: string, history: Message[], signal: AbortSignal) => AsyncGenerator<AssistantEvent>

/** Nos testes (`cm.admin.fast = 1`) as pausas encolhem. */
const fast = () => {
  try {
    return localStorage.getItem('cm.admin.fast') === '1'
  } catch {
    return false
  }
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const t = setTimeout(resolve, fast() ? 25 : ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const num = new Intl.NumberFormat('pt-BR')
const money0 = (v: number) => `R$ ${num.format(Math.round(v))}`
const pct = (v: number, d = 0) => `${(v * 100).toFixed(d).replace('.', ',')}%`
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

export const SUGGESTIONS = ['Vendas dos últimos 7 dias', 'O que a IA mais recomenda?', 'Onde as pessoas desistem?', 'Quais horários vendem mais?']

const intents: { test: RegExp; run: (s: AbortSignal) => AsyncGenerator<AssistantEvent> }[] = [
  {
    test: /venda|faturamento|receita|dia da semana|semana|dias/,
    run: async function* (signal): AsyncGenerator<AssistantEvent> {
      const d = build('7d')
      yield { type: 'status', text: 'Consultando as vendas dos últimos 7 dias…' }
      await sleep(1000, signal)
      yield { type: 'status', text: 'Comparando com os 7 dias anteriores…' }
      await sleep(800, signal)
      yield { type: 'status', text: 'Montando o gráfico…' }
      await sleep(700, signal)
      const best = d.revenue.indexOf(Math.max(...d.revenue))
      const worst = d.revenue.indexOf(Math.min(...d.revenue))
      const total = sum(d.revenue)
      const prev = sum(d.prevRevenue)
      yield {
        type: 'line',
        title: 'Vendas por dia',
        subtitle: 'Últimos 7 dias, comparado com os 7 dias antes',
        labels: d.labels,
        tips: d.tipLabels,
        current: d.revenue,
        previous: d.prevRevenue,
        currentName: 'Este período',
        previousName: 'Antes',
        format: 'money',
      }
      yield {
        type: 'text',
        text: `Foram **${money0(total)}** em ${d.revenue.length} dias, ${pct(Math.abs(total / prev - 1), 1)} ${total >= prev ? 'a mais' : 'a menos'} que no período anterior. O melhor dia foi **${d.tipLabels[best]}** (${money0(d.revenue[best])}) e o mais fraco, **${d.tipLabels[worst]}** (${money0(d.revenue[worst])}). Dados de exemplo.`,
      }
    },
  },
  {
    test: /produto|mais vendid|ranking|top|item/,
    run: async function* (signal): AsyncGenerator<AssistantEvent> {
      const d = build('7d')
      yield { type: 'status', text: 'Somando as unidades vendidas por produto…' }
      await sleep(1000, signal)
      yield { type: 'status', text: 'Ordenando o ranking…' }
      await sleep(700, signal)
      yield {
        type: 'bars',
        title: 'Produtos mais vendidos',
        subtitle: 'Unidades nos últimos 7 dias',
        rows: d.top.map((t) => ({ label: t.item.name, value: t.units, figure: `${num.format(t.units)} un.`, note: money0(t.revenue) })),
      }
      const t = d.top[0]
      yield { type: 'text', text: `**${t.item.name}** lidera, com ${num.format(t.units)} unidades (${pct(t.share, 1)} das vendas). Os 3 primeiros somam ${pct(sum(d.top.slice(0, 3).map((x) => x.share)), 1)} do faturamento. Dados de exemplo.` }
    },
  },
  {
    test: /\bia\b|recomend|sugest|ajuda/,
    run: async function* (signal): AsyncGenerator<AssistantEvent> {
      const d = build('7d')
      const ai = d.ai
      yield { type: 'status', text: 'Contando quem pediu ajuda da IA…' }
      await sleep(900, signal)
      yield { type: 'status', text: 'Cruzando com os pedidos…' }
      await sleep(800, signal)
      yield {
        type: 'kpis',
        title: 'Ajuda da IA',
        items: [
          { label: 'Pediram ajuda', value: num.format(ai.opened) },
          { label: 'Receberam sugestão', value: num.format(ai.finished) },
          { label: 'Clicaram numa sugestão', value: num.format(ai.clicked) },
          { label: 'Pediram o sugerido', value: num.format(ai.ordered) },
        ],
      }
      yield {
        type: 'bars',
        title: 'O que a IA mais sugere',
        subtitle: 'Pedidos gerados por sugestão',
        rows: ai.rows.slice(0, 5).map((r) => ({ label: r.item.name, value: r.orders, figure: `${r.orders} pedidos`, note: `sugerido ${num.format(r.suggested)}×` })),
      }
      yield { type: 'text', text: `${pct(ai.shareOfOrders)} dos pedidos passaram pela ajuda da IA. Quem pede ajuda converte **${(ai.convAi / ai.convOthers).toFixed(1).replace('.', ',')}×** mais (${pct(ai.convAi)} contra ${pct(ai.convOthers)}). Dados de exemplo.` }
    },
  },
  {
    test: /funil|desist|convers|abandon|sacola/,
    run: async function* (signal): AsyncGenerator<AssistantEvent> {
      const d = build('7d')
      yield { type: 'status', text: 'Montando o caminho do cliente…' }
      await sleep(1000, signal)
      yield { type: 'status', text: 'Calculando onde se perde mais gente…' }
      await sleep(700, signal)
      yield { type: 'funnel', title: 'Do cardápio ao pedido', steps: d.funnel }
      const drops = d.funnel.slice(1).map((s, i) => ({ from: d.funnel[i].label, to: s.label, drop: 1 - s.value / d.funnel[i].value }))
      const big = drops.sort((a, b) => b.drop - a.drop)[0]
      yield { type: 'text', text: `A maior perda é entre **${big.from.toLowerCase()}** e **${big.to.toLowerCase()}** (${pct(big.drop)}). No total, ${pct(d.funnel[4].value / d.funnel[0].value, 1)} das visitas viram pedido. Dados de exemplo.` }
    },
  },
  {
    test: /hora|horario|pico|movimento|quando/,
    run: async function* (signal): AsyncGenerator<AssistantEvent> {
      const d = build('7d')
      yield { type: 'status', text: 'Agrupando pedidos por dia e hora…' }
      await sleep(1000, signal)
      yield { type: 'status', text: 'Montando o mapa de calor…' }
      await sleep(700, signal)
      yield { type: 'heat', title: 'Pedidos por dia e hora', subtitle: 'Padrão dos últimos 30 dias', hours: d.heat.hours, rows: d.heat.rows }
      yield { type: 'text', text: `O pico é **${d.heat.peak.dow}, ${d.heat.peak.hour}h** (${d.heat.peak.value} pedidos). Sexta, sábado e domingo concentram ${pct(d.heat.weekendShare)} das vendas. Dados de exemplo.` }
    },
  },
  {
    test: /parecid|troc/,
    run: async function* (signal): AsyncGenerator<AssistantEvent> {
      const d = build('7d')
      yield { type: 'status', text: 'Seguindo os cliques em "Parecidos"…' }
      await sleep(1000, signal)
      yield {
        type: 'bars',
        title: 'Para onde as pessoas vão em "Parecidos"',
        subtitle: 'Trocas de um produto por outro',
        rows: d.similar.flows.map((f) => ({ label: `${f.from.name} → ${f.to.name}`, value: f.clicks, figure: `${f.clicks} trocas`, note: `${f.orders} pedidos` })),
      }
      yield { type: 'text', text: `${num.format(d.similar.opened)} pessoas abriram a aba, ${num.format(d.similar.clicks)} trocaram por outro produto e **${d.similar.orders}** viraram pedido (${money0(d.similar.revenue)}). Dados de exemplo.` }
    },
  },
  {
    test: /categoria|gelad|cafes|doces|salgad/,
    run: async function* (signal): AsyncGenerator<AssistantEvent> {
      const d = build('7d')
      yield { type: 'status', text: 'Somando as vendas por categoria…' }
      await sleep(900, signal)
      yield { type: 'bars', title: 'Vendas por categoria', rows: d.categories.map((c) => ({ label: c.name, value: c.share, figure: pct(c.share), note: money0(c.revenue) })) }
      yield { type: 'text', text: `**${d.categories[0].name}** é a categoria que mais vende (${pct(d.categories[0].share)}). Dados de exemplo.` }
    },
  },
]

export const mockAssistant: Assistant = async function* (prompt, _history, signal) {
  yield { type: 'status', text: 'Entendendo o pedido…' }
  await sleep(600, signal)
  const q = norm(prompt)
  const hit = intents.find((i) => i.test.test(q))
  if (hit) {
    yield* hit.run(signal)
    return
  }
  yield {
    type: 'text',
    text: 'Por enquanto respondo com exemplos prontos. Experimente perguntar sobre **vendas**, **produtos mais vendidos**, **a ajuda da IA**, **onde as pessoas desistem**, **horários de pico**, **parecidos** ou **categorias**.',
  }
}
