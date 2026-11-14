import { useEffect, useMemo, useRef, useState } from 'react'
import { build, cafeName, PERIODS, type Period } from './mock'
import { isDashSection } from './layout/model'
import { SectionView } from './layout/SectionView'
import { useLayouts } from './layout/useLayouts'
import type { WidgetCtx } from './layout/widgets'
import { ChatDrawer, ChatPanel, Icon, openInNewTab } from './chat/ChatPanel'
import { sweep } from './chat/runner'
import { SessionsList } from './chat/SessionsList'
import { setChatUi, useChatUi, useSessions } from './chat/store'
import './admin.css'
import { Team } from './Team'
import { MenuEditor } from './MenuEditor'

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
// o menu lateral agrupa as cinco seções de dados sob "Dashboard"; o resto fica solto
const DASH_IDS = ['visao', 'vendas', 'produtos', 'ia', 'trafego'] as const
const SIDE_LINKS = ['cardapio', 'equipe', 'sessoes'] as const
const sectionLabel = (id: SectionId) => SECTIONS.find((x) => x.id === id)!.label

const fromHash = (): SectionId => SECTIONS.find((s) => s.id === window.location.hash.slice(1))?.id ?? 'visao'

type AdminProps = { onSignOut: () => void; signingOut: boolean }

function Dashboard({ onSignOut, signingOut }: AdminProps) {
  const [period, setPeriod] = useState<Period>('7d')
  const d = useMemo(() => build(period), [period])
  const [showTable, setShowTable] = useState(false)
  // o painel é uma página de abas: cada item do menu mostra só a sua seção
  const [active, setActive] = useState<SectionId>(fromHash)
  const rootRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dashOpen, setDashOpen] = useState(true)
  const menuBtnRef = useRef<HTMLButtonElement>(null)

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

  // entrar numa seção do Dashboard abre o grupo
  useEffect(() => {
    if (DASH_IDS.includes(active as (typeof DASH_IDS)[number])) setDashOpen(true)
  }, [active])
  // no celular o menu é uma gaveta: Esc fecha e devolve o foco ao botão "Menu"
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        menuBtnRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const go = (id: SectionId) => {
    setActive(id)
    setMenuOpen(false)
    rootRef.current?.scrollTo({ top: 0 }) // a seção nova começa do alto
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

  const periodName = PERIODS.find((p) => p.id === period)!
  const layouts = useLayouts()
  const ctx: WidgetCtx = { d, period, periodName, showTable, setShowTable }

  return (
    <div className="adm" ref={rootRef}>
      <header className="adm-top">
        <div className="adm-top__inner">
          <button
            ref={menuBtnRef}
            type="button"
            className="adm-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="adm-side"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            Menu
          </button>
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
          <div className="adm-top__actions">
            <button className="adm-ask" onClick={() => openChat()} aria-expanded={chat.open} aria-haspopup="dialog">
              <Icon d="spark" />
              Perguntar<span className="adm-ask__more"> à IA</span>
              {sessions.some((s) => s.status === 'running') && <span className="sr-only"> (há uma conversa rodando)</span>}
            </button>
          </div>
        </div>
      </header>

      <div className="adm-shell">
        {menuOpen && <div className="adm-side-scrim" onClick={() => setMenuOpen(false)} aria-hidden />}
        <aside id="adm-side" className={menuOpen ? 'adm-side is-open' : 'adm-side'}>
          <nav aria-label="Seções do painel">
            <div className="adm-side__group">
              <button
                type="button"
                className={'adm-side__item adm-side__item--group' + (DASH_IDS.includes(active as (typeof DASH_IDS)[number]) ? ' has-active' : '')}
                aria-expanded={dashOpen}
                aria-controls="adm-side-dash"
                onClick={() => setDashOpen((o) => !o)}
              >
                <Icon d="chart" />
                <span>Dashboard</span>
                <svg className="adm-side__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <ul id="adm-side-dash" hidden={!dashOpen}>
                {DASH_IDS.map((id) => (
                  <li key={id}>
                    <button type="button" className={'adm-side__item adm-side__item--sub' + (id === active ? ' is-on' : '')} aria-current={id === active ? 'page' : undefined} onClick={() => go(id)}>
                      {sectionLabel(id)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <ul className="adm-side__links">
              {SIDE_LINKS.map((id) => (
                <li key={id}>
                  <button type="button" className={'adm-side__item' + (id === active ? ' is-on' : '')} aria-current={id === active ? 'page' : undefined} onClick={() => go(id)}>
                    <Icon d={id === 'cardapio' ? 'menu' : id === 'equipe' ? 'team' : 'chat'} />
                    <span>{id === 'cardapio' ? 'Personalizar cardápio' : sectionLabel(id)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="adm-side__foot">
            <a className="adm-side__item" href="/">
              <span>Ver cardápio</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 2h6v6M10 2 3 9" />
              </svg>
            </a>
            <button className="adm-side__item adm-signout" type="button" disabled={signingOut} onClick={onSignOut}>Sair</button>
          </div>
        </aside>
        <div className="adm-content">
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

        {/* ===== seções de dados: cada uma desenha o seu layout (padrão ou personalizado) ===== */}
        {isDashSection(active) && (
          <SectionView key={active} section={active} label={sectionLabel(active)} sub={SECTIONS.find((s) => s.id === active)!.sub} layouts={layouts} ctx={ctx} />
        )}

        {active === 'equipe' && <Team />}
        {active === 'cardapio' && <div id="cardapio"  role="region" aria-labelledby="h-cardapio"><h2 id="h-cardapio" className="sr-only">Cardápio</h2><MenuEditor /></div>}

        {/* ======================================================== sessões */}
        {active === 'sessoes' && (
          <section id="sessoes" className="adm-sec"  role="region" aria-labelledby="h-sessoes">
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
        </div>
      </div>
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


