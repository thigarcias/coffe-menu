import type { Category, MenuItem } from '../types'
import { fromPrice } from '../lib/format'
import { BagPlus } from './Icons'
import { ProductImage } from './ProductImage'

interface Props {
  categories: Category[]
  items: MenuItem[]
  counts: Map<string, number>
  onOpen: (item: MenuItem) => void
  onAdd: (item: MenuItem) => void
}

/** Visão "ver tudo": todas as opções de uma vez, separadas por seção. */
export function GridView({ categories, items, counts, onOpen, onAdd }: Props) {
  return (
    <div className="grid-view">
      {categories.map((c) => {
        const list = items.filter((i) => i.category === c.id)
        if (!list.length) return null
        return (
          <section key={c.id} id={`sec-${c.id}`} className="grid-sec" data-sec={c.id}>
            <h3 className="grid-sec__title">{c.name}</h3>
            <div className="grid">
              {list.map((item) => {
                const n = counts.get(item.id) ?? 0
                return (
                  <div key={item.id} className="card">
                    <button className="card__open" onClick={() => onOpen(item)}>
                      <div className="card__img">
                        <ProductImage src={item.image} alt="" className="card__pimg" />
                      </div>
                      <span className="card__name">{item.name}</span>
                      <span className="card__price">{fromPrice(item)}</span>
                    </button>
                    <button className="glass circle circle--bag card__add" aria-label={`Adicionar ${item.name} à sacola`} onClick={() => onAdd(item)}>
                      <BagPlus size={22} />
                      {n > 0 && <span className="count" aria-label={`${n} na sacola`}>{n}</span>}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
