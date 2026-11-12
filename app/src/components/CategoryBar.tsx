import { useEffect, useRef } from 'react'
import type { Category } from '../types'

interface Props {
  categories: Category[]
  active: string | null
  onPick: (id: string) => void
}

export function CategoryBar({ categories, active, onPick }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // Mantém a pílula ativa visível enquanto o feed rola.
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-cat="${active}"]`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [active])

  return (
    <div className="cats" ref={ref}>
      {categories.map((c) => (
        <button
          key={c.id}
          data-cat={c.id}
          className={`pill ${active === c.id ? 'pill--on' : ''}`}
          onClick={() => onPick(c.id)}
        >
          {c.name}
        </button>
      ))}
    </div>
  )
}
