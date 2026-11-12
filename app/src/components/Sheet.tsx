import { useEffect, type ReactNode } from 'react'
import { Close } from './Icons'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  /** tamanho fixo, sem rolagem (o conteúdo se ajusta) */
  fixed?: boolean
  /** cabeçalho e rodapé fixos; só o miolo (.pane) rola */
  tall?: boolean
}

/** Painel que sobe de baixo, como nos apps de rede social. */
export function Sheet({ open, onClose, children, title, fixed, tall }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div className={`sheet-wrap ${open ? 'sheet-wrap--open' : ''}`} aria-hidden={!open}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        className={`sheet glass glass--thick ${fixed ? 'sheet--fixed' : ''} ${tall ? 'sheet--col' : ''}`}
        role="dialog"
        aria-label={title}
      >
        <div className="sheet__grip" />
        <button className="sheet__close glass circle circle--sm" onClick={onClose} aria-label="Fechar">
          <Close size={16} />
        </button>
        {open && children}
      </div>
    </div>
  )
}
