/**
 * Recomendação do quiz "Me ajuda a escolher", por ETIQUETAS.
 *
 * Cada produto tem etiquetas (`labels`: temperatura, base, sabor, perfil, ocasião). O que a pessoa
 * responde vira (1) filtros que NUNCA se quebram (restrição alimentar, quente/gelado, com ou sem café,
 * doce ou salgado) e (2) pontos por sabor, paladar, textura e momento. Etiqueta rara pesa mais que
 * etiqueta comum ("brigadeiro" diz mais que "docinho"). O resultado é uma lista com a nota de cada item e
 * o que casou, e a IA só escolhe os 3 finais ENTRE os melhores. Se a IA falhar, as 3 primeiras daqui valem.
 *
 * Roda no servidor e no navegador (plano B sem IA), por isso é JavaScript puro.
 */

/* ------------------------------------------------------------------ vocabulário das respostas */
export const WANTS = ['quente', 'gelada', 'comer', 'tanto-faz']
export const CAFFEINE = ['com', 'sem', 'tanto-faz']
export const TASTES = ['doce', 'equilibrado', 'forte']
export const BODIES = ['cremoso', 'leve', 'tanto-faz']
export const FOOD_KINDS = ['doce', 'salgado', 'tanto-faz']
export const MOMENTS = ['cafe-da-manha', 'lanche', 'sobremesa', 'proteico', 'levar', 'qualquer']
export const AVOIDS = ['leite', 'gluten', 'cafeina']

/** Sabores que a pessoa escolhe → etiquetas do cardápio que os representam. */
export const FLAVORS = {
  chocolate: { label: 'Chocolate', tags: ['chocolate', 'brigadeiro'] },
  caramelo: { label: 'Caramelo', tags: ['caramelo', 'doce-de-leite'] },
  frutas: { label: 'Frutas vermelhas', tags: ['frutas-vermelhas', 'frutado'] },
  'avela-baunilha': { label: 'Avelã e baunilha', tags: ['avela', 'baunilha'] },
  especiarias: { label: 'Especiarias', tags: ['especiarias'] },
  citrico: { label: 'Cítrico', tags: ['citrico'] },
  matcha: { label: 'Matcha', tags: ['matcha'] },
  queijo: { label: 'Queijo', tags: ['queijo'] },
  frango: { label: 'Frango', tags: ['frango'] },
  presunto: { label: 'Presunto e frios', tags: ['presunto'] },
}
const MOMENT_TAG = { 'cafe-da-manha': 'cafe-da-manha', lanche: 'lanche', sobremesa: 'sobremesa', proteico: 'proteico', levar: 'para-levar' }
export const MAX_FLAVORS = 2

const pick = (v, list, fallback) => (list.includes(v) ? v : fallback)

/** Aceita qualquer coisa vinda do navegador e devolve respostas válidas (valor desconhecido vira o neutro). */
export function normalizeAnswers(input) {
  const a = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  return {
    want: pick(a.want, WANTS, 'tanto-faz'),
    caffeine: pick(a.caffeine, CAFFEINE, 'tanto-faz'),
    taste: pick(a.taste, TASTES, 'equilibrado'),
    body: pick(a.body, BODIES, 'tanto-faz'),
    foodKind: pick(a.foodKind, FOOD_KINDS, 'tanto-faz'),
    moment: pick(a.moment, MOMENTS, 'qualquer'),
    flavors: [...new Set(Array.isArray(a.flavors) ? a.flavors.filter((f) => f in FLAVORS) : [])].slice(0, MAX_FLAVORS),
    avoid: [...new Set(Array.isArray(a.avoid) ? a.avoid.filter((x) => AVOIDS.includes(x)) : [])],
    // quais perguntas esta pessoa respondeu: o que não foi perguntado não pesa
    asked: new Set(Array.isArray(a.asked) ? a.asked : [...(TASTES.includes(a.taste) ? ['taste'] : []), ...(BODIES.includes(a.body) && a.body !== 'tanto-faz' ? ['body'] : [])]),
  }
}

/* ------------------------------------------------------------------ etiquetas */
export function tagCatalog(tagGroups) {
  const m = new Map()
  for (const g of tagGroups ?? []) for (const t of g.tags) m.set(t.id, { id: t.id, label: t.label, group: g.id, weight: g.weight })
  return m
}

const hasAllergen = (item, word) => (item.allergens ?? []).some((x) => x.toLowerCase().includes(word))
export const isFood = (item) => item.tags.hunger >= 2

/** Por que o item foi tirado da lista (ou null, se pode concorrer). Restrições vêm sempre primeiro. */
export function excludedBecause(item, a, extra = {}) {
  const t = item.tags
  const L = new Set(item.labels ?? [])
  const avoid = new Set([...a.avoid, ...(extra.avoid ?? [])])
  if (avoid.has('leite') && (t.milk || hasAllergen(item, 'lact') || hasAllergen(item, 'leite'))) return 'leite'
  if (avoid.has('gluten') && (hasAllergen(item, 'glút') || hasAllergen(item, 'glut'))) return 'gluten'
  if (avoid.has('cafeina') && t.caffeine) return 'cafeina'
  const food = isFood(item)
  if (a.want === 'quente' && (t.iced || food)) return 'temperatura'
  if (a.want === 'gelada' && (!t.iced || food)) return 'temperatura'
  if (a.want === 'comer' && !food) return 'comida'
  if (a.want === 'tanto-faz' && food && !['cafe-da-manha', 'lanche', 'sobremesa', 'proteico'].includes(a.moment)) return 'comida'
  if (!food && a.want !== 'comer') {
    if (a.caffeine === 'com' && !L.has('cafe')) return 'cafe'
    if (a.caffeine === 'sem' && L.has('cafe')) return 'cafe'
  }
  if (food && a.want === 'comer') {
    if (a.foodKind === 'salgado' && !L.has('salgado')) return 'tipo'
    if (a.foodKind === 'doce' && !(L.has('docinho') || L.has('sobremesa'))) return 'tipo'
  }
  for (const tag of extra.avoidHard ?? []) if (L.has(tag)) return 'etiqueta'
  return null
}

/* ------------------------------------------------------------------ pontuação */
/**
 * @param {any[]} items itens do cardápio (com `labels` e `tags`)
 * @param {any[]} tagGroups grupos de etiquetas do cardápio
 * @param {ReturnType<typeof normalizeAnswers>} a respostas já normalizadas
 * @param {{prefer?: {tag: string, strength: number}[], avoid?: string[], avoidTags?: string[], avoidHard?: string[]}} [extra] ajustes vindos do texto livre
 * @returns {{item: any, score: number, matched: string[], family: string}[]} só quem passou nos filtros, da maior nota para a menor
 */
export function scoreMenu(items, tagGroups, a, extra = {}) {
  const cat = tagCatalog(tagGroups)
  const n = items.length
  const df = new Map()
  for (const it of items) for (const l of new Set(it.labels ?? [])) df.set(l, (df.get(l) ?? 0) + 1)
  // etiqueta rara pesa mais: de ~0,5 (comum) a ~1,6 (rara)
  const rare = (tag) => Math.min(1.6, Math.max(0.5, Math.log((n + 1) / ((df.get(tag) ?? 0) + 1)) / 2))
  const label = (tag) => cat.get(tag)?.label ?? tag

  const out = []
  for (const item of items) {
    if (excludedBecause(item, a, extra)) continue
    const t = item.tags
    const L = new Set(item.labels ?? [])
    const food = isFood(item)
    let score = 0
    const matched = []
    const add = (pts, name) => {
      score += pts
      if (name && !matched.includes(name)) matched.push(name)
    }

    // o que foi pedido e já está garantido pelos filtros aparece como motivo
    if (a.want === 'quente') add(1, 'Quente')
    if (a.want === 'gelada') add(1, 'Gelado')
    if (!food && a.want !== 'comer') {
      if (a.caffeine === 'com') add(1, 'Com café')
      if (a.caffeine === 'sem') add(1, 'Sem café')
    }
    if (food && a.want === 'comer') {
      if (a.foodKind === 'salgado') add(1, 'Salgado')
      if (a.foodKind === 'doce') add(1, 'Doce')
    }

    // sabores escolhidos: o que mais pesa
    for (const f of a.flavors) {
      const hit = FLAVORS[f].tags.filter((tag) => L.has(tag))
      if (hit.length) add((6 + (hit.length > 1 ? 1.5 : 0)) * rare(hit[0]), FLAVORS[f].label)
      else add(-0.8)
    }

    // paladar (só nas bebidas e quando foi perguntado)
    if (!food && a.asked.has('taste')) {
      if (a.taste === 'doce') {
        if (L.has('docinho')) add(3, 'Docinho')
        if (L.has('intenso')) add(-3)
        add((t.sweet - 1.5) * 1.2)
      } else if (a.taste === 'forte') {
        if (L.has('intenso')) add(3.5, 'Intenso')
        if (L.has('docinho')) add(-2)
        add((t.bitter - 1) * 1.3 - (t.sweet - 1.5) * 0.6)
      } else {
        if (L.has('suave')) add(3, 'Suave')
        if (L.has('intenso')) add(-1.5)
        if (t.sweet >= 3) add(-1.5)
        add(1 - Math.abs(t.sweet - 1.5) * 0.8)
      }
    }

    // textura
    if (!food && a.asked.has('body')) {
      if (a.body === 'cremoso') {
        if (L.has('cremoso')) add(3, 'Cremoso')
        if (L.has('refrescante')) add(-1.5)
      } else if (a.body === 'leve') {
        if (L.has('refrescante')) add(3, 'Refrescante')
        if (L.has('suave')) add(1.5, 'Suave')
        if (L.has('cremoso')) add(-2)
      }
    }

    // momento
    const mt = MOMENT_TAG[a.moment]
    if (mt && L.has(mt)) add(4 * rare(mt), label(mt))

    if (item.badges?.length) add(0.4)

    // ajustes do texto livre
    for (const p of extra.prefer ?? []) if (L.has(p.tag)) add(2.5 * p.strength * rare(p.tag), label(p.tag))
    for (const tag of extra.avoidTags ?? []) if (L.has(tag)) add(-4)

    out.push({ item, score, matched, family: familyOf(item) })
  }
  return out.sort((x, y) => y.score - x.score || x.item.name.localeCompare(y.item.name, 'pt-BR'))
}

/** "Caramelo Frappuccino - Base Café" e "…Base Creme" são a mesma família de bebida. */
export function familyOf(item) {
  return item.name
    .toLowerCase()
    .replace(/[®™]/g, '')
    .replace(/\s*[-–]\s*base\s+\S+/g, '')
    .replace(/\b(gelado|gelada|quente|\(.*?\))/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Os melhores, sem deixar uma família ocupar a lista inteira. */
export function topCandidates(scored, n = 12, perFamily = 2) {
  const count = new Map()
  const out = []
  for (const s of scored) {
    const c = count.get(s.family) ?? 0
    if (c >= perFamily) continue
    count.set(s.family, c + 1)
    out.push(s)
    if (out.length >= n) break
  }
  return out
}

/** As 3 finais sem a IA: as melhores notas, uma por família. */
export function topPicks(scored, limit = 3) {
  return topCandidates(scored, limit, 1)
}

/** O que a pessoa pediu, em frases, para o prompt da IA (e para os testes). */
export function describeAnswers(a, tagGroups) {
  const cat = tagCatalog(tagGroups)
  const parts = []
  const want = { quente: 'uma bebida quente', gelada: 'uma bebida gelada', comer: 'algo para comer', 'tanto-faz': 'qualquer coisa (bebida ou comida)' }[a.want]
  parts.push(`quer ${want}`)
  if (a.want !== 'comer') {
    if (a.caffeine === 'com') parts.push('com café')
    if (a.caffeine === 'sem') parts.push('sem café (chá, matcha, chocolate…)')
  } else {
    if (a.foodKind === 'doce') parts.push('prefere doce')
    if (a.foodKind === 'salgado') parts.push('prefere salgado')
  }
  if (a.flavors.length) parts.push(`sabores preferidos: ${a.flavors.map((f) => FLAVORS[f].label).join(' e ')}`)
  if (a.want !== 'comer' && a.asked.has('taste')) parts.push(`paladar: ${{ doce: 'doce', equilibrado: 'equilibrado', forte: 'forte, intenso' }[a.taste]}`)
  if (a.want !== 'comer' && a.body !== 'tanto-faz') parts.push(`textura: ${a.body === 'cremoso' ? 'cremosa' : 'leve e refrescante'}`)
  const mt = MOMENT_TAG[a.moment]
  if (mt) parts.push(`momento: ${cat.get(mt)?.label?.toLowerCase() ?? mt}`)
  if (a.avoid.length) parts.push(`precisa evitar: ${a.avoid.map((x) => ({ leite: 'leite', gluten: 'glúten', cafeina: 'cafeína' })[x]).join(', ')}`)
  return parts.join('; ')
}

/** Frase curta de motivo, sem IA, a partir do que casou. */
export function reasonFrom(matched, item) {
  const m = matched.filter((x) => !['Quente', 'Gelado'].includes(x)).slice(0, 3)
  return m.length ? `Combina com você: ${m.map((x) => x.toLowerCase()).join(', ')}.` : item.lookalike || 'Uma boa escolha para agora.'
}
