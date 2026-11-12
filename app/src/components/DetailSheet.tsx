import { useLayoutEffect, useRef, useState } from 'react'
import type { MenuItem } from '../types'
import { money, nameSize } from '../lib/format'
import { defaultChoices, optionSetOf, unitPrice } from '../lib/cart'
import { BagPlus } from './Icons'

interface Props {
  item: MenuItem
  onAdd: (item: MenuItem) => void
  storyNote?: string
  label?: string
}

const TABS = [
  { id: 'parece', label: 'Parece' },
  { id: 'ingredientes', label: 'Ingredientes' },
  { id: 'origem', label: 'Origem' },
] as const
type Tab = (typeof TABS)[number]['id']

/**
 * Detalhe do produto em tamanho fixo, sem rolagem: cada aba mostra um bloco.
 * Se um texto não couber (tela pequena, texto longo), a fonte do painel diminui
 * aos poucos até caber, sem cortar nada.
 */
export function DetailSheet({ item, onAdd, storyNote, label }: Props) {
  const [tab, setTab] = useState<Tab>('parece')
  const panel = useRef<HTMLDivElement>(null)
  const prices = item.prices.filter((p) => p.price != null)
  // o botão adiciona o padrão (Tall, café padrão, leite integral); a personalização vem depois, no aviso ou na sacola
  const base = unitPrice(item, defaultChoices(item, optionSetOf(item)))

  useLayoutEffect(() => {
    const el = panel.current
    if (!el) return
    const fit = () => {
      let scale = 1
      el.style.setProperty('--fit', '1')
      while (el.scrollHeight > el.clientHeight + 1 && scale > 0.62) {
        scale = Math.round((scale - 0.04) * 100) / 100
        el.style.setProperty('--fit', String(scale))
      }
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    document.fonts?.ready.then(fit)
    return () => ro.disconnect()
  }, [tab, item])

  return (
    <div className="detail">
      <header className="detail__head">
        {label && <span className="label">{label}</span>}
        <h3 className="detail__name" data-size={nameSize(item.name) || undefined}>{item.name}</h3>
      </header>

      <div className="seg" role="tablist" aria-label="Sobre o produto">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="detail-panel"
            className={`seg__btn ${tab === t.id ? 'seg__btn--on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="detail__panel" id="detail-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} ref={panel}>
        {tab === 'parece' && (
          <div className="lookalike">
            <span className="label">Com o que se parece</span>
            <p>{item.lookalike}</p>
          </div>
        )}

        {tab === 'ingredientes' && (
          <div className="detail__sec">
            <ul className="ingredients">
              {(item.ingredients ?? []).map((ing) => (
                <li key={ing}>{ing}</li>
              ))}
            </ul>
            {!!item.allergens?.length && <p className="allergens">Contém: {item.allergens.join(', ')}</p>}
            <p className="detail__desc">{item.description}</p>
          </div>
        )}

        {tab === 'origem' && (
          <div className="detail__sec story">
            <p>{item.story ?? 'Sem história cadastrada para este produto.'}</p>
            {storyNote && <small className="story__note">{storyNote}</small>}
          </div>
        )}
      </div>

      <footer className="detail__foot">
        {!!prices.length && (
          <div className="sizes">
            {prices.map((p) => (
              <div key={p.size} className="size">
                <span className="size__name">{p.size}</span>
                <span className="size__price">{money(p.price!)}</span>
              </div>
            ))}
          </div>
        )}
        <button className="cta" onClick={() => onAdd(item)}>
          <BagPlus size={20} /> Adicionar · {money(base)}
        </button>
      </footer>
    </div>
  )
}
