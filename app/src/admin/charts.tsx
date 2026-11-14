import { useEffect, useRef, useState, type ReactNode } from 'react'

/* Cores dos gráficos: um só tom (sálvia) em passos de claro a escuro, mais cinza para o
   "antes". Cada passo do funil mantém pelo menos 2:1 de contraste com o branco. */
export const SAGE = '#4f7f64'
export const SAGE_STEPS = ['#9eb9aa', '#84a593', '#69927b', '#4f7f64', '#3b6a50']
export const PREV = '#b9b4ae'

/** Mede a largura do contêiner, para o gráfico desenhar na escala certa (texto nunca estica). */
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    setW(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

/** Passo "redondo" para as marcas do eixo (1, 2, 2,5, 5 × 10ⁿ). */
function niceStep(max: number, ticks: number) {
  const raw = max / ticks
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p
}

/* ------------------------------------------------------------------ linha */

interface LineProps {
  labels: string[]
  tipLabels: string[]
  cur: number[]
  prev: number[]
  curName: string
  prevName: string
  fmtTick: (n: number) => string
  fmtValue: (n: number) => string
  fmtShort: (n: number) => string
  ariaLabel: string
}

export function LineChart({ labels, tipLabels, cur, prev, curName, prevName, fmtTick, fmtValue, fmtShort, ariaLabel }: LineProps) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const w = Math.max(width, 240)
  const h = w < 480 ? 210 : w < 560 ? 280 : 380
  const m = { l: 44, r: 14, t: 22, b: 26 }
  const iw = w - m.l - m.r
  const ih = h - m.t - m.b
  const n = cur.length
  const hasPrev = prev.length === n && n > 0
  const peakAll = Math.max(...cur, ...(hasPrev ? prev : [0]), 1)
  const step = niceStep(peakAll * 1.05, 4)
  const top = Math.ceil((peakAll * 1.05) / step) * step
  const x = (i: number) => m.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1))
  const y = (v: number) => m.t + ih - (v / top) * ih
  const path = (a: number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, k) => k * step)
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 38))))
  const peak = cur.indexOf(Math.max(...cur))

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1))
    setHover(Math.min(n - 1, Math.max(0, i)))
  }

  // a dica tem largura fixa (192px): vai para a direita do ponto, ou para a esquerda se não couber,
  // e nunca passa das bordas do gráfico (no iPhone SE o gráfico tem só ~240px)
  const TIP_W = 192
  const hx = hover == null ? 0 : x(hover)
  const tipLeft = Math.min(Math.max(hx + 12 + TIP_W <= w ? hx + 12 : hx - 12 - TIP_W, 0), Math.max(w - TIP_W, 0))

  return (
    <div className="adm-line" ref={ref}>
      {width > 0 && (
        <>
          <svg width={w} height={h} role="img" aria-label={ariaLabel} className="adm-svg">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} className="adm-grid-line" />
                <text x={m.l - 8} y={y(t) + 4} textAnchor="end" className="adm-axis">
                  {fmtTick(t)}
                </text>
              </g>
            ))}
            {labels.map((l, i) =>
              i % every === 0 || i === n - 1 ? (
                <text key={i} x={x(i)} y={h - 6} textAnchor="middle" className="adm-axis">
                  {l}
                </text>
              ) : null,
            )}
            <path d={`${path(cur)}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill={SAGE} opacity={0.1} />
            {hasPrev && <path d={path(prev)} fill="none" stroke={PREV} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
            <path d={path(cur)} fill="none" stroke={SAGE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {hover == null && (
              <g>
                <circle cx={x(peak)} cy={y(cur[peak])} r={6} fill="#fff" />
                <circle cx={x(peak)} cy={y(cur[peak])} r={4} fill={SAGE} />
                <text
                  x={Math.min(Math.max(x(peak), m.l + 26), w - m.r - 26)}
                  y={y(cur[peak]) - 12}
                  textAnchor="middle"
                  className="adm-peak"
                >
                  {fmtShort(cur[peak])}
                </text>
              </g>
            )}

            {hover != null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + ih} className="adm-cross" />
                {hasPrev && <circle cx={x(hover)} cy={y(prev[hover])} r={6} fill="#fff" />}
                {hasPrev && <circle cx={x(hover)} cy={y(prev[hover])} r={4} fill={PREV} />}
                <circle cx={x(hover)} cy={y(cur[hover])} r={6} fill="#fff" />
                <circle cx={x(hover)} cy={y(cur[hover])} r={4} fill={SAGE} />
              </g>
            )}
            {/* área de toque bem maior que as marcas; no celular, arrastar o dedo percorre o gráfico */}
            <rect
              x={m.l}
              y={0}
              width={iw}
              height={h}
              fill="transparent"
              style={{ touchAction: 'pan-y' }}
              onPointerMove={onMove}
              onPointerDown={onMove}
              onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
            />
          </svg>
          {hover != null && (
            <div className="adm-tip" style={{ left: tipLeft, top: 8 }}>
              <strong>{tipLabels[hover]}</strong>
              <span>
                <i style={{ background: SAGE }} />
                {curName} <b>{fmtValue(cur[hover])}</b>
              </span>
              {hasPrev && (
                <span>
                  <i style={{ background: PREV }} />
                  {prevName} <b>{fmtValue(prev[hover])}</b>
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <ul className="adm-legend">
      {items.map((i) => (
        <li key={i.label}>
          <i style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------- minigráfico */

export function Sparkline({ values }: { values: number[] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const w = Math.max(width, 40)
  const h = 30
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const x = (i: number) => 4 + (i * (w - 12)) / Math.max(values.length - 1, 1)
  const y = (v: number) => 5 + (h - 10) - ((v - lo) / Math.max(hi - lo, 1e-9)) * (h - 10)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const last = values.length - 1
  return (
    <div className="adm-spark" ref={ref} aria-hidden>
      {width > 0 && (
        <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
          <path d={d} fill="none" stroke={SAGE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(last)} cy={y(values[last])} r={3.5} fill={SAGE} stroke="#fff" strokeWidth={2} />
        </svg>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ barras */

export interface BarRow {
  key: string
  label: string
  sub?: string
  thumb?: ReactNode
  value: number
  figure: string
  figureSub?: string
}

/** Lista de barras horizontais ranqueadas: nome, barra alinhada e número, uma linha por item. */
export function RankedBars({ rows, max, ranked = true }: { rows: BarRow[]; max?: number; ranked?: boolean }) {
  const top = max ?? Math.max(...rows.map((r) => r.value), 1e-9)
  return (
    <ol className={`adm-bars${ranked ? '' : ' adm-bars--plain'}`}>
      {rows.map((r, i) => (
        <li key={r.key} className={`adm-bar${r.thumb ? ' adm-bar--thumb' : ''}`}>
          <span className="adm-bar__rank">{i + 1}</span>
          {r.thumb}
          <div className="adm-bar__main">
            <div className="adm-bar__name">
              <span className="adm-bar__label">{r.label}</span>
              {r.sub && <small>{r.sub}</small>}
            </div>
            <div className="adm-bar__track">
              <div className="adm-bar__fill" style={{ width: `${Math.max(2, (r.value / top) * 100)}%` }} />
            </div>
          </div>
          <div className="adm-bar__figure">
            <b>{r.figure}</b>
            {r.figureSub && <small>{r.figureSub}</small>}
          </div>
        </li>
      ))}
    </ol>
  )
}

/* ------------------------------------------------------------------ funil */

export function Funnel({ steps, fmt }: { steps: { label: string; hint: string; value: number }[]; fmt: (n: number) => string }) {
  const first = steps[0].value
  return (
    <ol className="adm-funnel">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].value : null
        const drop = prev ? 1 - s.value / prev : null
        return (
          <li key={s.label}>
            <div className="adm-funnel__head">
              <span className="adm-funnel__label">{s.label}</span>
              <span className="adm-funnel__num">
                <b>{fmt(s.value)}</b>
                <small>{Math.round((s.value / first) * 100)}%</small>
              </span>
            </div>
            <div className="adm-funnel__track">
              <div className="adm-funnel__fill" style={{ width: `${(s.value / first) * 100}%`, background: SAGE_STEPS[i] }} />
            </div>
            <div className="adm-funnel__foot">
              <span>{s.hint}</span>
              {drop != null && <span className="adm-funnel__drop">−{Math.round(drop * 100)}% do passo anterior</span>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/* ------------------------------------------------------------ mapa de calor */

const HEAT_BINS = [0.14, 0.32, 0.52, 0.76, 1]
const heatColor = (v: number, max: number) => {
  const t = v / max
  const bin = HEAT_BINS[Math.min(HEAT_BINS.length - 1, Math.floor(t * HEAT_BINS.length))]
  return `rgba(79,127,100,${bin})`
}

export function Heatmap({ rows, hours, max }: { rows: { label: string; cells: number[] }[]; hours: number[]; max: number }) {
  const [tip, setTip] = useState<{ r: number; c: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const cur = tip && { label: rows[tip.r].label, hour: hours[tip.c], v: rows[tip.r].cells[tip.c] }
  return (
    <div className="adm-heat" ref={box} onPointerLeave={() => setTip(null)}>
      <div className="adm-heat__grid" style={{ gridTemplateColumns: `28px repeat(${hours.length}, minmax(0, 1fr))` }} role="img" aria-label="Pedidos por dia da semana e hora">
        <span />
        {hours.map((hr) => (
          <span key={hr} className="adm-heat__hour">
            {hr % 2 === 0 ? hr : ''}
          </span>
        ))}
        {rows.map((r, ri) => (
          <div key={r.label} className="adm-heat__row">
            <span className="adm-heat__dow">{r.label}</span>
            {r.cells.map((v, ci) => (
              <span
                key={ci}
                className={`adm-heat__cell${tip?.r === ri && tip.c === ci ? ' is-on' : ''}`}
                style={{ background: heatColor(v, max) }}
                onPointerEnter={() => setTip({ r: ri, c: ci })}
                onPointerDown={() => setTip({ r: ri, c: ci })}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="adm-heat__foot">
        <p className="adm-heat__read" aria-live="polite">
          {cur ? (
            <>
              <b>{cur.label}, {cur.hour}h</b> · {cur.v} pedidos
            </>
          ) : (
            'Toque ou passe o mouse numa célula'
          )}
        </p>
        <div className="adm-heat__scale" aria-hidden>
          <small>menos</small>
          {HEAT_BINS.map((b) => (
            <i key={b} style={{ background: `rgba(79,127,100,${b})` }} />
          ))}
          <small>mais</small>
        </div>
      </div>
    </div>
  )
}
