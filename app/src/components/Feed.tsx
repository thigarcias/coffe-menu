import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { MenuItem } from '../types'
import { nameSize, priceParts } from '../lib/format'
import { track } from '../lib/track'
import { BagPlus, Grid } from './Icons'
import { ProductImage } from './ProductImage'

export interface FeedHandle {
  scrollTo: (itemId: string, smooth?: boolean) => void
}

interface Props {
  items: MenuItem[]
  categoryName: (id: string) => string
  /** quantas unidades de cada item estão na sacola */
  counts: Map<string, number>
  onDetails: (item: MenuItem) => void
  onActive: (item: MenuItem) => void
  /** nome da categoria que o feed mostra (usado no cartão do fim) */
  categoryLabel: string
  /** a categoria do lado; quando é a última, vem a primeira (o menu fecha em círculo) */
  nextCategory: { id: string; name: string; photos: string[] } | null
  /** a próxima já é a primeira: o texto diz "voltar" em vez de "próxima" */
  wraps: boolean
  onNextCategory: () => void
  onGrid: () => void
  /** produto que guarda a faixa da dica "deslize" (o primeiro do cardápio) */
  firstId?: string
  /** o cartão do fim apareceu na tela */
  onEnd?: () => void
}

/** Feed vertical em tela cheia, um produto por tela, no estilo Reels. */
export const Feed = forwardRef<FeedHandle, Props>(function Feed(
  { items, categoryName, counts, onDetails, onActive, categoryLabel, nextCategory, wraps, onNextCategory, onGrid, firstId, onEnd },
  ref,
) {
  const box = useRef<HTMLDivElement>(null)
  const current = useRef<{ id: string; since: number } | null>(null)
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd
  const [endSeen, setEndSeen] = useState(false)

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
          if ((e.target as HTMLElement).dataset.end !== undefined) {
            flush()
            current.current = null
            setEndSeen(true)
            onEndRef.current?.()
            continue
          }
          const id = (e.target as HTMLElement).dataset.item!
          if (current.current?.id === id) continue
          flush()
          current.current = { id, since: Date.now() }
          onActive(byId.get(id)!)
        }
      },
      { root: box.current, threshold: 0.6 },
    )
    box.current?.querySelectorAll('[data-item], [data-end]').forEach((el) => io.observe(el))
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

  // fotos dos produtos que a pessoa acabou de ver, para o fim ter cara de "pronto, você passou por tudo"
  // (espalhadas pela categoria, não só as primeiras, para variar)
  const withPhoto = items.map((i) => i.image).filter((x): x is string => !!x)
  const seenPhotos = [0, Math.floor(withPhoto.length / 3), Math.floor((2 * withPhoto.length) / 3)].map((i) => withPhoto[i]).filter((x, i, a): x is string => !!x && a.indexOf(x) === i)

  return (
    <div className="feed" ref={box}>
      {items.map((item, i) => {
        const price = priceParts(item)
        const n = counts.get(item.id) ?? 0
        return (
          <section key={item.id} className="slide" data-item={item.id} data-first={item.id === firstId ? '' : undefined}>
            <ProductImage src={item.image} video={item.video} alt={item.name} eager={i < 2} className="slide__img" />
            <div className="slide__shade" />

            {/* ações sobre a foto, no canto inferior direito dela (estilo Reels) */}
            <div className="slide__actions">
              {/* um botão só: abre o detalhe, onde a pessoa entende o produto e adiciona à sacola */}
              <button className="chipbtn wantbtn" aria-label={`Eu quero ${item.name}`} onClick={() => onDetails(item)}>
                <span className="glass capsule chipbtn__pill">
                  <BagPlus size={18} />
                  <span className="chipbtn__lbl">Eu quero</span>
                  {n > 0 && <span className="count" aria-label={`${n} na sacola`}>{n}</span>}
                </span>
              </button>
            </div>

            <div className="slide__body">
              <div className="slide__meta">
                <span className="slide__cat">{categoryName(item.subcategory ?? item.category)}</span>
                {item.badges?.map((b) => (
                  <span key={b} className="badge">{b}</span>
                ))}
                {item.available === false && <span className="badge badge--unavailable">Indisponível</span>}
              </div>
              <h2 className="slide__name" data-size={nameSize(item.name) || undefined}>{item.name}</h2>
              {price && (
                <span className="price">
                  {price.label && <small>{price.label} </small>}
                  {price.value}
                </span>
              )}
              <p className="slide__desc">{item.description}</p>
            </div>
          </section>
        )
      })}

      {/* Fim da categoria: o feed não continua em outra categoria. Aqui a pessoa decide o próximo passo. */}
      <section className={`slide slide--end ${endSeen ? 'slide--end-in' : ''}`} data-end aria-label={`Fim de ${categoryLabel}`}>
        <div className="end">
          {seenPhotos.length > 0 && (
            <div className="end__stack" aria-hidden>
              {seenPhotos.map((src) => <img key={src} src={src} alt="" loading="lazy" />)}
            </div>
          )}
          <span className="end__kicker">Fim de {categoryLabel}</span>
          <h2 className="end__title">Você viu tudo em {categoryLabel}</h2>
          <p className="end__sub">{items.length === 1 ? '1 item' : `${items.length} itens`} por aqui.{nextCategory ? ' Que tal olhar outra categoria?' : ''}</p>
          {nextCategory && (
            <button className="glass end__next" onClick={onNextCategory} aria-label={wraps ? `Voltar para ${nextCategory.name}` : `Ver ${nextCategory.name}`}>
              {nextCategory.photos.length > 0 && (
                <span className="end__mini" aria-hidden>
                  {nextCategory.photos.map((src) => <img key={src} src={src} alt="" loading="lazy" />)}
                </span>
              )}
              <span className="end__nexttxt">
                <small>{wraps ? 'Voltar ao começo' : 'Próxima categoria'}</small>
                <b>{nextCategory.name}</b>
              </span>
              <span className="end__go" aria-hidden>→</span>
            </button>
          )}
          <button className="end__grid" onClick={onGrid}>
            <Grid size={16} /> Ver em grade
          </button>
        </div>
      </section>
    </div>
  )
})

