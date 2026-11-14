/**
 * Blocos do painel: receita (spec) → bloco com dados. Compartilhado entre o servidor (chat e
 * personalização com IA) e o navegador (que desenha os blocos salvos na hora, com o motor).
 * Nada aqui fala com a OpenAI nem usa API do Node.
 */
import { aiStatsOf, CATEGORY_LABEL, COMPARE_WITH, DIMENSIONS, FILTERS, funnelOf, groupMembers, heatOf, LABEL_CATALOG, LABEL_IDS, METRICS, PERIOD_IDS, PERIOD_LABEL, productName, radarOf, runQuery, similarOf } from './analytics.mjs'

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
/** Como cada tipo de bloco funciona (lido pelos planejadores de IA do chat e da personalização). */
export const BLOCK_TYPES_HELP = `TIPOS DE BLOCO
- kpis: 1 a 4 indicadores. Use "metrics" (lista), "period", "compare". Deixe metric e group_by nulos.
- line: uma métrica ao longo do tempo (por dia; por hora se period = today). Use "metric", "period", "compare". Deixe group_by nulo.
- bars: ranking ou comparação por grupo. Use "metric", "group_by", "period", "limit" e "order". Com product, category, source e ai_usage ordena por valor; com weekday, hour e day mantém a ordem natural.
- funnel: do cardápio ao pedido. Só "period".
- heat: pedidos por dia da semana e hora. Só "period" (use 30d se o usuário não disser).
- table: use "metrics" (1 a 4), "group_by", "period", "limit".
- similar: trocas de um produto por outro na aba "Parecidos" (de → para), com os pedidos que geraram. Só "period".
- ai_picks: o que a IA do cardápio mais sugere, quantos clicam e quantos pedem. Só "period".
- showcase: vitrine "visto × pedido" por produto (estrelas, vitrine que não converte, escondidos, pouca atenção). Só "period".
Campos que o bloco não usa: metric/group_by/order/limit/filtros = null e metrics = [].
- ATENÇÃO: "line" só mostra evolução POR DIA (por hora só quando period = today). Para pedidos "por hora", "por dia da semana" ou qualquer outro agrupamento, use "bars" com group_by = hour ou weekday. Nunca ponha "por hora" no título de um bloco line com period diferente de today.`

export const NN = (t, extra = {}) => ({ type: [t, 'null'], ...extra })
/** Máximo de grupos por bloco, de etiquetas por regra e de nomes mostrados na conferência. */
export const MAX_GROUPS = 4
const MAX_RULE_LABELS = 6

/** Agrupamento: nome + regra viva (categorias, TODAS as etiquetas, faixa de preço). */
export const GROUP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'categories', 'labels', 'price_min', 'price_max'],
  properties: {
    name: { type: 'string' },
    categories: { type: 'array', maxItems: 6, items: { type: 'string', enum: Object.keys(CATEGORY_LABEL) } },
    labels: { type: 'array', maxItems: MAX_RULE_LABELS, items: { type: 'string', enum: LABEL_IDS } },
    price_min: { type: ['number', 'null'] },
    price_max: { type: ['number', 'null'] },
  },
}

/** Saída estrita de um bloco planejado (usada pelo planejador do chat e pela personalização). */
export const BLOCK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'title', 'subtitle', 'metric', 'metrics', 'group_by', 'period', 'compare', 'limit', 'order', 'filter_source', 'filter_category', 'filter_product', 'filter_ai', 'groups'],
  properties: {
    type: { type: 'string', enum: BLOCK_TYPES },
    title: { type: 'string' },
    subtitle: NN('string'),
    metric: { type: ['string', 'null'], enum: [...Object.keys(METRICS), null] },
    metrics: { type: 'array', items: { type: 'string', enum: Object.keys(METRICS) } },
    group_by: { type: ['string', 'null'], enum: [...Object.keys(DIMENSIONS), null] },
    period: { type: 'string', enum: PERIOD_IDS },
    compare: { type: 'boolean' },
    limit: NN('integer'),
    order: { type: ['string', 'null'], enum: ['desc', 'asc', null] },
    filter_source: { type: ['string', 'null'], enum: [...FILTERS.source, null] },
    filter_category: { type: ['string', 'null'], enum: [...FILTERS.category, null] },
    filter_product: { type: ['string', 'null'], enum: [...FILTERS.product, null] },
    filter_ai: { type: ['string', 'null'], enum: [...FILTERS.ai_usage, null] },
    groups: { type: 'array', maxItems: MAX_GROUPS, items: GROUP_SCHEMA },
  },
}
export const isEnum = (v, list) => typeof v === 'string' && list.includes(v)

/** Confere o plano contra o catálogo. Devolve só blocos válidos e já normalizados. */
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v * 100) / 100)) : null)

/** Grupo vindo de fora (IA ou banco): só categorias e etiquetas que existem; sem critério nenhum, descarta. */
export function normalizeGroup(g) {
  const name = clean(g?.name, 40)
  const categories = [...new Set((Array.isArray(g?.categories) ? g.categories : []).filter((c) => isEnum(c, Object.keys(CATEGORY_LABEL))))].slice(0, 6)
  const labels = [...new Set((Array.isArray(g?.labels) ? g.labels : []).filter((l) => isEnum(l, LABEL_IDS)))].slice(0, MAX_RULE_LABELS)
  const price_min = num(g?.price_min, 0, 500)
  const price_max = num(g?.price_max, 0, 500)
  if (!name || (!categories.length && !labels.length && price_min == null && price_max == null)) return null
  if (price_min != null && price_max != null && price_min > price_max) return { name, categories, labels, price_min: price_max, price_max: price_min }
  return { name, categories, labels, price_min, price_max }
}

const money = (v) => `R$ ${new Intl.NumberFormat('pt-BR').format(v)}`
const listOr = (xs, w) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} ${w} ${xs[xs.length - 1]}` : (xs[0] ?? ''))

/** A regra de um grupo em português de balcão: "etiqueta Gelado, até R$ 20". */
export function describeRule(g) {
  const cats = (g.categories ?? []).map((c) => CATEGORY_LABEL[c] ?? c)
  const labs = (g.labels ?? []).map((id) => LABEL_CATALOG.find((l) => l.id === id)?.label ?? id)
  const price = g.price_min != null && g.price_max != null ? `de ${money(g.price_min)} a ${money(g.price_max)}` : g.price_min != null ? `a partir de ${money(g.price_min)}` : g.price_max != null ? `até ${money(g.price_max)}` : ''
  return [cats.length ? `${cats.length > 1 ? 'categorias' : 'categoria'} ${listOr(cats, 'ou')}` : '', labs.length ? `${labs.length > 1 ? 'etiquetas' : 'etiqueta'} ${listOr(labs, 'e')}` : '', price].filter(Boolean).join(', ')
}

/** "Frios (9 produtos: Café Latte Gelado, Cold Brew… e mais 4)", para o dono conferir a regra antes de salvar. */
export function describeGroups(spec) {
  return (spec.groups ?? [])
    .map((g) => {
      const ids = groupMembers(g)
      const names = ids.slice(0, 4).map(productName)
      return `${g.name}: ${ids.length} ${ids.length === 1 ? 'produto' : 'produtos'}${names.length ? ` (${names.join(', ')}${ids.length > 4 ? ` e mais ${ids.length - 4}` : ''})` : ''}`
    })
    .join('; ')
}

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
      groups: (Array.isArray(b.groups) ? b.groups : []).map(normalizeGroup).filter(Boolean).slice(0, MAX_GROUPS),
    }
    // "line" só sabe mostrar a evolução por dia (por hora só em "hoje"). Pedido de linha agrupada por
    // hora, dia da semana, produto etc. é, na verdade, um gráfico de barras: corrige para o título não mentir.
    if (spec.type === 'line' && spec.group_by && !['none', 'day'].includes(spec.group_by) && spec.period !== 'today') spec.type = 'bars'
    // comparar dois ou mais grupos é um gráfico de barras (um valor por grupo); o resto do bloco não se aplica
    if (spec.groups.length > 1) {
      spec.metric = spec.metric ?? spec.metrics[0] ?? null
      Object.assign(spec, { type: 'bars', metrics: [], group_by: null })
    }
    out.push(spec)
  }
  return out
}

const filterOf = (s, group = s.groups?.length === 1 ? s.groups[0] : null) => {
  const f = { source: s.filter_source, category: s.filter_category, product: s.filter_product, ai_usage: s.filter_ai }
  if (group) Object.assign(f, { products: groupMembers(group), group: group.name })
  return Object.values(f).some((v) => v != null) ? f : null
}

const GROUP_METRICS = ['revenue', 'orders', 'units']
/** Grupo só vale em métrica de itens vendidos, e uma regra que não pega nenhum produto não vira bloco. */
function assertGroups(s) {
  if (!s.groups?.length) return
  const metric = s.metric ?? s.metrics?.[0]
  const metrics = s.metrics?.length ? s.metrics : metric ? [metric] : []
  if (['funnel', 'heat', 'similar', 'ai_picks', 'showcase'].includes(s.type) || metrics.some((m) => !GROUP_METRICS.includes(m))) {
    throw new Error('agrupamento só vale para vendas, pedidos e unidades')
  }
  for (const g of s.groups) if (!groupMembers(g).length) throw new Error(`o grupo "${g.name}" não tem nenhum produto`)
}

/** Dois ou mais grupos: uma barra por grupo, com o mesmo período, filtros e comparação. */
function resolveGroupsCompare(s) {
  const metric = s.metric
  const filter = filterOf(s, null)
  const rs = s.groups.map((g) => ({ g, q: runQuery({ metric, period: s.period, compare: s.compare, filter: { ...filter, products: groupMembers(g), group: g.name } }) }))
  const sorted = [...rs].sort((a, b) => (s.order === 'asc' ? a.q.total - b.q.total : b.q.total - a.q.total))
  const rows = sorted.map(({ g, q }) => ({
    label: g.name,
    value: q.total,
    figure: figureOf(metric, q.total),
    ...(q.prevTotal != null ? { note: `${fmtDelta(delta(q.total, q.prevTotal)) || 'novo'} vs antes` } : { note: `${groupMembers(g).length} produtos` }),
  }))
  return {
    block: { type: 'bars', title: s.title, subtitle: s.subtitle ?? [PERIOD_LABEL[s.period][0].toUpperCase() + PERIOD_LABEL[s.period].slice(1), METRICS[metric].label].join(' · '), ranked: true, rows },
    summary: { bloco: s.title, tipo: 'comparação de grupos de produtos', metrica: METRICS[metric].label, periodo: PERIOD_LABEL[s.period], grupos: sorted.map(({ g, q }) => ({ grupo: g.name, produtos: groupMembers(g).length, valor: fmtValue(metric, q.total), ...(q.prevTotal != null ? { antes: fmtValue(metric, q.prevTotal), variacao: fmtDelta(delta(q.total, q.prevTotal)) } : {}) })) },
  }
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
  const r = resolveCore(s)
  // o cartão salvo precisa dizer o que cada grupo significa (semanas depois ninguém lembra da regra)
  if (s.groups?.length && r.block.type !== 'text') r.block.footnote = s.groups.map((g) => `${g.name} = ${describeRule(g)}`).join(' · ')
  return r
}

function resolveCore(s) {
  assertGroups(s)
  if (s.groups?.length > 1) return resolveGroupsCompare(s)
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
