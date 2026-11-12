import { useEffect } from 'react'

export interface ToastData {
  id: number
  title: string
  text?: string
  actions: { label: string; primary?: boolean; onClick: () => void }[]
}

interface Props {
  toast: ToastData | null
  onClose: () => void
  /** em cima, sob as categorias (sobre a foto, sem tapar os botões do produto); senão, embaixo, para quando há um painel aberto */
  top: boolean
}

/** Aviso curto ("Adicionado à sacola"), com ações e fechamento sozinho. */
export function Toast({ toast, onClose, top }: Props) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [toast, onClose])

  if (!toast) return null
  return (
    <div className={`toast glass glass--thick ${top ? 'toast--top' : ''}`} role="status" aria-live="polite" key={toast.id}>
      <div className="toast__txt">
        <strong>{toast.title}</strong>
        {toast.text && <span>{toast.text}</span>}
      </div>
      <div className="toast__actions">
        {toast.actions.map((a) => (
          <button
            key={a.label}
            className={`toast__btn ${a.primary ? 'toast__btn--primary' : ''}`}
            onClick={() => {
              a.onClick()
              onClose()
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  )
}
