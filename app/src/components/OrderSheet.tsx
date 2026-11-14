import type { Menu, MenuItem } from '../types'
import { linePrice, STAGES, summary, type Order, type Stage } from '../lib/cart'
import { money } from '../lib/format'
import { Check } from './Icons'

interface Props {
  order: Order
  stage: Stage
  menu: Menu
  byId: Map<string, MenuItem>
  onMore: () => void
}

const HINT = ['Seu pedido chegou na cozinha', 'Estamos preparando com carinho', 'Pode retirar no balcão'] as const

/** Andamento simulado do pedido: Recebido, Preparando, Pronto. */
export function OrderSheet({ order, stage, menu, byId, onMore }: Props) {
  const ready = stage === 2
  return (
    <div className="cart order">
      <header className="cart__head">
        <div>
          <span className="label">Pedido</span>
          <h3 className="quiz__title order__code">#{order.code}</h3>
        </div>
        {(order.name || order.table) && (
          <span className="cart__count">{[order.name, order.table && `mesa ${order.table}`].filter(Boolean).join(' · ')}</span>
        )}
      </header>

      <div className="pane">
        {ready && (
          <div className="ready" role="status">
            <h4>Seu pedido está pronto{order.name ? `, ${order.name}` : ''}</h4>
            <p>Pode retirar no balcão.</p>
          </div>
        )}

        <ol className="steps" aria-label="Andamento do pedido">
          {STAGES.map((label, i) => {
            const state = i < stage || (ready && i === 2) ? 'done' : i === stage ? 'now' : 'next'
            return (
              <li key={label} className={`step-row step-row--${state}`} aria-current={i === stage ? 'step' : undefined}>
                <span className="step-row__dot" aria-hidden>{state === 'done' && <Check size={14} />}</span>
                <span className="step-row__txt">
                  <strong className="step-row__label">{label}</strong>
                  <small>{HINT[i]}</small>
                </span>
              </li>
            )
          })}
        </ol>

        <ul className="recap">
          {order.lines.map((l) => {
            const item = byId.get(l.itemId)
            if (!item) return null
            const sum = summary(item, l.choices, menu)
            return (
              <li key={l.key}>
                <span>
                  {l.qty}× {item.name}
                  {sum && <small>{sum}</small>}
                  {l.note && <small>“{l.note}”</small>}
                </span>
                <span>{money(linePrice(item, l, menu))}</span>
              </li>
            )
          })}
        </ul>
      </div>

      <footer className="foot">
        <div className="foot__total">
          <span>Total</span>
          <strong>{money(order.total)}</strong>
        </div>
        {ready ? (
          <button className="cta" onClick={onMore}>Pedir mais alguma coisa?</button>
        ) : (
          <p className="quiz__note foot__note">Demonstração: o pedido não sai do seu celular.</p>
        )}
      </footer>
    </div>
  )
}

