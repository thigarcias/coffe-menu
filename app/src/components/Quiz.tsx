import { useState } from 'react'
import type { MenuItem } from '../types'
import type { Avoid, QuizAnswers, Taste, Want } from '../lib/recommend'
import { suggest, type PickResult } from '../lib/ai'
import { fromPrice } from '../lib/format'
import { track } from '../lib/track'

interface Props {
  items: MenuItem[]
  onPick: (item: MenuItem) => void
}

const WANT: { v: Want; label: string; emoji: string }[] = [
  { v: 'quente', label: 'Algo quente', emoji: '☕' },
  { v: 'gelada', label: 'Algo gelado', emoji: '🧊' },
  { v: 'comer', label: 'Algo para comer', emoji: '🥐' },
  { v: 'tanto-faz', label: 'Tanto faz', emoji: '🤷' },
]
const TASTE: { v: Taste; label: string; hint: string }[] = [
  { v: 'doce', label: 'Docinho', hint: 'chocolate, caramelo, chantilly' },
  { v: 'equilibrado', label: 'Equilibrado', hint: 'suave, com leite' },
  { v: 'forte', label: 'Café forte', hint: 'intenso, pouco açúcar' },
]
const AVOID: { v: Avoid; label: string }[] = [
  { v: 'leite', label: 'Leite' },
  { v: 'gluten', label: 'Glúten' },
  { v: 'cafeina', label: 'Cafeína' },
]

/** "Ainda não sei, preciso de ajuda": três perguntas e três sugestões. */
export function Quiz({ items, onPick }: Props) {
  const [step, setStep] = useState(0)
  const [want, setWant] = useState<Want | null>(null)
  const [taste, setTaste] = useState<Taste | null>(null)
  const [avoid, setAvoid] = useState<Avoid[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PickResult | null>(null)

  const finish = async (a: QuizAnswers) => {
    setLoading(true)
    const r = await suggest(items, a, text)
    setLoading(false)
    setResult(r)
    track({ type: 'quiz_result', answers: { ...a, text, source: r.source }, itemIds: r.picks.map((p) => p.item.id) })
  }

  const restart = () => {
    setStep(0)
    setWant(null)
    setTaste(null)
    setAvoid([])
    setText('')
    setResult(null)
  }

  if (loading) {
    return (
      <div className="quiz quiz--loading">
        <div className="thinking" aria-hidden><span /><span /><span /></div>
        <h3 className="quiz__title">Pensando no seu pedido…</h3>
        <p className="quiz__note">A IA está olhando o cardápio inteiro por você.</p>
      </div>
    )
  }

  if (result) {
    return (
      <div className="quiz">
        <h3 className="quiz__title">Achamos a sua cara</h3>
        <span className={`source source--${result.source}`}>
          {result.source === 'ia' ? 'Sugerido pela IA' : 'Sugestão rápida (IA indisponível aqui)'}
        </span>
        {!result.picks.length && <p className="quiz__empty">Nada bateu com tudo isso. Tenta tirar uma restrição?</p>}
        <div className="sugs">
          {result.picks.map(({ item, why }, i) => (
            <button key={item.id} className="sug" onClick={() => onPick(item)}>
              <div className="sug__img">{item.image && <img src={item.image} alt="" />}</div>
              <div className="sug__txt">
                <span className="sug__rank">{i === 0 ? 'Melhor escolha' : `Opção ${i + 1}`}</span>
                <strong>{item.name}</strong>
                <span className="sug__look">{why}</span>
                {fromPrice(item) && <span className="sug__meta">{fromPrice(item)}</span>}
              </div>
            </button>
          ))}
        </div>
        {avoid.length > 0 && (
          <p className="warn">
            Filtramos pelo cardápio, mas não garantimos ausência de traços. Confirme com a equipe antes de pedir.
          </p>
        )}
        <button className="link" onClick={restart}>Refazer</button>
      </div>
    )
  }

  return (
    <div className="quiz">
      <div className="dots">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`dot ${i <= step ? 'dot--on' : ''}`} />
        ))}
      </div>

      {step === 0 && (
        <>
          <h3 className="quiz__title">O que você quer agora?</h3>
          <div className="opts opts--2">
            {WANT.map((o) => (
              <button
                key={o.v}
                className={`opt ${want === o.v ? 'opt--on' : ''}`}
                onClick={() => {
                  setWant(o.v)
                  setStep(1)
                }}
              >
                <span className="opt__emoji">{o.emoji}</span>
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <h3 className="quiz__title">Qual é o seu paladar?</h3>
          <div className="opts">
            {TASTE.map((o) => (
              <button
                key={o.v}
                className={`opt opt--row ${taste === o.v ? 'opt--on' : ''}`}
                onClick={() => {
                  setTaste(o.v)
                  setStep(2)
                }}
              >
                <strong>{o.label}</strong>
                <span className="opt__hint">{o.hint}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h3 className="quiz__title">Precisa evitar alguma coisa?</h3>
          <div className="chips">
            {AVOID.map((o) => {
              const on = avoid.includes(o.v)
              return (
                <button
                  key={o.v}
                  className={`chip ${on ? 'chip--on' : ''}`}
                  onClick={() => setAvoid(on ? avoid.filter((x) => x !== o.v) : [...avoid, o.v])}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
          <label className="free" htmlFor="quiz-text">
            <span className="label">Quer contar mais? (opcional)</span>
            <textarea
              id="quiz-text"
              rows={2}
              maxLength={200}
              placeholder="Ex.: algo leve, não muito doce, para acompanhar um pão de queijo"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <p className="quiz__note">Suas respostas não ficam salvas.</p>
          <button className="cta" onClick={() => finish({ want: want!, taste: taste!, avoid })}>
            {avoid.length ? 'Ver sugestões' : 'Nada, ver sugestões'}
          </button>
        </>
      )}

      {step > 0 && (
        <button className="link" onClick={() => setStep(step - 1)}>Voltar</button>
      )}
    </div>
  )
}
