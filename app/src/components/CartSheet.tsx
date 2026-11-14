import { useEffect, useState } from 'react'
import type { Menu, MenuItem, OrderBy } from '../types'
import {
  allergensOf,
  cartCount,
  cartTotal,
  linePrice,
  loadName,
  saveName,
  STAGES,
  summary,
  tableFromUrl,
  type CartLine,
  type Order,
  type Stage,
} from '../lib/cart'
import { money } from '../lib/format'
import { Bag, Minus, Pencil, Plus, Trash } from './Icons'

interface Props {
  reviewAllergens?: boolean
  lines: CartLine[]
  byId: Map<string, MenuItem>
  menu: Menu
  scope: string
  orderBy: OrderBy
  /** pedido em andamento (aparece como um aviso no topo) */
  order: Order | null
  stage: Stage | null
  onQty: (key: string, delta: number) => void
  onRemove: (key: string) => void
  onEdit: (key: string) => void
  onOpenItem: (item: MenuItem) => void
  onOpenOrder: () => void
  onCheckout: () => void
  onSend: (name: string, table: string) => void
}

/** A sacola e o fechamento do pedido (nome ou mesa, aviso de alérgeno, envio). */
export function CartSheet({ lines, byId, menu, scope, reviewAllergens = false, orderBy, order, stage, onQty, onRemove, onEdit, onOpenItem, onOpenOrder, onCheckout, onSend }: Props) {
  const [step, setStep] = useState<'bag' | 'checkout'>('bag')
  const [name, setName] = useState(() => loadName(scope))
  const [table, setTable] = useState(tableFromUrl)

  useEffect(() => setName(loadName(scope)), [scope])

  const total = cartTotal(lines, byId, menu)
  const count = cartCount(lines)
  const allergens = allergensOf(lines, byId)
  const unavailable = lines.filter((line) => byId.get(line.itemId)?.available === false)
  const hasUnavailable = unavailable.length > 0
  const hasUnverifiedAllergens = lines.some((line) => !byId.get(line.itemId)?.allergensVerified)
  const needName = orderBy !== 'mesa'
  const needTable = orderBy !== 'nome'
  const ready = !hasUnavailable && (!needName || name.trim().length > 0) && (!needTable || table.trim().length > 0)

  if (step === 'checkout' && lines.length) {
    return (
      <div className="cart">
        <header className="cart__head">
          <h3 className="quiz__title">Fechar o pedido</h3>
        </header>
        <div className="pane">
          <ul className="recap">
            {lines.map((l) => {
              const item = byId.get(l.itemId)!
              return (
                <li key={l.key}>
                  <span>
                    {l.qty}× {item.name}
                    {item.available === false && <small>Indisponível nesta unidade</small>}
                  </span>
                  <span>{money(linePrice(item, l, menu))}</span>
                </li>
              )
            })}
          </ul>

          {needName && (
            <label className="group free" htmlFor="order-name">
              <span className="label">Seu nome</span>
              <input
                id="order-name"
                type="text"
                autoComplete="given-name"
                maxLength={30}
                placeholder="Como devemos te chamar?"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          {needTable && (
            <label className="group free" htmlFor="order-table">
              <span className="label">Mesa</span>
              <input
                id="order-table"
                type="text"
                inputMode="numeric"
                maxLength={12}
                placeholder="Número da mesa"
                value={table}
                onChange={(e) => setTable(e.target.value)}
              />
            </label>
          )}

          {hasUnavailable && <p className="alert" role="alert">Remova os itens indisponíveis antes de enviar o pedido.</p>}
          {reviewAllergens ? <p className="alert" role="note">
            {allergens.length > 0
              ? `${hasUnverifiedAllergens ? 'Alérgenos informados (não verificados)' : 'Alérgenos registrados'}: ${allergens.join(', ')}. `
              : 'O cardápio não informa alérgenos para estes itens. '}
            A informação pode estar incompleta e não garante ausência de ingredientes ou traços. Confirme com a equipe.
          </p> : allergens.length > 0 && <p className="alert" role="note">Contém {allergens.join(', ')}. Confirme com a equipe.</p>}
        </div>
        <footer className="foot">
          <div className="foot__total">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
          <button
            className="cta"
            disabled={!ready}
            onClick={() => {
              saveName(name.trim(), scope)
              onSend(name.trim(), table.trim())
            }}
          >
            Enviar pedido · {money(total)}
          </button>
          <button className="link" onClick={() => setStep('bag')}>Voltar para a sacola</button>
        </footer>
      </div>
    )
  }

  return (
    <div className="cart">
      <header className="cart__head">
        <h3 className="quiz__title">Sua sacola</h3>
        {count > 0 && <span className="cart__count">{count} {count === 1 ? 'item' : 'itens'}</span>}
      </header>

      <div className="pane">
        {order && stage != null && (
          <button className="banner" onClick={onOpenOrder}>
            <span className="banner__dot" aria-hidden />
            <span>Pedido #{order.code} · {STAGES[stage]}{stage < 2 ? '…' : ''}</span>
            <span aria-hidden>›</span>
          </button>
        )}

        {!lines.length && (
          <div className="empty">
            <Bag size={30} />
            <p className="quiz__empty">Sua sacola está vazia. Toque na sacola com + de um produto para adicioná-lo.</p>
          </div>
        )}

        <ul className="bag">
          {lines.map((l) => {
            const item = byId.get(l.itemId)!
            const sum = summary(item, l.choices, menu)
            return (
              <li key={l.key} className="bagrow">
                <button className="bagrow__main" onClick={() => onOpenItem(item)}>
                  <div className="sug__img sug__img--sm">{item.image && <img src={item.image} alt="" />}</div>
                  <div className="bagrow__txt">
                    <strong>{item.name}</strong>
                    {sum && <span className="bagrow__sum">{sum}</span>}
                    {item.available === false && <span className="bagrow__unavailable">Indisponível nesta unidade</span>}
                    {l.note && <span className="bagrow__note">“{l.note}”</span>}
                  </div>
                </button>
                <span className="bagrow__price">{money(linePrice(item, l, menu))}</span>
                <div className="bagrow__act">
                  <button className="tool" disabled={item.available === false} onClick={() => onEdit(l.key)} aria-label={`Editar ${item.name}`}>
                    <Pencil size={15} /> Editar
                  </button>
                  <button className="tool tool--warn" onClick={() => onRemove(l.key)} aria-label={`Remover ${item.name}`}>
                    <Trash size={15} /> Remover
                  </button>
                  <div className="stepper">
                    <button className="step" aria-label={`Menos ${item.name}`} disabled={l.qty <= 1} onClick={() => onQty(l.key, -1)}>
                      <Minus size={16} />
                    </button>
                    <span className="stepper__n" aria-label={`Quantidade: ${l.qty}`}>{l.qty}</span>
                    <button className="step" aria-label={`Mais ${item.name}`} disabled={l.qty >= 20 || item.available === false} onClick={() => onQty(l.key, 1)}>
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {lines.length > 0 && (
        <footer className="foot">
          <div className="foot__total">
            <span>Subtotal</span>
            <strong>{money(total)}</strong>
          </div>
          <button
            className="cta"
            disabled={hasUnavailable}
            onClick={() => {
              onCheckout()
              setStep('checkout')
            }}
          >
            Continuar
          </button>
        </footer>
      )}
    </div>
  )
}

