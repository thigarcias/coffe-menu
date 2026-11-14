import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { MenuItem } from '../types'
import { build, cafeName, PERIODS, type Period } from './mock'
import { Funnel, Heatmap, Legend, LineChart, PREV, RankedBars, SAGE, Sparkline } from './charts'
import { ChatDrawer, ChatPanel, Icon, openInNewTab } from './chat/ChatPanel'
import { sweep } from './chat/runner'
import { SessionsList } from './chat/SessionsList'
import { setChatUi, useChatUi, useSessions } from './chat/store'
import './admin.css'
import { Team } from './Team'
import { MenuEditor } from './MenuEditor'

const num = new Intl.NumberFormat('pt-BR')
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = (v: number, d = 0) => `${(v * 100).toFixed(d).replace('.', ',')}%`
const money0 = (v: number) => `R$ ${num.format(Math.round(v))}`
const moneyFull = (v: number) => brl.format(v)
const compact = (v: number) => (v >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `R$ ${Math.round(v)}`)
const axisMoney = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(v))

function Thumb({ item }: { item: MenuItem }) {
  return item.image ? (
    <img className="adm-thumb" src={`${import.meta.env.BASE_URL}${item.image}`} alt="" loading="lazy" />
  ) : (
    <span className="adm-thumb" />
  )
}

function Card({ cls, title, sub, children, aside }: { cls: string; title: string; sub?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className={`adm-card ${cls}`}>
      <header className="adm-card__head">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  )
}

function Delta({ cur, prev, inverse }: { cur: number; prev: number; inverse?: boolean }) {
  const d = (cur - prev) / prev
  const good = inverse ? d <= 0 : d >= 0
  return (
    <span className={`adm-delta ${good ? 'is-up' : 'is-down'}`}>
      <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden>
        <path d={d >= 0 ? 'M4.5 1 8 7.5H1z' : 'M4.5 8 1 1.5H8z'} fill="currentColor" />
      </svg>
      {d >= 0 ? '+' : '−'}
      {Math.abs(d * 100).toFixed(1).replace('.', ',')}%<span className="sr-only"> em relação ao período anterior</span>
    </span>
  )
}

function Kpi({ label, value, prev, spark, cur, hero, hint, inverse }: { label: string; value: string; prev: number; spark: number[]; cur: number; hero?: boolean; hint?: string; inverse?: boolean }) {
  return (
    <section className={`adm-card adm-kpi${hero ? ' adm-kpi--hero' : ''}`}>
      <p className="adm-kpi__label">{label}</p>
      <p className="adm-kpi__value">{value}</p>
      <div className="adm-kpi__row">
        <Delta cur={cur} prev={prev} inverse={inverse} />
        {hint && <span className="adm-kpi__hint">{hint}</span>}
      </div>
      <Sparkline values={spark} />
    </section>
  )
}

const SECTIONS = [
  { id: 'visao', label: 'Visão geral', sub: 'Os números do período e o que mais explica eles.' },
  { id: 'vendas', label: 'Vendas', sub: 'Quanto vendeu e por onde o cliente passa até pedir.' },
  { id: 'produtos', label: 'Produtos', sub: 'O que mais vende e o que reorganizar no cardápio.' },
  { id: 'ia', label: 'IA e Parecidos', sub: 'O que a recomendação e os produtos parecidos geram.' },
  { id: 'trafego', label: 'Tráfego', sub: 'Quando e de onde as pessoas chegam.' },
  { id: 'cardapio', label: 'Cardápio', sub: 'Personalize e publique o cardápio da unidade.' },
  { id: 'equipe', label: 'Equipe', sub: 'Pessoas e permissões da cafeteria.' },
  { id: 'sessoes', label: 'Sessões', sub: 'Conversas com a IA. Continuam rodando mesmo com o chat fechado.' },
] as const
type SectionId = (typeof SECTIONS)[number]['id']

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const fromHash = (): SectionId => SECTIONS.find((s) => s.id === window.location.hash.slice(1))?.id ?? 'visao'

type AdminProps = { onSignOut: () => void; signingOut: boolean }

function Dashboard({ onSignOut, signingOut }: AdminProps) {
  const [period, setPeriod] = useState<Period>('7d')
  const d = useMemo(() => build(period), [period])
  const [showTable, setShowTable] = useState(false)
  // o painel é uma página de abas: cada item do menu mostra só a sua seção
  const [active, setActive] = useState<SectionId>(fromHash)
  const rootRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const prev = document.title
    document.title = `Painel · ${cafeName}`
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => {
      document.title = prev
      meta.remove()
    }
  }, [])

  // a aba fica no endereço (/admin#vendas): recarregar ou mandar o link abre na mesma aba
  useEffect(() => {
    if (window.location.hash !== `#${active}`) window.history.replaceState(null, '', `#${active}`)
  }, [active])
  useEffect(() => {
    const onHash = () => setActive(fromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // no celular o menu rola de lado: mantém a aba ativa à vista
  useEffect(() => {
    const nav = navRef.current
    const btn = nav?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (nav && btn) nav.scrollTo({ left: btn.offsetLeft - (nav.clientWidth - btn.offsetWidth) / 2, behavior: reduceMotion() ? 'auto' : 'smooth' })
  }, [active])

  const go = (id: SectionId) => {
    setActive(id)
    rootRef.current?.scrollTo({ top: 0 }) // a aba nova começa do alto
  }
  const onKeys = (e: React.KeyboardEvent) => {
    const i = SECTIONS.findIndex((s) => s.id === active)
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? SECTIONS.length - 1 : null
    if (next == null) return
    e.preventDefault()
    const id = SECTIONS[(next + SECTIONS.length) % SECTIONS.length].id
    go(id)
    navRef.current?.querySelector<HTMLElement>(`#tab-${id}`)?.focus()
  }

  const chat = useChatUi()
  const sessions = useSessions()
  // guias que perderam o dono da resposta (guia fechada no meio) viram "interrompidas"
  useEffect(() => {
    sweep()
    const t = setInterval(sweep, 2000)
    return () => clearInterval(t)
  }, [])
  const openChat = (id?: string | null) => setChatUi({ open: true, sessionId: id === undefined ? (chat.sessionId ?? sessions[0]?.id ?? null) : id })

  const peakDay = d.heat.peak
  const topItem = d.top[0]
  const ai = d.ai
  const biggestDrop = d.funnel
    .slice(1)
    .map((s, i) => ({ from: d.funnel[i].label, to: s.label, drop: 1 - s.value / d.funnel[i].value }))
    .sort((a, b) => b.drop - a.drop)[0]
  const periodName = PERIODS.find((p) => p.id === period)!

  return (
    <div className="adm" ref={rootRef}>
      <header className="adm-top">
        <div className="adm-top__inner">
          <div className="adm-top__brand">
            <span className="adm-top__logo" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 10h13v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-5z" />
                <path d="M17 11h2a2 2 0 0 1 0 4h-2" />
                <path d="M8 3v3M12 3v3" />
              </svg>
            </span>
            <div>
              <h1>Painel</h1>
              <p>{cafeName}</p>
            </div>
          </div>
          {/* abas: cada uma mostra só a sua seção */}
          <nav className="adm-nav" role="tablist" aria-label="Seções do painel" ref={navRef} onKeyDown={onKeys}>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                id={`tab-${s.id}`}
                role="tab"
                aria-selected={s.id === active}
                aria-controls={s.id}
                tabIndex={s.id === active ? 0 : -1}
                className={s.id === active ? 'is-on' : ''}
                onClick={() => go(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>
          <div className="adm-top__actions">
            <button className="adm-signout" type="button" disabled={signingOut} onClick={onSignOut}>Sair</button>
            <button className="adm-ask" onClick={() => openChat()} aria-expanded={chat.open} aria-haspopup="dialog">
              <Icon d="spark" />
              Perguntar à IA
              {sessions.some((s) => s.status === 'running') && <span className="sr-only"> (há uma conversa rodando)</span>}
            </button>
            <a className="adm-top__link" href="/">
              Ver cardápio
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 2h6v6M10 2 3 9" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      <main className="adm-main">
        {/* filtros: ficam no começo da página, não no topo fixo */}
        {active !== 'sessoes' && active !== 'equipe' && active !== 'cardapio' && (
        <div className="adm-filters">
          <div className="adm-filters__row">
            <span className="adm-filters__label" id="adm-period-label">
              Período
            </span>
            <div className="adm-seg" role="group" aria-labelledby="adm-period-label">
              {PERIODS.map((p) => (
                <button key={p.id} className={p.id === period ? 'is-on' : ''} aria-pressed={p.id === period} onClick={() => setPeriod(p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <p className="adm-note">
            <span className="adm-pill" title="Os números são exemplos, só para aprovar o design">
              Dados de exemplo
            </span>{' '}
            Comparado com {periodName.prev}. Sexta, 13 de novembro de 2026, 16h40.
          </p>
        </div>
        )}

        {/* =================================================== visão geral */}
        {active === 'visao' && (
        <section id="visao" className="adm-sec" role="tabpanel" aria-labelledby="tab-visao">
          <header className="adm-sec__head">
            <h2 id="h-visao">{SECTIONS[0].label}</h2>
            <p>{SECTIONS[0].sub}</p>
          </header>
          <div className="adm-grid">
            <Kpi hero label="Vendas" value={money0(d.kpi.revenue.value)} cur={d.kpi.revenue.value} prev={d.kpi.revenue.prev} spark={d.kpi.revenue.spark} hint={`antes ${money0(d.kpi.revenue.prev)}`} />
            <Kpi label="Pedidos" value={num.format(d.kpi.orders.value)} cur={d.kpi.orders.value} prev={d.kpi.orders.prev} spark={d.kpi.orders.spark} />
            <Kpi label="Ticket médio" value={moneyFull(d.kpi.ticket.value)} cur={d.kpi.ticket.value} prev={d.kpi.ticket.prev} spark={d.kpi.ticket.spark} />
            <Kpi label="Conversão" value={pct(d.kpi.conv.value, 1)} cur={d.kpi.conv.value} prev={d.kpi.conv.prev} spark={d.kpi.conv.spark} hint="visita → pedido" />
            <Kpi label="Com a IA" value={pct(d.kpi.ai.value)} cur={d.kpi.ai.value} prev={d.kpi.ai.prev} spark={d.kpi.ai.spark} hint="dos pedidos usaram a ajuda" />

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
          </div>
        </section>
        )}

        {/* ========================================================== vendas */}
        {active === 'vendas' && (
        <section id="vendas" className="adm-sec" role="tabpanel" aria-labelledby="tab-vendas">
          <header className="adm-sec__head">
            <h2 id="h-vendas">{SECTIONS[1].label}</h2>
            <p>{SECTIONS[1].sub}</p>
          </header>
          <div className="adm-grid">
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

            <Card cls="adm-s4" title="Do cardápio ao pedido" sub="Onde as pessoas ficam pelo caminho.">
              <Funnel steps={d.funnel} fmt={(n) => num.format(n)} />
              <p className="adm-callout">
                Maior perda: entre <b>{biggestDrop.from.toLowerCase()}</b> e <b>{biggestDrop.to.toLowerCase()}</b> ({pct(biggestDrop.drop)}).
              </p>
            </Card>
          </div>
        </section>
        )}

        {/* ======================================================== produtos */}
        {active === 'produtos' && (
        <section id="produtos" className="adm-sec" role="tabpanel" aria-labelledby="tab-produtos">
          <header className="adm-sec__head">
            <h2 id="h-produtos">{SECTIONS[2].label}</h2>
            <p>{SECTIONS[2].sub}</p>
          </header>
          <div className="adm-grid">
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
          </div>
        </section>
        )}

        {/* ========================================================= IA e parecidos */}
        {active === 'ia' && (
        <section id="ia" className="adm-sec" role="tabpanel" aria-labelledby="tab-ia">
          <header className="adm-sec__head">
            <h2 id="h-ia">{SECTIONS[3].label}</h2>
            <p>{SECTIONS[3].sub}</p>
          </header>
          <div className="adm-grid">
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
          </div>
        </section>
        )}

        {/* ======================================================== tráfego */}
        {active === 'trafego' && (
        <section id="trafego" className="adm-sec" role="tabpanel" aria-labelledby="tab-trafego">
          <header className="adm-sec__head">
            <h2 id="h-trafego">{SECTIONS[4].label}</h2>
            <p>{SECTIONS[4].sub}</p>
          </header>
          <div className="adm-grid">
            <Card cls="adm-s7" title="Horários de pico" sub="Pedidos por dia da semana e hora. Padrão dos últimos 30 dias.">
              <Heatmap rows={d.heat.rows} hours={d.heat.hours} max={d.heat.max} />
            </Card>

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
          </div>
        </section>
        )}

        {active === 'equipe' && <Team />}
        {active === 'cardapio' && <div id="cardapio" role="tabpanel" aria-labelledby="tab-cardapio"><h2 id="h-cardapio" className="sr-only">Cardápio</h2><MenuEditor /></div>}

        {/* ======================================================== sessões */}
        {active === 'sessoes' && (
          <section id="sessoes" className="adm-sec" role="tabpanel" aria-labelledby="tab-sessoes">
            <header className="adm-sec__head">
              <h2 id="h-sessoes">{SECTIONS.find((s) => s.id === 'sessoes')!.label}</h2>
              <p>{SECTIONS.find((s) => s.id === 'sessoes')!.sub}</p>
            </header>
            <div className="adm-card adm-s12 adm-sess-card">
              <header className="adm-card__head">
                <div>
                  <h2>Conversas com a IA</h2>
                  <p>{sessions.length ? `${sessions.length} ${sessions.length === 1 ? 'conversa' : 'conversas'} · ${sessions.filter((s) => s.status === 'running').length} rodando` : 'Nenhuma ainda'}</p>
                </div>
                <button className="adm-btn adm-btn--solid" onClick={() => setChatUi({ open: true, sessionId: null })}>
                  Nova conversa
                </button>
              </header>
              <SessionsList
                sessions={sessions}
                currentId={chat.open ? chat.sessionId : null}
                onOpen={(id) => openChat(id)}
                onOpenTab={(id) => openInNewTab(id)}
                onNew={() => setChatUi({ open: true, sessionId: null })}
              />
            </div>
          </section>
        )}

        <a className="adm-back" href="/">
          Voltar ao cardápio
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 2h6v6M10 2 3 9" />
          </svg>
        </a>
      </main>
      <ChatDrawer ui={chat} />
    </div>
  )
}

/** Guia só do chat (/admin?chat=ID): a mesma sessão, sem o painel. */
function ChatOnly({ id }: { id: string }) {
  const [sid, setSid] = useState<string | null>(id)
  useEffect(() => {
    sweep()
    const t = setInterval(sweep, 2000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    const prev = document.title
    document.title = `Chat · ${cafeName}`
    return () => {
      document.title = prev
    }
  }, [])
  const change = (next: string | null) => {
    setSid(next)
    window.history.replaceState(null, '', next ? `?chat=${encodeURIComponent(next)}` : '?chat=nova')
  }
  return (
    <div className="adm adm--chat">
      <div className="adm-chat adm-chat--tab">
        <ChatPanel mode="tab" sessionId={sid} onSession={change} />
      </div>
    </div>
  )
}

export default function Admin(props: AdminProps) {
  const chatId = new URLSearchParams(window.location.search).get('chat')
  return chatId ? <ChatOnly id={chatId} /> : <Dashboard {...props} />
}


