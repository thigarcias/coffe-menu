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

