import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { MenuItem } from '../types'
import { fromPrice } from '../lib/format'
import { track } from '../lib/track'
import { Heart, Info } from './Icons'

export interface FeedHandle {
  scrollTo: (itemId: string, smooth?: boolean) => void
}

interface Props {
  items: MenuItem[]
  categoryName: (id: string) => string
  favorites: Set<string>
  onToggleFavorite: (id: string) => void
  onDetails: (item: MenuItem) => void
  onActive: (item: MenuItem) => void
}

/** Feed vertical em tela cheia, um produto por tela, no estilo Reels. */
export const Feed = forwardRef<FeedHandle, Props>(function Feed(
  { items, categoryName, favorites, onToggleFavorite, onDetails, onActive },
  ref,
) {
  const box = useRef<HTMLDivElement>(null)
  const current = useRef<{ id: string; since: number } | null>(null)

  useImperativeHandle(ref, () => ({
    scrollTo(itemId, smooth = true) {
      const el = box.current?.querySelector<HTMLElement>(`[data-item="${itemId}"]`)
      el?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: 'start' })
    },
  }))

  // Descobre qual slide está na tela e mede quanto tempo ficou lá.
  useEffect(() => {
    const byId = new Map(items.map((i) => [i.id, i]))
    const flush = () => {
      if (current.current) {
        const ms = Date.now() - current.current.since
        if (ms > 400) track({ type: 'view', itemId: current.current.id, ms })
      }
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const id = (e.target as HTMLElement).dataset.item!
          if (current.current?.id === id) continue
          flush()
          current.current = { id, since: Date.now() }
          onActive(byId.get(id)!)
        }
      },
      { root: box.current, threshold: 0.6 },
    )
    box.current?.querySelectorAll('[data-item]').forEach((el) => io.observe(el))
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        flush()
        if (current.current) current.current.since = Date.now()
      }
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      flush()
      io.disconnect()
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [items, onActive])

  return (
    <div className="feed" ref={box}>
      {items.map((item, i) => {
        const prev = items[i - 1]
        const firstOfCat = !prev || prev.category !== item.category
        const price = fromPrice(item)
        const fav = favorites.has(item.id)
        return (
          <section key={item.id} className="slide" data-item={item.id}>
            {item.image ? (
              <img className="slide__img" src={item.image} alt={item.name} loading={i < 2 ? 'eager' : 'lazy'} />
            ) : (
              <div className="slide__img slide__img--empty" />
            )}
            <div className="slide__shade" />

            <div className="slide__body">
              <div className="slide__meta">
                {firstOfCat && <span className="slide__cat">{categoryName(item.category)}</span>}
                {item.badges?.map((b) => (
                  <span key={b} className="badge">{b}</span>
                ))}
              </div>
              <h2 className="slide__name">{item.name}</h2>
              <p className="slide__desc">{item.description}</p>
              <div className="slide__row">
                {price && <span className="price">{price}</span>}
                <button className="glass capsule" onClick={() => onDetails(item)}>
                  <Info size={16} /> Com o que se parece?
                </button>
                <button
                  className={`glass circle ${fav ? 'circle--fav' : ''}`}
                  aria-label={fav ? 'Tirar da lista' : 'Quero provar'}
                  aria-pressed={fav}
                  onClick={() => onToggleFavorite(item.id)}
                >
                  <Heart size={20} filled={fav} />
                </button>
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
})
