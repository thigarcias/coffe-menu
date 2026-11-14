import type { ReactNode } from 'react'
import type { MenuItem } from '../../types'
import { Sparkline } from '../charts'

export const num = new Intl.NumberFormat('pt-BR')
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const pct = (v: number, d = 0) => `${(v * 100).toFixed(d).replace('.', ',')}%`
export const money0 = (v: number) => `R$ ${num.format(Math.round(v))}`
export const moneyFull = (v: number) => brl.format(v)
export const compact = (v: number) => (v >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `R$ ${Math.round(v)}`)
export const axisMoney = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(v))

export function Thumb({ item }: { item: MenuItem }) {
  return item.image ? (
    <img className="adm-thumb" src={`${import.meta.env.BASE_URL}${item.image}`} alt="" loading="lazy" />
  ) : (
    <span className="adm-thumb" />
  )
}

export function Card({ cls, title, sub, children, aside }: { cls: string; title: string; sub?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className={`adm-card ${cls}`}>
      <header className="adm-card__head">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  )
}

function Delta({ cur, prev, inverse }: { cur: number; prev: number; inverse?: boolean }) {
  const d = (cur - prev) / prev
  const good = inverse ? d <= 0 : d >= 0
  return (
    <span className={`adm-delta ${good ? 'is-up' : 'is-down'}`}>
      <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden>
        <path d={d >= 0 ? 'M4.5 1 8 7.5H1z' : 'M4.5 8 1 1.5H8z'} fill="currentColor" />
      </svg>
      {d >= 0 ? '+' : '−'}
      {Math.abs(d * 100).toFixed(1).replace('.', ',')}%<span className="sr-only"> em relação ao período anterior</span>
    </span>
  )
}

export function Kpi({ label, value, prev, spark, cur, hero, hint, inverse }: { label: string; value: string; prev: number; spark: number[]; cur: number; hero?: boolean; hint?: string; inverse?: boolean }) {
  return (
    <section className={`adm-card adm-kpi${hero ? ' adm-kpi--hero' : ''}`}>
      <p className="adm-kpi__label">{label}</p>
      <p className="adm-kpi__value">{value}</p>
      <div className="adm-kpi__row">
        <Delta cur={cur} prev={prev} inverse={inverse} />
        {hint && <span className="adm-kpi__hint">{hint}</span>}
      </div>
      <Sparkline values={spark} />
    </section>
  )
}
