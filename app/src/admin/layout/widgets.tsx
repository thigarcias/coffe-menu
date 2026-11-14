import type { ReactNode } from 'react'
import { Funnel, Heatmap, Legend, LineChart, PREV, RankedBars, SAGE } from '../charts'
import { PERIODS, type Dash, type Period } from '../mock'
import { Card, Kpi, Thumb, axisMoney, compact, money0, moneyFull, num, pct } from './parts'
import type { BuiltinId } from './model'

/** Tudo que um cartão do padrão precisa para se desenhar. */
export interface WidgetCtx {
  d: Dash
  period: Period
  periodName: (typeof PERIODS)[number]
  showTable: boolean
  setShowTable: (fn: (v: boolean) => boolean) => void
}

interface Widget {
  /** nome mostrado no modo de edição e na lista "cartões escondidos" */
  label: string
  render: (c: WidgetCtx) => ReactNode
}

export const WIDGETS: Record<BuiltinId, Widget> = {
  'kpi.revenue': {
    label: 'Vendas (indicador)',
    render: ({ d }) => <Kpi hero label="Vendas" value={money0(d.kpi.revenue.value)} cur={d.kpi.revenue.value} prev={d.kpi.revenue.prev} spark={d.kpi.revenue.spark} hint={`antes ${money0(d.kpi.revenue.prev)}`} />,
  },
  'kpi.orders': {
    label: 'Pedidos (indicador)',
    render: ({ d }) => <Kpi label="Pedidos" value={num.format(d.kpi.orders.value)} cur={d.kpi.orders.value} prev={d.kpi.orders.prev} spark={d.kpi.orders.spark} />,
  },
  'kpi.ticket': {
    label: 'Ticket médio (indicador)',
    render: ({ d }) => <Kpi label="Ticket médio" value={moneyFull(d.kpi.ticket.value)} cur={d.kpi.ticket.value} prev={d.kpi.ticket.prev} spark={d.kpi.ticket.spark} />,
  },
  'kpi.conv': {
    label: 'Conversão (indicador)',
    render: ({ d }) => <Kpi label="Conversão" value={pct(d.kpi.conv.value, 1)} cur={d.kpi.conv.value} prev={d.kpi.conv.prev} spark={d.kpi.conv.spark} hint="visita → pedido" />,
  },
  'kpi.ai': {
    label: 'Com a IA (indicador)',
    render: ({ d }) => <Kpi label="Com a IA" value={pct(d.kpi.ai.value)} cur={d.kpi.ai.value} prev={d.kpi.ai.prev} spark={d.kpi.ai.spark} hint="dos pedidos usaram a ajuda" />,
  },

  why: {
    label: 'Por que vendeu',
    render: ({ d }) => {
      const ai = d.ai
      const peakDay = d.heat.peak
      const topItem = d.top[0]
      return (
        <Card cls="adm-s12" title="Por que vendeu" sub="O que mais explica os números deste período, em linguagem de balcão.">
          <ul className="adm-why">
            <li>
              <p className="adm-why__big">{pct(ai.shareOfOrders)}</p>
              <p>
                dos pedidos passaram pela <b>ajuda da IA</b>. Quem pede ajuda converte <b>{(ai.convAi / ai.convOthers).toFixed(1).replace('.', ',')}×</b> mais ({pct(ai.convAi)} contra {pct(ai.convOthers)}) e gasta{' '}
                <b>{moneyFull(ai.ticketAi - ai.ticketOthers)}</b> a mais por pedido.
              </p>
            </li>
            <li>
              <p className="adm-why__big">{num.format(d.similar.orders)}</p>
              <p>
                pedidos vieram de quem <b>trocou por um parecido</b>, somando <b>{compact(d.similar.revenue)}</b>. O vizinho de {d.similar.flows[0].from.name.toLowerCase()} que mais atrai é {d.similar.flows[0].to.name.toLowerCase()}.
              </p>
            </li>
            <li>
              <p className="adm-why__big">
                {peakDay.dow}, {peakDay.hour}h
              </p>
              <p>
                é o <b>pico de pedidos</b>. Sexta, sábado e domingo concentram <b>{pct(d.heat.weekendShare)}</b> das vendas. {topItem.item.name} é o mais pedido ({num.format(topItem.units)} un.).
              </p>
            </li>
          </ul>
        </Card>
      )
    },
  },

  sales: {
    label: 'Vendas no período',
    render: ({ d, period, periodName, showTable, setShowTable }) => (
      <Card
        cls="adm-s8"
        title="Vendas no período"
        sub={period === 'hoje' ? 'Por hora, até agora' : 'Por dia'}
        aside={
          <button className="adm-link" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
            {showTable ? 'Ver gráfico' : 'Ver como tabela'}
          </button>
        }
      >
        {showTable ? (
          <div className="adm-tablewrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>{period === 'hoje' ? 'Hora' : 'Dia'}</th>
                  <th>Pedidos</th>
                  <th>Vendas</th>
                  <th>{periodName.prev}</th>
                </tr>
              </thead>
              <tbody>
                {d.tipLabels.map((l, i) => (
                  <tr key={l}>
                    <td>{l}</td>
                    <td>{d.orders[i]}</td>
                    <td>{moneyFull(d.revenue[i])}</td>
                    <td>{moneyFull(d.prevRevenue[i])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <Legend
              items={[
                { color: SAGE, label: 'Este período' },
                { color: PREV, label: `Antes (${periodName.prev})` },
              ]}
            />
            <LineChart
              labels={d.labels}
              tipLabels={d.tipLabels}
              cur={d.revenue}
              prev={d.prevRevenue}
              curName="Este período"
              prevName="Antes"
              fmtTick={axisMoney}
              fmtValue={moneyFull}
              fmtShort={money0}
              ariaLabel={`Vendas ${period === 'hoje' ? 'por hora' : 'por dia'}, de ${money0(Math.min(...d.revenue))} a ${money0(Math.max(...d.revenue))}`}
            />
          </>
        )}
      </Card>
    ),
  },

  funnel: {
    label: 'Do cardápio ao pedido',
    render: ({ d }) => {
      const biggestDrop = d.funnel
        .slice(1)
        .map((s, i) => ({ from: d.funnel[i].label, to: s.label, drop: 1 - s.value / d.funnel[i].value }))
        .sort((a, b) => b.drop - a.drop)[0]
      return (
        <Card cls="adm-s4" title="Do cardápio ao pedido" sub="Onde as pessoas ficam pelo caminho.">
          <Funnel steps={d.funnel} fmt={(n) => num.format(n)} />
          <p className="adm-callout">
            Maior perda: entre <b>{biggestDrop.from.toLowerCase()}</b> e <b>{biggestDrop.to.toLowerCase()}</b> ({pct(biggestDrop.drop)}).
          </p>
        </Card>
      )
    },
  },

  top: {
    label: 'Mais vendidos',
    render: ({ d, periodName }) => (
      <Card cls="adm-s7" title="Mais vendidos" sub={`Unidades e vendas ${periodName.id === 'hoje' ? 'de hoje' : 'no período'}`}>
        <RankedBars
          rows={d.top.map((t) => ({
            key: t.item.id,
            label: t.item.name,
            sub: pct(t.share, 1) + ' das vendas',
            thumb: <Thumb item={t.item} />,
            value: t.units,
            figure: `${num.format(t.units)} un.`,
            figureSub: money0(t.revenue),
          }))}
        />
      </Card>
    ),
  },

  categories: {
    label: 'Vendas por categoria',
    render: ({ d }) => (
      <Card cls="adm-s5" title="Vendas por categoria" sub="Onde está o dinheiro do cardápio.">
        <RankedBars
          rows={d.categories.map((c) => ({
            key: c.name,
            label: c.name,
            value: c.share,
            figure: pct(c.share),
            figureSub: compact(c.revenue),
          }))}
        />
      </Card>
    ),
  },

  showcase: {
    label: 'Vitrine: visto × pedido',
    render: ({ d }) => (
      <Card cls="adm-s12" title="Vitrine: o que as pessoas veem × o que pedem" sub="Visualizações e quantos, entre os que viram, pediram. Mostra o que reorganizar no cardápio.">
        <div className="adm-radar">
          {d.radar.map((g) => (
            <section key={g.key} className={`adm-radar__col adm-radar__col--${g.key}`}>
              <h3>{g.title}</h3>
              <p>{g.hint}</p>
              <ul className="adm-rows">
                {g.rows.map((r) => (
                  <li key={r.item.id}>
                    <Thumb item={r.item} />
                    <div className="adm-rows__main">
                      <b>{r.item.name}</b>
                      <small>{num.format(r.views)} visualizações</small>
                    </div>
                    <div className="adm-rows__fig">
                      <b>{pct(r.conv)}</b>
                      <small>pedem</small>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Card>
    ),
  },

  'ai.reco': {
    label: 'Recomendação da IA',
    render: ({ d }) => {
      const ai = d.ai
      return (
        <Card cls="adm-s5" title="Recomendação da IA" sub="O que acontece depois que alguém pede ajuda.">
          <dl className="adm-stats">
            <div>
              <dt>Pediram ajuda</dt>
              <dd>{num.format(ai.opened)}</dd>
            </div>
            <div>
              <dt>Receberam sugestão</dt>
              <dd>{num.format(ai.finished)}</dd>
            </div>
            <div>
              <dt>Clicaram numa sugestão</dt>
              <dd>{num.format(ai.clicked)}</dd>
            </div>
            <div>
              <dt>Pediram o sugerido</dt>
              <dd>{num.format(ai.ordered)}</dd>
            </div>
          </dl>
          <h3 className="adm-sub">Mais sugeridos</h3>
          <ul className="adm-rows">
            {ai.rows.slice(0, 5).map((r) => (
              <li key={r.item.id}>
                <Thumb item={r.item} />
                <div className="adm-rows__main">
                  <b>{r.item.name}</b>
                  <small>
                    sugerido {num.format(r.suggested)}× · {pct(r.clickRate)} clicam
                  </small>
                </div>
                <div className="adm-rows__fig">
                  <b>{num.format(r.orders)}</b>
                  <small>pedidos</small>
                </div>
              </li>
            ))}
          </ul>
          <p className="adm-foot">{pct(ai.fallback)} das respostas usaram a “Sugestão rápida” (a IA não respondeu a tempo).</p>
        </Card>
      )
    },
  },

  similar: {
    label: 'Parecidos',
    render: ({ d }) => (
      <Card cls="adm-s7" title="Parecidos: para onde as pessoas vão" sub="Quando alguém abre “Parecidos” num produto e troca por outro.">
        <dl className="adm-stats adm-stats--3">
          <div>
            <dt>Abriram a aba</dt>
            <dd>{num.format(d.similar.opened)}</dd>
          </div>
          <div>
            <dt>Trocaram por outro</dt>
            <dd>{num.format(d.similar.clicks)}</dd>
          </div>
          <div>
            <dt>Viraram pedido</dt>
            <dd>{num.format(d.similar.orders)}</dd>
          </div>
        </dl>
        <ul className="adm-flows">
          {d.similar.flows.map((f) => (
            <li key={f.from.id + f.to.id}>
              <div className="adm-flows__pair">
                <span className="adm-flows__item">
                  <Thumb item={f.from} />
                  <b>{f.from.name}</b>
                </span>
                <svg className="adm-flows__arrow" width="18" height="12" viewBox="0 0 18 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-label="vai para">
                  <path d="M1 6h15M11 1l5 5-5 5" />
                </svg>
                <span className="adm-flows__item">
                  <Thumb item={f.to} />
                  <b>{f.to.name}</b>
                </span>
              </div>
              <div className="adm-flows__fig">
                <b>{num.format(f.clicks)}</b>
                <small>{f.orders} pedidos</small>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    ),
  },

  heat: {
    label: 'Horários de pico',
    render: ({ d }) => (
      <Card cls="adm-s7" title="Horários de pico" sub="Pedidos por dia da semana e hora. Padrão dos últimos 30 dias.">
        <Heatmap rows={d.heat.rows} hours={d.heat.hours} max={d.heat.max} />
      </Card>
    ),
  },

  sources: {
    label: 'Como chegaram',
    render: ({ d }) => (
      <Card cls="adm-s5" title="Como chegaram" sub="De onde vêm as visitas e quem vira pedido.">
        <RankedBars
          rows={d.sources.map((s) => ({
            key: s.name,
            label: s.name,
            sub: `${pct(s.conv, 1)} viram pedido`,
            value: s.sessions,
            figure: num.format(s.sessions),
            figureSub: 'visitas',
          }))}
        />
      </Card>
    ),
  },
}

/** Classe de largura do invólucro no modo editar (espelha a largura do próprio cartão). */
export const EDIT_SPAN: Record<BuiltinId, string> = {
  'kpi.revenue': 'hero',
  'kpi.orders': 'kpi',
  'kpi.ticket': 'kpi',
  'kpi.conv': 'kpi',
  'kpi.ai': 'kpi',
  why: 's12',
  sales: 's8',
  funnel: 's4',
  top: 's7',
  categories: 's5',
  showcase: 's12',
  'ai.reco': 's5',
  similar: 's7',
  heat: 's7',
  sources: 's5',
}
