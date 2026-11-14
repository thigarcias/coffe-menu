/**
 * Catálogo dos cartões do painel padrão, compartilhado entre o navegador e o servidor da IA
 * de personalização. Uma fonte só: o navegador (model.ts), o servidor (adminPersonalize.mjs)
 * e o teste do SQL (que confere a lista aceita pelo banco) leem daqui.
 */
export const DASH_SECTIONS = ['visao', 'vendas', 'produtos', 'ia', 'trafego']
export const SECTION_LABEL = { visao: 'Visão geral', vendas: 'Vendas', produtos: 'Produtos', ia: 'IA e Parecidos', trafego: 'Tráfego' }
export const SPANS = [4, 5, 6, 7, 8, 12]

/** label: nome no painel · about: o que mostra (a IA lê isto) · home: seção onde nasce */
export const BUILTIN_INFO = {
  'kpi.revenue': { label: 'Vendas (indicador)', home: 'visao', about: 'total de vendas em R$, com variação e minigráfico' },
  'kpi.orders': { label: 'Pedidos (indicador)', home: 'visao', about: 'quantidade de pedidos, com variação e minigráfico' },
  'kpi.ticket': { label: 'Ticket médio (indicador)', home: 'visao', about: 'valor médio por pedido, com variação e minigráfico' },
  'kpi.conv': { label: 'Conversão (indicador)', home: 'visao', about: 'visitas que viram pedido, com variação e minigráfico' },
  'kpi.ai': { label: 'Com a IA (indicador)', home: 'visao', about: 'parcela dos pedidos que usaram a ajuda da IA' },
  why: { label: 'Por que vendeu', home: 'visao', about: 'três frases sobre o que mais explica os números (IA, Parecidos, pico)' },
  sales: { label: 'Vendas no período', home: 'vendas', about: 'gráfico de linha das vendas por dia (ou hora), com o período anterior' },
  funnel: { label: 'Do cardápio ao pedido', home: 'vendas', about: 'funil: abriram, rolaram, abriram produto, sacola, pedido' },
  top: { label: 'Mais vendidos', home: 'produtos', about: 'ranking de produtos por unidades' },
  categories: { label: 'Vendas por categoria', home: 'produtos', about: 'barras de vendas por categoria' },
  showcase: { label: 'Vitrine: visto × pedido', home: 'produtos', about: 'produtos estrela, vitrine que não converte, escondidos e pouca atenção' },
  'ai.reco': { label: 'Recomendação da IA', home: 'ia', about: 'quantos pedem ajuda, recebem sugestão, clicam e pedem; mais sugeridos' },
  similar: { label: 'Parecidos', home: 'ia', about: 'trocas de um produto por outro na aba Parecidos' },
  heat: { label: 'Horários de pico', home: 'trafego', about: 'mapa de calor de pedidos por dia da semana e hora' },
  sources: { label: 'Como chegaram', home: 'trafego', about: 'origem das visitas (QR, Instagram, link) e quem converte' },
}
export const BUILTIN_IDS = Object.keys(BUILTIN_INFO)
