import type { Category, MenuItem } from '../types'
import { fromPrice } from '../lib/format'
import { ProductImage } from './ProductImage'

interface Props {
  categories: Category[]
  items: MenuItem[]
  favorites: Set<string>
  onOpen: (item: MenuItem) => void
}

/** Visão "ver tudo": todas as opções de uma vez, separadas por seção. */
export function GridView({ categories, items, favorites, onOpen }: Props) {
  return (
    <div className="grid-view">
      {categories.map((c) => {
        const list = items.filter((i) => i.category === c.id)
        if (!list.length) return null
        return (
          <section key={c.id} id={`sec-${c.id}`} className="grid-sec" data-sec={c.id}>
            <h3 className="grid-sec__title">{c.name}</h3>
            <div className="grid">
              {list.map((item) => (
                <button key={item.id} className="card" onClick={() => onOpen(item)}>
                  <div className="card__img">
                    <ProductImage src={item.image} alt="" className="card__pimg" />
                    {favorites.has(item.id) && <span className="card__fav">♥</span>}
                  </div>
                  <span className="card__name">{item.name}</span>
                  <span className="card__price">{fromPrice(item)}</span>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
