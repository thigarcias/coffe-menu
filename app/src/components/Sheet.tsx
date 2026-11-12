import { useEffect, type ReactNode } from 'react'
import { Close } from './Icons'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
}

/** Painel que sobe de baixo, como nos apps de rede social. */
export function Sheet({ open, onClose, children, title }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div className={`sheet-wrap ${open ? 'sheet-wrap--open' : ''}`} aria-hidden={!open}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={title}>
        <div className="sheet__grip" />
        <button className="sheet__close" onClick={onClose} aria-label="Fechar">
          <Close />
        </button>
        {open && children}
      </div>
    </div>
  )
}
