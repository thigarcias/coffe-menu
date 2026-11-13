import { useState } from 'react'
import type { MenuItem } from '../types'
import type { Avoid, Body, Caffeine, FlavorId, FoodKind, Moment, QuizAnswers, Taste, Want } from '../lib/recommend'
import { suggest, type PickResult } from '../lib/ai'
import { fromPrice } from '../lib/format'
import { track } from '../lib/track'
import { BagPlus } from './Icons'

interface Props {
  items: MenuItem[]
  onPick: (item: MenuItem) => void
  counts: Map<string, number>
  onAdd: (item: MenuItem) => void
}

const WANT: { v: Want; label: string; emoji: string }[] = [
  { v: 'quente', label: 'Algo quente', emoji: '☕' },
  { v: 'gelada', label: 'Algo gelado', emoji: '🧊' },
  { v: 'comer', label: 'Algo para comer', emoji: '🥐' },
  { v: 'tanto-faz', label: 'Tanto faz', emoji: '🤷' },
]
const CAFFEINE: { v: Caffeine; label: string; hint: string; emoji: string }[] = [
  { v: 'com', label: 'Com café', hint: 'espresso, latte, cappuccino', emoji: '☕' },
  { v: 'sem', label: 'Sem café', hint: 'chá, matcha, chocolate, refresher', emoji: '🌿' },
  { v: 'tanto-faz', label: 'Tanto faz', hint: 'qualquer base', emoji: '🤷' },
]
const FOOD_KIND: { v: FoodKind; label: string; hint: string; emoji: string }[] = [
  { v: 'doce', label: 'Doce', hint: 'bolo, cookie, brownie', emoji: '🍰' },
  { v: 'salgado', label: 'Salgado', hint: 'pão de queijo, sanduíche, croissant', emoji: '🧀' },
  { v: 'tanto-faz', label: 'Tanto faz', hint: 'o que for gostoso', emoji: '🤷' },
]
const TASTE: { v: Taste; label: string; hint: string; emoji: string }[] = [
  { v: 'doce', label: 'Docinho', hint: 'chocolate, caramelo, chantilly', emoji: '🍬' },
  { v: 'equilibrado', label: 'Equilibrado', hint: 'suave, com leite', emoji: '⚖️' },
  { v: 'forte', label: 'Café forte', hint: 'intenso, pouco açúcar', emoji: '💪' },
]
const BODY: { v: Body; label: string; hint: string; emoji: string }[] = [
  { v: 'cremoso', label: 'Cremoso', hint: 'macio, com leite e espuma', emoji: '☁️' },
  { v: 'leve', label: 'Leve e refrescante', hint: 'mais líquido, com gelo ou chá', emoji: '💧' },
  { v: 'tanto-faz', label: 'Tanto faz', hint: 'qualquer textura', emoji: '🤷' },
]
const MOMENT: { v: Moment; label: string; emoji: string }[] = [
  { v: 'cafe-da-manha', label: 'Café da manhã', emoji: '🌅' },
  { v: 'lanche', label: 'Lanche', emoji: '🥪' },
  { v: 'sobremesa', label: 'Sobremesa', emoji: '🍰' },
  { v: 'proteico', label: 'Proteico', emoji: '💪' },
  { v: 'levar', label: 'Para levar', emoji: '🛍️' },
  { v: 'qualquer', label: 'Qualquer hora', emoji: '🤷' },
]
const FLAVOR_LABEL: Record<FlavorId, { label: string; emoji: string }> = {
  chocolate: { label: 'Chocolate', emoji: '🍫' },
  caramelo: { label: 'Caramelo', emoji: '🍮' },
  frutas: { label: 'Frutas vermelhas', emoji: '🍓' },
  'avela-baunilha': { label: 'Avelã e baunilha', emoji: '🌰' },
  especiarias: { label: 'Especiarias', emoji: '🍂' },
  citrico: { label: 'Cítrico', emoji: '🍋' },
  matcha: { label: 'Matcha', emoji: '🍵' },
  queijo: { label: 'Queijo', emoji: '🧀' },
  frango: { label: 'Frango', emoji: '🍗' },
  presunto: { label: 'Presunto e frios', emoji: '🥓' },
}
type Flow = 'drink' | 'food' | 'any'
const FLAVORS_BY_FLOW: Record<Flow, FlavorId[]> = {
  drink: ['chocolate', 'caramelo', 'frutas', 'avela-baunilha', 'especiarias', 'citrico', 'matcha'],
  food: ['queijo', 'frango', 'presunto', 'chocolate', 'frutas', 'caramelo'],
  any: ['chocolate', 'caramelo', 'frutas', 'queijo', 'avela-baunilha', 'especiarias'],
}
const MAX_FLAVORS = 2
const AVOID: { v: Avoid; label: string }[] = [
  { v: 'leite', label: 'Leite' },
  { v: 'gluten', label: 'Glúten' },
  { v: 'cafeina', label: 'Cafeína' },
]

/** As perguntas mudam com o que a pessoa quer: bebida, comida ou "tanto faz". */
type StepId = 'want' | 'caffeine' | 'foodKind' | 'flavors' | 'taste' | 'body' | 'moment' | 'final'
const FLOWS: Record<Flow, StepId[]> = {
  drink: ['want', 'caffeine', 'flavors', 'taste', 'body', 'final'],
  food: ['want', 'foodKind', 'flavors', 'moment', 'final'],
  any: ['want', 'moment', 'flavors', 'taste', 'final'],
}
const flowOf = (w: Want | null): Flow => (w === 'comer' ? 'food' : w === 'tanto-faz' ? 'any' : 'drink')

/** "Ainda não sei, preciso de ajuda": de 5 a 6 perguntas rápidas (um toque cada) e três sugestões. */
export function Quiz({ items, onPick, counts, onAdd }: Props) {
  const [step, setStep] = useState(0)
  const [want, setWant] = useState<Want | null>(null)
  // null = ainda não respondeu (nada aparece marcado); na hora de enviar vira a opção neutra
  const [caffeine, setCaffeine] = useState<Caffeine | null>(null)
  const [foodKind, setFoodKind] = useState<FoodKind | null>(null)
  const [flavors, setFlavors] = useState<FlavorId[]>([])
  const [taste, setTaste] = useState<Taste | null>(null)
  const [body, setBody] = useState<Body | null>(null)
  const [moment, setMoment] = useState<Moment | null>(null)
  const [avoid, setAvoid] = useState<Avoid[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PickResult | null>(null)

  const flow = flowOf(want)
  const steps = FLOWS[flow]
  const current = steps[Math.min(step, steps.length - 1)]
  const next = () => setStep((n) => Math.min(n + 1, steps.length - 1))

  const finish = async () => {
    // só as perguntas que apareceram no caminho dela entram na conta
    const a: QuizAnswers = {
      want: want!,
      flavors,
      avoid,
      asked: steps.filter((x) => x === 'taste' || x === 'body'),
      ...(flow === 'drink' ? { caffeine: caffeine ?? 'tanto-faz', taste: taste ?? 'equilibrado', body: body ?? 'tanto-faz' } : {}),
      ...(flow === 'food' ? { foodKind: foodKind ?? 'tanto-faz', moment: moment ?? 'qualquer' } : {}),
      ...(flow === 'any' ? { moment: moment ?? 'qualquer', taste: taste ?? 'equilibrado' } : {}),
    }
    setLoading(true)
    const r = await suggest(items, a, text)
    setLoading(false)
    setResult(r)
    // restrição alimentar e texto livre são dados sensíveis: não vão para o registro de interesse
    const { avoid: _avoid, ...safe } = a
    void _avoid
    track({ type: 'quiz_result', answers: { ...safe, flavors: safe.flavors.join(','), asked: safe.asked.join(','), source: r.source }, itemIds: r.picks.map((p) => p.item.id) })
  }

  const restart = () => {
    setStep(0)
    setWant(null)
    setCaffeine(null)
    setFoodKind(null)
    setFlavors([])
    setTaste(null)
    setBody(null)
    setMoment(null)
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
          {result.picks.map(({ item, why, matched }, i) => {
            const n = counts.get(item.id) ?? 0
            return (
              <div key={item.id} className="sug">
                <button className="sug__main" onClick={() => onPick(item)}>
                  <div className="sug__img">{item.image && <img src={item.image} alt="" />}</div>
                  <div className="sug__txt">
                    <span className="sug__rank">{i === 0 ? 'Melhor escolha' : `Opção ${i + 1}`}</span>
                    <strong>{item.name}</strong>
                    <span className="sug__look">{why}</span>
                    {matched.length > 0 && (
                      <span className="sug__tags" aria-label="Combina com">
                        {matched.slice(0, 4).map((m) => (
                          <span key={m} className="tagchip">{m}</span>
                        ))}
                      </span>
                    )}
                    {fromPrice(item) && <span className="sug__meta">{fromPrice(item)}</span>}
                  </div>
                </button>
                <button className="sug__add" aria-label={`Adicionar ${item.name} à sacola`} onClick={() => onAdd(item)}>
                  <span className="glass circle circle--bag"><BagPlus size={20} /></span>
                  <span className="sug__addlbl">Adicionar</span>
                  {n > 0 && <span className="count" aria-label={`${n} na sacola`}>{n}</span>}
                </button>
              </div>
            )
          })}
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

  /** Uma pergunta de escolha única: tocou, avançou. */
  const single = <T extends string>(title: string, opts: { v: T; label: string; emoji: string; hint?: string }[], value: T | null, set: (v: T) => void, grid = false) => (
    <>
      <h3 className="quiz__title">{title}</h3>
      <div className={`opts${grid ? ' opts--2' : ''}`}>
        {opts.map((o) => (
          <button
            key={o.v}
            className={`opt${o.hint ? ' opt--row' : ''}${value === o.v ? ' opt--on' : ''}`}
            onClick={() => {
              set(o.v)
              next()
            }}
          >
            {o.hint ? (
              <>
                <strong className="opt__title">
                  <span className="opt__lead" aria-hidden>{o.emoji}</span>
                  <span>{o.label}</span>
                </strong>
                <span className="opt__hint">{o.hint}</span>
              </>
            ) : (
              <>
                <span className="opt__emoji" aria-hidden>{o.emoji}</span>
                {o.label}
              </>
            )}
          </button>
        ))}
      </div>
    </>
  )

  return (
    <div className="quiz">
      <div className="dots" aria-label={`Pergunta ${step + 1} de ${steps.length}`}>
        {steps.map((_, i) => (
          <span key={i} className={`dot ${i <= step ? 'dot--on' : ''}`} />
        ))}
      </div>

      {current === 'want' &&
        single('O que você quer agora?', WANT, want, (v) => {
          // trocar de caminho (bebida, comida, tanto faz) zera o que só fazia sentido no anterior
          if (flowOf(v) !== flow) setFlavors([])
          setWant(v)
        }, true)}

      {current === 'caffeine' && single('Com café ou sem?', CAFFEINE, caffeine, setCaffeine)}

      {current === 'foodKind' && single('Doce ou salgado?', FOOD_KIND, foodKind, setFoodKind)}

      {current === 'flavors' && (
        <>
          <h3 className="quiz__title">{flow === 'food' ? 'Qual sabor combina?' : 'Algum sabor em mente?'}</h3>
          <p className="quiz__hint">Escolha até {MAX_FLAVORS}, ou siga sem preferência.</p>
          <div className="chips chips--flavors">
            {FLAVORS_BY_FLOW[flow].map((f) => {
              const on = flavors.includes(f)
              return (
                <button
                  key={f}
                  className={`chip ${on ? 'chip--on' : ''}`}
                  aria-pressed={on}
                  onClick={() => setFlavors(on ? flavors.filter((x) => x !== f) : [...flavors, f].slice(-MAX_FLAVORS))}
                >
                  <span className="chip__emoji" aria-hidden>{FLAVOR_LABEL[f].emoji}</span>
                  {FLAVOR_LABEL[f].label}
                </button>
              )
            })}
          </div>
          <button className="cta" onClick={next}>{flavors.length ? 'Continuar' : 'Sem preferência'}</button>
        </>
      )}

      {current === 'taste' && single('Qual é o seu paladar?', TASTE, taste, setTaste)}

      {current === 'body' && single('Como você gosta?', BODY, body, setBody)}

      {current === 'moment' && single('Para qual momento?', MOMENT, moment, setMoment, true)}

      {current === 'final' && (
        <>
          <h3 className="quiz__title">Precisa evitar alguma coisa?</h3>
          <div className="chips">
            {AVOID.map((o) => {
              const on = avoid.includes(o.v)
              return (
                <button
                  key={o.v}
                  className={`chip ${on ? 'chip--on' : ''}`}
                  aria-pressed={on}
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
          <button className="cta" onClick={() => void finish()}>
            {text.trim() ? 'Enviar' : avoid.length ? 'Ver sugestões' : 'Nada, ver sugestões'}
          </button>
        </>
      )}

      {step > 0 && (
        <button className="link" onClick={() => setStep(step - 1)}>Voltar</button>
      )}
    </div>
  )
}
