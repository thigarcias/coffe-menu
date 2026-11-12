import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Category } from '../types'

interface Props {
  categories: Category[]
  active: string | null
  onPick: (id: string) => void
}

/** Trilho de categorias em vidro, com a pílula ativa deslizando entre as opções. */
export function CategoryBar({ categories, active, onPick }: Props) {
  const track = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState({ x: 0, w: 0 })

  useLayoutEffect(() => {
    const el = track.current?.querySelector<HTMLElement>(`[data-cat="${active}"]`)
    if (el) setThumb({ x: el.offsetLeft, w: el.offsetWidth })
  }, [active, categories])

  // Mantém a pílula ativa à vista enquanto o feed rola.
  useEffect(() => {
    const box = track.current
    const el = box?.querySelector<HTMLElement>(`[data-cat="${active}"]`)
    if (box && el) {
      box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' })
    }
  }, [active])

  return (
    <nav className="cats glass" aria-label="Categorias">
      <div className="cats__track" ref={track}>
        <span className="cats__thumb" style={{ transform: `translateX(${thumb.x}px)`, width: thumb.w }} />
        {categories.map((c) => (
          <button
            key={c.id}
            data-cat={c.id}
            className={`cat ${active === c.id ? 'cat--on' : ''}`}
            aria-current={active === c.id}
            onClick={() => onPick(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>
    </nav>
  )
}
