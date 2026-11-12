import type { MenuItem } from '../types'
import { money } from '../lib/format'
import { Heart } from './Icons'

interface Props {
  item: MenuItem
  fav: boolean
  onToggleFavorite: (id: string) => void
}

export function DetailSheet({ item, fav, onToggleFavorite }: Props) {
  const prices = item.prices.filter((p) => p.price != null)
  return (
    <div className="detail">
      <h3 className="detail__name">{item.name}</h3>

      <div className="lookalike">
        <span className="lookalike__label">Com o que se parece</span>
        <p>{item.lookalike}</p>
      </div>

      <p className="detail__desc">{item.description}</p>

      {!!prices.length && (
        <div className="sizes">
          {prices.map((p) => (
            <div key={p.size} className="size">
              <span className="size__name">{p.size}</span>
              {p.ml ? <span className="size__ml">{p.ml} ml</span> : null}
              <span className="size__price">{money(p.price!)}</span>
            </div>
          ))}
        </div>
      )}

      {!!item.allergens?.length && (
        <p className="allergens">Contém: {item.allergens.join(', ')}</p>
      )}

      <button className={`cta ${fav ? 'cta--ghost' : ''}`} onClick={() => onToggleFavorite(item.id)}>
        <Heart size={18} filled={fav} /> {fav ? 'Está na sua lista' : 'Quero provar'}
      </button>
    </div>
  )
}
