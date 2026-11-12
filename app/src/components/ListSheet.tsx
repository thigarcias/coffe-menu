import type { MenuItem } from '../types'
import { fromPrice } from '../lib/format'

interface Props {
  items: MenuItem[]
  onOpen: (item: MenuItem) => void
  onRemove: (id: string) => void
}

/** "Quero provar": a lista que o cliente mostra no balcão. */
export function ListSheet({ items, onOpen, onRemove }: Props) {
  return (
    <div className="mylist">
      <h3 className="quiz__title">Quero provar</h3>
      {!items.length && <p className="quiz__empty">Toque no ♥ de um produto para guardar aqui e mostrar no balcão.</p>}
      {items.map((item) => (
        <div key={item.id} className="mylist__row">
          <button className="mylist__main" onClick={() => onOpen(item)}>
            <div className="sug__img">{item.image && <img src={item.image} alt="" />}</div>
            <div className="sug__txt">
              <strong>{item.name}</strong>
              <span className="sug__meta">{fromPrice(item)}</span>
            </div>
          </button>
          <button className="link" onClick={() => onRemove(item.id)}>Tirar</button>
        </div>
      ))}
    </div>
  )
}
