import { useState } from 'react'
import type { Menu, MenuItem, OptionGroup } from '../types'
import { groupsOf, normalize, optionSetOf, sizesOf, unitPrice, type Choices } from '../lib/cart'
import { money } from '../lib/format'
import { Minus, Plus } from './Icons'

interface Props {
  item: MenuItem
  menu: Menu
  initial: { choices: Choices; note: string }
  /** quantas unidades esta personalização vale (para o preço do botão) */
  qty: number
  onSave: (choices: Choices, note: string) => void
}

const addLabel = (add: number) => (add > 0 ? `+ ${money(add)}` : '')

/** Painel de personalização de uma linha da sacola: tamanho, café, leite, adicionais, sem chantilly e observação. */
export function CustomizeSheet({ item, menu, initial, qty, onSave }: Props) {
  const set = optionSetOf(item, menu)
  const groups = set ? groupsOf(item, set) : []
  const [choices, setChoices] = useState<Choices>(initial.choices)
  const [note, setNote] = useState(initial.note)

  const pick = (g: OptionGroup, id: string) => setChoices((c) => ({ ...c, [g.id]: id }))
  const qtyOf = (g: OptionGroup, id: string) => {
    const v = choices[g.id]
    return typeof v === 'object' ? (v[id] ?? 0) : 0
  }
  const setQty = (g: OptionGroup, id: string, q: number) =>
    setChoices((c) => {
      const cur = typeof c[g.id] === 'object' ? (c[g.id] as Record<string, number>) : {}
      return { ...c, [g.id]: { ...cur, [id]: Math.max(0, Math.min(g.max, q)) } }
    })

  const total = Math.round(unitPrice(item, choices, menu) * qty * 100) / 100

  return (
    <div className="custom">
      <header className="custom__head">
        {set && <span className="label">{set.name}</span>}
        <h3 className="detail__name" data-size={item.name.length > 36 ? 'xl' : item.name.length > 18 ? 'l' : undefined}>
          {item.name}
        </h3>
      </header>

      <div className="pane">
        {groups.map((g) => (
          <section key={g.id} className="group" aria-label={g.name}>
            <span className="label">{g.name}</span>

            {g.kind === 'size' && (
              <div className="picks picks--cols" role="radiogroup" aria-label={g.name}>
                {sizesOf(item).map((p) => (
                  <button
                    key={p.size}
                    role="radio"
                    aria-checked={choices[g.id] === p.size}
                    className={`pick pick--col ${choices[g.id] === p.size ? 'pick--on' : ''}`}
                    onClick={() => pick(g, p.size)}
                  >
                    <span className="pick__name">{p.size}</span>
                    {p.ml ? <span className="pick__ml">{p.ml}ml</span> : null}
                    <span className="pick__price">{money(p.price!)}</span>
                  </button>
                ))}
              </div>
            )}

            {g.kind === 'single' && (
              <div className="picks" role="radiogroup" aria-label={g.name}>
                {g.options.map((o) => (
                  <button
                    key={o.id}
                    role="radio"
                    aria-checked={choices[g.id] === o.id}
                    className={`pick pick--row ${choices[g.id] === o.id ? 'pick--on' : ''}`}
                    onClick={() => pick(g, o.id)}
                  >
                    <span className="pick__name">{o.name}</span>
                    <span className="pick__add">{addLabel(o.add)}</span>
                  </button>
                ))}
              </div>
            )}

            {g.kind === 'extras' && (
              <div className="picks">
                {g.options.map((o) => {
                  const q = qtyOf(g, o.id)
                  return (
                    <div key={o.id} className={`pick pick--extra ${q ? 'pick--on' : ''}`}>
                      <span className="pick__name">
                        {o.name}
                        <small>{addLabel(o.add)}</small>
                      </span>
                      <div className="stepper">
                        <button className="step" aria-label={`Menos ${o.name}`} disabled={!q} onClick={() => setQty(g, o.id, q - 1)}>
                          <Minus size={16} />
                        </button>
                        <span className="stepper__n" aria-live="polite">{q}</span>
                        <button className="step" aria-label={`Mais ${o.name}`} disabled={q >= g.max} onClick={() => setQty(g, o.id, q + 1)}>
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {g.kind === 'toggle' && (
              <div className="picks">
                {g.options.map((o) => {
                  const on = qtyOf(g, o.id) > 0
                  return (
                    <button
                      key={o.id}
                      role="switch"
                      aria-checked={on}
                      className={`pick pick--row ${on ? 'pick--on' : ''}`}
                      onClick={() => setQty(g, o.id, on ? 0 : 1)}
                    >
                      <span className="pick__name">{o.name}</span>
                      <span className={`switch ${on ? 'switch--on' : ''}`} aria-hidden />
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        ))}

        <label className="group free" htmlFor="custom-note">
          <span className="label">Observação (opcional)</span>
          <input
            id="custom-note"
            type="text"
            maxLength={80}
            placeholder="Ex.: sem gelo, bem quente"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>

      <footer className="foot">
        <button className="cta" onClick={() => onSave(normalize(choices), note)}>
          Salvar · {money(total)}
        </button>
      </footer>
    </div>
  )
}

