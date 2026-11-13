import type { Session } from './types'

const STATUS: Record<Session['status'], string> = { idle: 'Concluída', running: 'Rodando', interrupted: 'Interrompida', error: 'Erro' }

export function ago(ms: number) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (s < 10) return 'agora'
  if (s < 60) return `há ${s} s`
  const m = Math.round(s / 60)
  if (m < 60) return `há ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `há ${h} h`
  return `há ${Math.round(h / 24)} d`
}

function snippet(s: Session) {
  const last = [...s.messages].reverse().find((m) => m.role === 'assistant')
  const t = last?.blocks.find((b) => b.type === 'text')
  if (t && t.type === 'text') return t.text.replace(/\*\*/g, '')
  if (last?.status) return last.status
  const u = s.messages.find((m) => m.role === 'user')
  return u?.blocks[0]?.type === 'text' ? u.blocks[0].text : 'Sem mensagens ainda'
}

export function SessionsList({
  sessions,
  currentId,
  onOpen,
  onOpenTab,
  onNew,
}: {
  sessions: Session[]
  currentId?: string | null
  onOpen: (id: string) => void
  onOpenTab: (id: string) => void
  onNew: () => void
}) {
  if (!sessions.length)
    return (
      <div className="adm-sess__empty">
        <p>Nenhuma conversa ainda. Pergunte algo à IA e ela aparece aqui, rodando ou concluída.</p>
        <button className="adm-btn adm-btn--solid" onClick={onNew}>
          Começar uma conversa
        </button>
      </div>
    )
  return (
    <ul className="adm-sess">
      {sessions.map((s) => (
        <li key={s.id} className={`adm-sess__row${s.id === currentId ? ' is-current' : ''}`} data-session={s.id}>
          <button className="adm-sess__main" onClick={() => onOpen(s.id)} aria-label={`Abrir conversa: ${s.title}`}>
            <span className="adm-sess__top">
              <b>{s.title}</b>
              <span className={`adm-chip adm-chip--${s.status}`}>{s.status === 'running' && <i aria-hidden />}{STATUS[s.status]}</span>
            </span>
            <span className="adm-sess__snip">{snippet(s)}</span>
            <small>
              {(() => {
                const n = s.messages.filter((m) => m.role === 'user').length
                return `${n} ${n === 1 ? 'pergunta' : 'perguntas'}`
              })()}{' '}
              · {ago(s.updatedAt)}
            </small>
          </button>
          <button className="adm-sess__tab" onClick={() => onOpenTab(s.id)} aria-label={`Abrir em nova guia: ${s.title}`}>
            Nova guia
          </button>
        </li>
      ))}
    </ul>
  )
}
