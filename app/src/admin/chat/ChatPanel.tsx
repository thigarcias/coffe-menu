import { useEffect, useRef, useState } from 'react'
import { SUGGESTIONS } from './assistant'
import { BlockView } from './Blocks'
import { resume, send, stop } from './runner'
import { SessionsList } from './SessionsList'
import { createSession, setChatUi, useSession, useSessions } from './store'
import './chat.css'

export type PanelMode = 'side' | 'full' | 'tab'

const I = {
  sessions: <path d="M4 6h16M4 12h16M4 18h10" />,
  plus: <path d="M12 5v14M5 12h14" />,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  shrink: <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
  tab: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  back: <path d="M15 5l-7 7 7 7" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  menu: <path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3" />,
  team: <path d="M16 20v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1a4 4 0 0 0-3-3.9M15 4.2a3.5 3.5 0 0 1 0 6.6" />,
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />,
  spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />,
}
const Icon = ({ d }: { d: keyof typeof I }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {I[d]}
  </svg>
)
export { Icon }

export function openInNewTab(id: string | null) {
  const sid = id ?? createSession().id
  window.open(`${window.location.pathname}?chat=${encodeURIComponent(sid)}`, '_blank', 'noopener')
}

interface Props {
  mode: PanelMode
  sessionId: string | null
  onSession: (id: string | null) => void
  onClose?: () => void
}

/** O chat. Serve para o painel lateral, a tela cheia e a guia só do chat: só muda o contêiner. */
export function ChatPanel({ mode, sessionId, onSession, onClose }: Props) {
  const session = useSession(sessionId)
  const sessions = useSessions()
  const [view, setView] = useState<'chat' | 'list'>('chat')
  const [text, setText] = useState('')
  const log = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const running = session?.status === 'running'
  const messages = session?.messages ?? []

  // sempre mostra o fim da conversa enquanto a resposta vai chegando
  const tail = messages[messages.length - 1]
  useEffect(() => {
    const el = log.current
    // conversa vazia fica no alto (o título e as sugestões); com mensagens, mostra o fim
    if (el) el.scrollTop = messages.length ? el.scrollHeight : 0
  }, [messages.length, tail?.blocks.length, tail?.status, view])

  useEffect(() => {
    if (view === 'chat') input.current?.focus()
  }, [view, sessionId])

  const submit = (t = text) => {
    const q = t.trim()
    if (!q || running) return
    const id = send(sessionId, q)
    if (id !== sessionId) onSession(id)
    setText('')
  }

  const toolbar = (
    <div className="adm-chat__tools">
      <button className="adm-tool" onClick={() => setView(view === 'list' ? 'chat' : 'list')} aria-pressed={view === 'list'}>
        <Icon d="sessions" />
        Sessões
        {sessions.some((s) => s.status === 'running') && <i className="adm-tool__dot" aria-label="há conversas rodando" />}
      </button>
      <button
        className="adm-tool"
        onClick={() => {
          onSession(null)
          setView('chat')
        }}
      >
        <Icon d="plus" />
        Nova conversa
      </button>
      {mode !== 'tab' && (
        <button className="adm-tool adm-tool--wide" onClick={() => setChatUi({ mode: mode === 'full' ? 'side' : 'full' })}>
          <Icon d={mode === 'full' ? 'shrink' : 'expand'} />
          {mode === 'full' ? 'Reduzir' : 'Tela cheia'}
        </button>
      )}
      {mode !== 'tab' && (
        <button className="adm-tool" onClick={() => openInNewTab(sessionId)}>
          <Icon d="tab" />
          Nova guia
        </button>
      )}
    </div>
  )

  return (
    <div className="adm-chat__panel">
      <header className="adm-chat__head">
        <div className="adm-chat__title">
          <span className="adm-chat__logo" aria-hidden>
            <Icon d="spark" />
          </span>
          <div>
            <h2>{view === 'list' ? 'Sessões' : (session?.title ?? 'Nova conversa')}</h2>
            <p>{view === 'list' ? 'Continuam rodando com o chat fechado' : 'IA do painel · dados de exemplo'}</p>
          </div>
        </div>
        {mode === 'tab' ? (
          <a className="adm-tool" href={window.location.pathname}>
            <Icon d="back" />
            Voltar ao painel
          </a>
        ) : (
          <button className="adm-chat__x" onClick={onClose} aria-label="Fechar chat">
            <Icon d="close" />
          </button>
        )}
      </header>
      {toolbar}

      {view === 'list' ? (
        <div className="adm-chat__log" ref={log}>
          <SessionsList
            sessions={sessions}
            currentId={sessionId}
            onOpen={(id) => {
              onSession(id)
              setView('chat')
            }}
            onOpenTab={(id) => openInNewTab(id)}
            onNew={() => {
              onSession(null)
              setView('chat')
            }}
          />
        </div>
      ) : (
        <div className="adm-chat__log" ref={log} role="log" aria-live="polite" aria-label="Conversa">
          {!messages.length && (
            <div className="adm-chat__hello">
              <h3>O que você quer ver?</h3>
              <p>Peça um gráfico ou uma pergunta sobre as vendas. A IA monta a resposta com os dados do painel.</p>
              <div className="adm-chat__sugg">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => submit(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="adm-msg adm-msg--user">
                {m.blocks[0]?.type === 'text' ? m.blocks[0].text : ''}
              </div>
            ) : (
              <div key={m.id} className="adm-msg adm-msg--assistant" data-state={m.state}>
                {m.blocks.map((b, i) => (
                  <BlockView key={i} block={b} onAsk={running ? undefined : (q) => submit(q)} />
                ))}
                {m.state === 'streaming' && (
                  <p className="adm-chat__status" role="status">
                    <i aria-hidden />
                    {m.status ?? 'Pensando…'}
                  </p>
                )}
                {m.state === 'stopped' && <p className="adm-chat__note">Você parou esta resposta.</p>}
                {m.state === 'error' && (
                  <p className="adm-chat__note adm-chat__note--warn" role="alert">
                    {m.error ?? 'Não consegui terminar esta resposta.'}
                  </p>
                )}
              </div>
            ),
          )}
          {session?.status === 'interrupted' && (
            <div className="adm-chat__banner" role="alert">
              <p>
                <b>Resposta interrompida.</b> A guia que estava gerando foi fechada.
              </p>
              <button className="adm-btn adm-btn--solid" onClick={() => session && resume(session.id)}>
                Retomar
              </button>
            </div>
          )}
        </div>
      )}

      {view === 'chat' && (
        <form
          className="adm-chat__composer"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <textarea
            ref={input}
            rows={1}
            value={text}
            placeholder={running ? 'A IA está respondendo…' : 'Pergunte à IA…'}
            aria-label="Pergunta para a IA"
            disabled={running}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
          />
          {running ? (
            <button type="button" className="adm-btn adm-btn--ghost" onClick={() => session && stop(session.id)}>
              Parar
            </button>
          ) : (
            <button type="submit" className="adm-btn adm-btn--solid" disabled={!text.trim()}>
              Enviar
            </button>
          )}
        </form>
      )}
    </div>
  )
}

/** Painel lateral (ou tela cheia) por cima do painel. Fica montado só quando aberto, mas a conversa nunca depende dele. */
export function ChatDrawer({ ui }: { ui: { open: boolean; mode: 'side' | 'full'; sessionId: string | null } }) {
  useEffect(() => {
    if (!ui.open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setChatUi({ open: false })
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ui.open])
  if (!ui.open) return null
  return (
    <>
      <div className="adm-scrim" onClick={() => setChatUi({ open: false })} aria-hidden />
      <aside className={`adm-chat adm-chat--${ui.mode}`} role="dialog" aria-label="Chat com a IA">
        <ChatPanel mode={ui.mode} sessionId={ui.sessionId} onSession={(id) => setChatUi({ sessionId: id })} onClose={() => setChatUi({ open: false })} />
      </aside>
    </>
  )
}
