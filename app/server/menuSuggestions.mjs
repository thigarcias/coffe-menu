import { callStructured } from './openai.mjs'

// Sugestões são sempre revisão humana; ausência de resultado nunca significa ausência de alérgenos.
export async function suggestMenuDetails(product, tagGroups, invoke = callStructured) {
  if (!product || typeof product.name !== 'string' || !product.name.trim() || product.name.length > 200) throw Object.assign(new Error('Informe o nome do produto.'), { status: 400 })
  if (typeof product.description !== 'string' || product.description.length > 2000 || !Array.isArray(product.ingredients) || product.ingredients.length > 100 || product.ingredients.some((i) => typeof i !== 'string' || i.length > 200)) throw Object.assign(new Error('Dados do produto inválidos.'), { status: 400 })
  const tags = (Array.isArray(tagGroups) ? tagGroups : []).flatMap((g) => Array.isArray(g.tags) ? g.tags : []).filter((t) => typeof t?.id === 'string' && typeof t?.label === 'string')
  const allowed = new Set(tags.map((t) => t.id))
  const result = await invoke({
    name: 'sugestoes_cardapio',
    instructions: 'Sugira etiquetas apenas entre os IDs fornecidos e possíveis alérgenos a partir das informações do produto. Seja conservador: não afirme ausência de alérgenos, não invente ingredientes e não trate suas sugestões como verificadas. Responda em português.',
    input: JSON.stringify({ produto: { nome: product.name, descricao: product.description, ingredientes: product.ingredients }, etiquetas_disponiveis: tags }),
    schema: { type: 'object', additionalProperties: false, required: ['labels', 'allergens'], properties: { labels: { type: 'array', items: { type: 'string' } }, allergens: { type: 'array', items: { type: 'string' } } } },
  })
  return { labels: [...new Set((Array.isArray(result?.labels) ? result.labels : []).filter((x) => typeof x === 'string' && allowed.has(x)))], allergens: [...new Set((Array.isArray(result?.allergens) ? result.allergens : []).filter((x) => typeof x === 'string').map((x) => x.trim()).filter((x) => x && x.length <= 120))].slice(0, 30), allergensVerified: false }
}


const level = (value) => (Number.isInteger(value) && value >= 0 && value <= 3 ? String(value) : '')
const yesNo = (value) => (value === 'sim' ? 'true' : value === 'nao' ? 'false' : '')
const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const list = (value, max, size) => [...new Set((Array.isArray(value) ? value : []).filter((x) => typeof x === 'string').map((x) => x.trim()).filter((x) => x && x.length <= size))].slice(0, max)

/**
 * "Preencher com IA": a partir de um texto livre (e do que já foi digitado), propõe os campos do produto.
 * É sempre uma proposta para a cafeteria revisar: alérgenos nunca são confirmados, preço e foto nunca são inventados.
 */
export async function fillProductDetails(product, tagGroups, invoke = callStructured) {
  const brief = text(product?.brief, 1500)
  const name = text(product?.name, 200)
  if (!brief && !name) throw Object.assign(new Error('Descreva o produto ou informe o nome.'), { status: 400 })
  const description = text(product?.description, 2000)
  const ingredients = list(product?.ingredients, 100, 200)
  const tags = (Array.isArray(tagGroups) ? tagGroups : []).flatMap((g) => (Array.isArray(g?.tags) ? g.tags : [])).filter((t) => typeof t?.id === 'string' && typeof t?.label === 'string')
  const allowed = new Set(tags.map((t) => t.id))
  const known = new Set(tags.map((t) => t.label.trim().toLocaleLowerCase('pt-BR')))
  const result = await invoke({
    name: 'preencher_produto',
    instructions: 'Você ajuda uma cafeteria a preencher a ficha de um produto do cardápio a partir de um texto livre. Use só o que o texto e os campos já preenchidos sustentam; não invente ingredientes, preço, tamanho nem fatos. Em "labels" use somente IDs de etiquetas_disponiveis. Em "new_labels" sugira no máximo 4 etiquetas curtas (1 a 3 palavras) que descrevam bem o produto e não existam na lista. Alérgenos são apenas possíveis e nunca verificados; nunca afirme ausência de alérgenos. Escalas de 0 a 3; use -1 quando o texto não permitir saber. Para sim/não use "incerto" quando não der para saber. Escreva em português do Brasil, com descrição curta (até 2 frases) e tom acolhedor.',
    input: JSON.stringify({ texto_da_cafeteria: brief, produto: { nome: name, descricao: description, ingredientes: ingredients }, etiquetas_disponiveis: tags }),
    schema: {
      type: 'object', additionalProperties: false,
      required: ['name', 'description', 'lookalike', 'ingredients', 'allergens', 'labels', 'new_labels', 'sweet', 'bitter', 'hunger', 'milk', 'iced', 'caffeine'],
      properties: {
        name: { type: 'string' }, description: { type: 'string' }, lookalike: { type: 'string' },
        ingredients: { type: 'array', items: { type: 'string' } }, allergens: { type: 'array', items: { type: 'string' } },
        labels: { type: 'array', items: { type: 'string' } }, new_labels: { type: 'array', items: { type: 'string' } },
        sweet: { type: 'integer' }, bitter: { type: 'integer' }, hunger: { type: 'integer' },
        milk: { type: 'string', enum: ['sim', 'nao', 'incerto'] }, iced: { type: 'string', enum: ['sim', 'nao', 'incerto'] }, caffeine: { type: 'string', enum: ['sim', 'nao', 'incerto'] },
      },
    },
  })
  return {
    name: text(result?.name, 100),
    description: text(result?.description, 600),
    lookalike: text(result?.lookalike, 300),
    ingredients: list(result?.ingredients, 30, 80),
    allergens: list(result?.allergens, 30, 120),
    labels: [...new Set((Array.isArray(result?.labels) ? result.labels : []).filter((x) => typeof x === 'string' && allowed.has(x)))],
    newLabels: list(result?.new_labels, 4, 40).filter((label) => !known.has(label.toLocaleLowerCase('pt-BR'))),
    tags: { sweet: level(result?.sweet), bitter: level(result?.bitter), hunger: level(result?.hunger), milk: yesNo(result?.milk), iced: yesNo(result?.iced), caffeine: yesNo(result?.caffeine) },
    allergensVerified: false,
  }
}
