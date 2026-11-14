/**
 * Blocos do painel: receita (spec) → bloco com dados. Compartilhado entre o servidor (chat e
 * personalização com IA) e o navegador (que desenha os blocos salvos na hora, com o motor).
 * Nada aqui fala com a OpenAI nem usa API do Node.
 */
import { aiStatsOf, COMPARE_WITH, DIMENSIONS, FILTERS, funnelOf, heatOf, METRICS, PERIOD_IDS, PERIOD_LABEL, radarOf, runQuery, similarOf } from './analytics.mjs'

export const BLOCK_TYPES = ['kpis', 'line', 'bars', 'funnel', 'heat', 'table', 'similar', 'ai_picks', 'showcase']

export function clean(text, max = 700) {
  let t = String(text ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`+/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim()
  if (t.length > max) t = t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…'
  return t
}
export const isEnum = (v, list) => typeof v === 'string' && list.includes(v)

/** Confere o plano contra o catálogo. Devolve só blocos válidos e já normalizados. */
export function normalizePlan(plan) {
  const out = []
  for (const b of Array.isArray(plan?.blocks) ? plan.blocks.slice(0, 4) : []) {
    if (!b || !isEnum(b.type, BLOCK_TYPES)) continue
    const period = isEnum(b.period, PERIOD_IDS) ? b.period : '7d'
    const spec = {
      type: b.type,
      title: clean(b.title, 70) || 'Resultado',
      subtitle: clean(b.subtitle, 110) || null,
      metric: isEnum(b.metric, Object.keys(METRICS)) ? b.metric : null,
      metrics: (Array.isArray(b.metrics) ? b.metrics : []).filter((m) => isEnum(m, Object.keys(METRICS))).slice(0, 4),
      group_by: isEnum(b.group_by, Object.keys(DIMENSIONS)) ? b.group_by : null,
      period,
      compare: !!b.compare && COMPARE_WITH[period] != null,
      limit: Number.isInteger(b.limit) ? Math.max(1, Math.min(b.limit, 20)) : null,
      order: b.order === 'asc' ? 'asc' : b.order === 'desc' ? 'desc' : null,
      filter_source: isEnum(b.filter_source, FILTERS.source) ? b.filter_source : null,
      filter_category: isEnum(b.filter_category, FILTERS.category) ? b.filter_category : null,
      filter_product: isEnum(b.filter_product, FILTERS.product) ? b.filter_product : null,
      filter_ai: isEnum(b.filter_ai, FILTERS.ai_usage) ? b.filter_ai : null,
    }
    out.push(spec)
  }
  return out
}

const filterOf = (s) => {
  const f = { source: s.filter_source, category: s.filter_category, product: s.filter_product, ai_usage: s.filter_ai }
  return Object.values(f).some((v) => v != null) ? f : null
}

/* ------------------------------------------------------------------ formatação */
const nf = new Intl.NumberFormat('pt-BR')
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = (v, d = 0) => `${(v * 100).toFixed(d).replace('.', ',')}%`
const money0 = (v) => `R$ ${nf.format(Math.round(v))}`
const fmtMoney = (v) => (v >= 1000 ? money0(v) : brl.format(v))
export function fmtValue(metric, v) {
  const f = METRICS[metric].format
  if (f === 'money') return v >= 1000 ? money0(v) : brl.format(v)
  if (f === 'percent') return pct(v, 1)
  return nf.format(Math.round(v))
}
const figureOf = (metric, v) => (metric === 'units' ? `${nf.format(Math.round(v))} un.` : metric === 'orders' ? `${nf.format(Math.round(v))} pedidos` : metric === 'sessions' ? `${nf.format(Math.round(v))} visitas` : fmtValue(metric, v))
const DIM_LABEL = { weekday: 'Dia da semana', hour: 'Hora', day: 'Dia', product: 'Produto', category: 'Categoria', source: 'Origem', ai_usage: 'Uso da IA' }
const delta = (cur, prev) => (prev ? (cur - prev) / prev : null)
const fmtDelta = (d) => (d == null ? '' : `${d >= 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(1).replace('.', ',')}%`)
const subtitleOf = (s, q) => s.subtitle ?? [PERIOD_LABEL[s.period][0].toUpperCase() + PERIOD_LABEL[s.period].slice(1), q.filter].filter(Boolean).join(' · ')

/* ------------------------------------------------------------------ plano → bloco com dados */
/**
 * Executa um bloco planejado no motor e devolve o bloco pronto para a tela, mais um resumo
 * compacto (para o redator) com os números que ele pode citar.
 */
export function resolveBlock(s) {
  const filter = filterOf(s)
  if (s.type === 'funnel') {
    const steps = funnelOf(s.period)
    return {
      block: { type: 'funnel', title: s.title, steps },
      summary: { bloco: s.title, tipo: 'funil', periodo: PERIOD_LABEL[s.period], etapas: steps.map((x, i) => ({ etapa: x.label, valor: x.value, do_total: i ? pct(x.value / steps[0].value, 1) : '100%', queda_da_etapa_anterior: i ? pct(1 - x.value / steps[i - 1].value, 1) : null })) },
    }
  }
  if (s.type === 'heat') {
    const h = heatOf(s.period)
    return {
      block: { type: 'heat', title: s.title, subtitle: s.subtitle ?? `Pedidos por dia e hora · ${PERIOD_LABEL[s.period]}`, hours: h.hours, rows: h.rows },
      summary: { bloco: s.title, tipo: 'mapa de calor de pedidos', periodo: PERIOD_LABEL[s.period], pico: `${h.peak.dow}, ${h.peak.hour}h (${h.peak.value} pedidos)`, fim_de_semana_participacao: pct(h.weekendShare) },
    }
  }
  if (s.type === 'similar') {
    const x = similarOf(s.period)
    return {
      block: { type: 'bars', title: s.title, subtitle: s.subtitle ?? `Trocas pela aba Parecidos · ${PERIOD_LABEL[s.period]}`, ranked: true, rows: x.flows.map((f) => ({ label: `${f.from.name} → ${f.to.name}`, value: f.clicks, figure: `${nf.format(f.clicks)} trocas`, note: `${f.orders} pedidos` })) },
      summary: { bloco: s.title, tipo: 'Parecidos', periodo: PERIOD_LABEL[s.period], abriram_a_aba: nf.format(x.opened), trocaram_por_outro: nf.format(x.clicks), viraram_pedido: nf.format(x.orders), vendas_geradas: money0(x.revenue), trocas: x.flows.map((f) => ({ de: f.from.name, para: f.to.name, trocas: f.clicks, pedidos: f.orders })) },
    }
  }
  if (s.type === 'ai_picks') {
    const a = aiStatsOf(s.period)
    const top = a.rows.slice(0, 8)
    return {
      block: { type: 'bars', title: s.title, subtitle: s.subtitle ?? `O que a IA mais sugere · ${PERIOD_LABEL[s.period]}`, ranked: true, rows: top.map((r) => ({ label: r.item.name, value: r.suggested, figure: `${nf.format(r.suggested)} sugestões`, note: `${pct(r.clickRate)} clicam · ${r.orders} pedidos` })) },
      summary: { bloco: s.title, tipo: 'sugestões da IA do cardápio', periodo: PERIOD_LABEL[s.period], pediram_ajuda: nf.format(a.opened), receberam_sugestao: nf.format(a.finished), clicaram: nf.format(a.clicked), pediram_o_sugerido: nf.format(a.ordered), participacao_nos_pedidos: pct(a.shareOfOrders), conversao_com_ia: pct(a.convAi), conversao_sem_ia: pct(a.convOthers), ticket_com_ia: fmtMoney(a.ticketAi), ticket_sem_ia: fmtMoney(a.ticketOthers), mais_sugeridos: top.map((r) => ({ produto: r.item.name, sugestoes: r.suggested, clicam: pct(r.clickRate), pedidos: r.orders })) },
    }
  }
  if (s.type === 'showcase') {
    const g = radarOf(s.period)
    const names = { star: 'Estrela', window: 'Vitrine que não converte', hidden: 'Escondido', weak: 'Pouca atenção, pouca venda' }
    const rows = Object.keys(names).flatMap((k) => g[k].slice(0, 3).map((r) => [names[k], r.item.name, nf.format(r.views), pct(r.conv)]))
    return {
      block: { type: 'table', title: s.title, columns: ['Grupo', 'Produto', 'Visualizações', 'Pedem'], rows },
      summary: { bloco: s.title, tipo: 'vitrine visto x pedido', periodo: PERIOD_LABEL[s.period], produtos: rows.map((r) => ({ grupo: r[0], produto: r[1], visualizacoes: r[2], pedem: r[3] })) },
    }
  }
  if (s.type === 'kpis') {
    const metrics = s.metrics.length ? s.metrics : s.metric ? [s.metric] : []
    if (!metrics.length) throw new Error('kpis sem métricas')
    const rs = metrics.map((m) => runQuery({ metric: m, period: s.period, compare: s.compare, filter }))
    return {
      block: {
        type: 'kpis',
        title: s.title,
        items: rs.map((r) => ({
          label: METRICS[r.metric].label,
          value: fmtValue(r.metric, r.total),
          ...(r.prevTotal != null ? { note: `${fmtDelta(delta(r.total, r.prevTotal))} vs ${PERIOD_LABEL[r.compared] ?? 'antes'}` } : {}),
        })),
      },
      summary: { bloco: s.title, tipo: 'indicadores', periodo: PERIOD_LABEL[s.period], filtro: rs[0].filter ?? null, indicadores: rs.map((r) => ({ metrica: METRICS[r.metric].label, valor: fmtValue(r.metric, r.total), ...(r.prevTotal != null ? { antes: fmtValue(r.metric, r.prevTotal), variacao: fmtDelta(delta(r.total, r.prevTotal)) } : {}) })) },
    }
  }
  const metric = s.metric ?? s.metrics[0]
  if (!metric) throw new Error('bloco sem métrica')
  if (s.type === 'line') {
    const q = runQuery({ metric, groupBy: s.period === 'today' ? 'hour' : 'day', period: s.period, compare: s.compare, filter })
    const f = METRICS[metric].format
    return {
      block: {
        type: 'line',
        title: s.title,
        subtitle: subtitleOf(s, q),
        labels: q.rows.map((r) => r.label),
        tips: q.rows.map((r) => r.tip ?? r.label),
        current: q.rows.map((r) => r.value),
        previous: s.compare ? q.rows.map((r) => r.prev ?? 0) : [],
        currentName: 'Este período',
        previousName: 'Antes',
        format: f,
      },
      summary: {
        bloco: s.title,
        tipo: 'linha no tempo',
        metrica: METRICS[metric].label,
        periodo: PERIOD_LABEL[s.period],
        filtro: q.filter ?? null,
        total: fmtValue(metric, q.total),
        ...(q.prevTotal != null ? { total_antes: fmtValue(metric, q.prevTotal), variacao: fmtDelta(delta(q.total, q.prevTotal)) } : {}),
        maior: ((m) => `${m.tip ?? m.label}: ${fmtValue(metric, m.value)}`)(q.rows.reduce((a, b) => (b.value > a.value ? b : a))),
        menor: ((m) => `${m.tip ?? m.label}: ${fmtValue(metric, m.value)}`)(q.rows.reduce((a, b) => (b.value < a.value ? b : a))),
        pontos: q.rows.map((r) => ({ quando: r.tip ?? r.label, valor: fmtValue(metric, r.value), ...(r.prev != null ? { antes: fmtValue(metric, r.prev) } : {}) })),
      },
    }
  }
  const groupBy = s.group_by && s.group_by !== 'none' ? s.group_by : null
  if (!groupBy) throw new Error(`${s.type} sem agrupamento`)
  if (s.type === 'bars') {
    const q = runQuery({ metric, groupBy, period: s.period, compare: s.compare, limit: s.limit, order: s.order, filter })
    const ranked = ['product', 'category', 'source', 'ai_usage'].includes(groupBy)
    const additive = ['revenue', 'orders', 'units', 'sessions'].includes(metric) && q.total > 0 && ['category', 'source', 'ai_usage', 'weekday', 'hour', 'day'].includes(groupBy)
    const rows = q.rows.map((r) => ({
      label: r.tip && groupBy !== 'hour' ? r.tip : r.label,
      value: r.value,
      figure: figureOf(metric, r.value),
      ...(q.prevTotal != null && r.prev != null ? { note: `${fmtDelta(delta(r.value, r.prev)) || 'novo'} vs antes` } : additive ? { note: pct(r.value / q.total) } : {}),
    }))
    return {
      block: { type: 'bars', title: s.title, subtitle: subtitleOf(s, q), ranked, rows },
      summary: {
        bloco: s.title,
        tipo: `barras por ${groupBy}`,
        metrica: METRICS[metric].label,
        periodo: PERIOD_LABEL[s.period],
        filtro: q.filter ?? null,
        total: fmtValue(metric, q.total),
        ...(q.prevTotal != null ? { total_antes: fmtValue(metric, q.prevTotal), variacao_total: fmtDelta(delta(q.total, q.prevTotal)) } : {}),
        linhas: q.rows.map((r) => ({ grupo: r.label, valor: fmtValue(metric, r.value), ...(additive ? { participacao: pct(r.value / q.total, 1) } : {}), ...(r.prev != null ? { antes: fmtValue(metric, r.prev), variacao: fmtDelta(delta(r.value, r.prev)) } : {}) })),
      },
    }
  }
  if (s.type === 'table') {
    const metrics = s.metrics.length ? s.metrics : [metric]
    const rs = metrics.map((m, i) => runQuery({ metric: m, groupBy, period: s.period, limit: i === 0 ? s.limit : 20, order: i === 0 ? s.order : null, filter }))
    const lead = rs[0]
    const rows = lead.rows.map((r) => [r.label, ...rs.map((q) => fmtValue(q.metric, q.rows.find((x) => x.key === r.key)?.value ?? 0))])
    return {
      block: { type: 'table', title: s.title, columns: [DIM_LABEL[groupBy] ?? 'Grupo', ...metrics.map((m) => METRICS[m].label)], rows },
      summary: { bloco: s.title, tipo: `tabela por ${groupBy}`, periodo: PERIOD_LABEL[s.period], filtro: lead.filter ?? null, linhas: rows.map((r) => Object.fromEntries(['grupo', ...metrics.map((m) => METRICS[m].label)].map((c, i) => [c, r[i]]))) },
    }
  }
  throw new Error(`tipo de bloco desconhecido: ${s.type}`)
}
