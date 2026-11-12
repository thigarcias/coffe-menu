import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { MenuItem } from '../types'
import { nameSize, priceParts } from '../lib/format'
import { track } from '../lib/track'
import { BagPlus, Info } from './Icons'
import { ProductImage } from './ProductImage'

export interface FeedHandle {
  scrollTo: (itemId: string, smooth?: boolean) => void
}

interface Props {
  items: MenuItem[]
  categoryName: (id: string) => string
  /** quantas unidades de cada item estão na sacola */
  counts: Map<string, number>
  onAdd: (item: MenuItem) => void
  onDetails: (item: MenuItem) => void
  onActive: (item: MenuItem) => void
}

/** Feed vertical em tela cheia, um produto por tela, no estilo Reels. */
export const Feed = forwardRef<FeedHandle, Props>(function Feed(
  { items, categoryName, counts, onAdd, onDetails, onActive },
  ref,
) {
  const box = useRef<HTMLDivElement>(null)
  const current = useRef<{ id: string; since: number } | null>(null)

  useImperativeHandle(ref, () => ({
    // Rola o próprio feed até o slide (sem scrollIntoView, que no Safari ignora
    // 'instant' e pode mexer em outros contêineres).
    scrollTo(itemId, smooth = true) {
      const feed = box.current
      const el = feed?.querySelector<HTMLElement>(`[data-item="${itemId}"]`)
      if (feed && el) feed.scrollTo({ top: el.offsetTop, behavior: smooth ? 'smooth' : 'auto' })
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
        const price = priceParts(item)
        const n = counts.get(item.id) ?? 0
        return (
          <section key={item.id} className="slide" data-item={item.id}>
            <ProductImage src={item.image} alt={item.name} eager={i < 2} className="slide__img" />
            <div className="slide__shade" />

            <div className="slide__body">
              <div className="slide__meta">
                <span className="slide__cat">{categoryName(item.subcategory ?? item.category)}</span>
                {item.badges?.map((b) => (
                  <span key={b} className="badge">{b}</span>
                ))}
              </div>
              <h2 className="slide__name" data-size={nameSize(item.name) || undefined}>{item.name}</h2>
              {price && (
                <span className="price">
                  {price.label && <small>{price.label} </small>}
                  {price.value}
                </span>
              )}
              <p className="slide__desc">{item.description}</p>
              <div className="slide__row">
                <button className="glass capsule" onClick={() => onDetails(item)}>
                  <Info size={16} /> Com o que se parece?
                </button>
                <button className="glass circle circle--bag" aria-label={`Adicionar ${item.name} à sacola`} onClick={() => onAdd(item)}>
                  <BagPlus size={22} />
                  {n > 0 && <span className="count" aria-label={`${n} na sacola`}>{n}</span>}
                </button>
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
})
