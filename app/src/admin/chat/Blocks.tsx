import type { ReactNode } from 'react'
import { Funnel, Heatmap, Legend, LineChart, PREV, RankedBars, SAGE } from '../charts'
import type { Block } from './types'

const num = new Intl.NumberFormat('pt-BR')
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const money0 = (v: number) => `R$ ${num.format(Math.round(v))}`
const pct1 = (v: number) => `${(v * 100).toFixed(1).replace('.', ',')}%`
const axisMoney = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(v))

/** Texto com **negrito** simples (a IA marca o que importa). Nada de HTML vindo da IA. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <p className="adm-chat__text">
      {parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>))}
    </p>
  )
}

function Card({ title, subtitle, children }: { title?: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="adm-bk">
      {title && (
        <header className="adm-bk__head">
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  )
}

/** Desenha um bloco da IA. Tipo desconhecido vira nada (nunca quebra a conversa). */
export function BlockView({ block, onAsk }: { block: Block; onAsk?: (q: string) => void }) {
  switch (block.type) {
    case 'text':
      return <RichText text={block.text} />
    case 'suggest':
      return (
        <div className="adm-chat__sugg adm-chat__sugg--inline" role="group" aria-label="Perguntas sugeridas">
          {block.items.map((q) => (
            <button key={q} onClick={() => onAsk?.(q)} disabled={!onAsk}>
              {q}
            </button>
          ))}
        </div>
      )
    case 'kpis':
      return (
        <Card title={block.title}>
          <dl className="adm-stats">
            {block.items.map((k) => (
              <div key={k.label}>
                <dt>{k.label}</dt>
                <dd>{k.value}</dd>
                {k.note && <small>{k.note}</small>}
              </div>
            ))}
          </dl>
        </Card>
      )
    case 'line':
      return (
        <Card title={block.title} subtitle={block.subtitle}>
          {block.previous.length > 0 && (
            <Legend
              items={[
                { color: SAGE, label: block.currentName },
                { color: PREV, label: block.previousName },
              ]}
            />
          )}
          <LineChart
            labels={block.labels}
            tipLabels={block.tips}
            cur={block.current}
            prev={block.previous}
            curName={block.currentName}
            prevName={block.previousName}
            fmtTick={block.format === 'money' ? axisMoney : block.format === 'percent' ? (v) => `${Math.round(v * 100)}%` : (v) => num.format(v)}
            fmtValue={block.format === 'money' ? (v) => brl.format(v) : block.format === 'percent' ? pct1 : (v) => num.format(v)}
            fmtShort={block.format === 'money' ? money0 : block.format === 'percent' ? pct1 : (v) => num.format(v)}
            ariaLabel={block.title}
          />
        </Card>
      )
    case 'bars':
      return (
        <Card title={block.title} subtitle={block.subtitle}>
          <RankedBars ranked={block.ranked !== false} rows={block.rows.map((r) => ({ key: r.label, label: r.label, value: r.value, figure: r.figure, figureSub: r.note }))} />
        </Card>
      )
    case 'funnel':
      return (
        <Card title={block.title}>
          <Funnel steps={block.steps} fmt={(n) => num.format(n)} />
        </Card>
      )
    case 'heat':
      return (
        <Card title={block.title} subtitle={block.subtitle}>
          <Heatmap rows={block.rows} hours={block.hours} max={Math.max(1, ...block.rows.flatMap((r) => r.cells))} />
        </Card>
      )
    case 'table':
      return (
        <Card title={block.title}>
          <div className="adm-tablewrap">
            <table className="adm-table">
              <thead>
                <tr>
                  {block.columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )
    default:
      return null
  }
}
