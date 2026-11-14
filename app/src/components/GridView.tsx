import type { Category, MenuItem } from '../types'
import { fromPrice } from '../lib/format'
import { BagPlus, Close } from './Icons'
import { ProductImage } from './ProductImage'

interface Props {
  categories: Category[]
  items: MenuItem[]
  counts: Map<string, number>
  onOpen: (item: MenuItem) => void
  onAdd: (item: MenuItem) => void
  /** filtro por tag ativo (veio de um toque numa tag do detalhe) */
  filter?: { label: string; count: number } | null
  onClearFilter?: () => void
}

/** Visão "ver tudo": todas as opções de uma vez, separadas por seção. */
export function GridView({ categories, items, counts, onOpen, onAdd, filter, onClearFilter }: Props) {
  return (
    <div className="grid-view">
      {filter && (
        <div className="filter" role="status">
          <span className="filter__text">
            <strong>{filter.label}</strong> · {filter.count} {filter.count === 1 ? 'item' : 'itens'}
          </span>
          <button className="filter__clear" onClick={onClearFilter} aria-label="Limpar filtro">
            <Close size={16} /> Limpar
          </button>
        </div>
      )}
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
                    <button
                      className={`card__add ${item.available === false ? 'card__add--unavailable' : ''}`}
                      aria-label={item.available === false ? `${item.name} indisponível nesta unidade` : `Adicionar ${item.name} à sacola`}
                      disabled={item.available === false}
                      onClick={() => onAdd(item)}
                    >
                      <span className="glass card__pill">
                        {item.available === false ? 'Indisponível' : <><BagPlus size={15} /> Adicionar</>}
                      </span>
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

