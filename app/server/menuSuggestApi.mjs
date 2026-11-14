import { readFile } from 'node:fs/promises'
import { readJson } from './menuData.mjs'
import { suggestMenuDetails } from './menuSuggestions.mjs'
const { tagGroups } = JSON.parse(await readFile(new URL('../src/data/menu.json', import.meta.url), 'utf8'))
export async function handleMenuSuggest(req, res) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json; charset=utf-8')
  const fail = (status, message) => { res.statusCode = status; return res.end(JSON.stringify({ message })) }
  if (req.method !== 'POST') return fail(405, 'Método não permitido.')
  const authorization = req.headers.authorization
  if (!/^Bearer [^\s]+$/.test(authorization ?? '')) return fail(401, 'Entre novamente para usar sugestões.')
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return fail(503, 'Sugestões indisponíveis no momento.')
  let body; try { body = await readJson(req, 32768) } catch { return fail(400, 'Dados inválidos.') }
  if (!body || typeof body.cafeId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.cafeId)) return fail(400, 'Unidade inválida.')
  try {
    const check = await fetch(new URL('/rest/v1/rpc/list_my_cafes', url), { method: 'POST', headers: { apikey: key, authorization, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(8000) })
    if (check.status === 401 || check.status === 403) return fail(403, 'Você não tem acesso a esta unidade.')
    if (!check.ok) return fail(503, 'Sugestões indisponíveis no momento.')
    const cafes = await check.json()
    if (!Array.isArray(cafes) || !cafes.some((c) => c.id === body.cafeId)) return fail(403, 'Você não tem acesso a esta unidade.')
    const result = await suggestMenuDetails(body.product, tagGroups)
    return res.end(JSON.stringify(result))
  } catch (error) { return fail(error?.status === 400 ? 400 : 503, error?.status === 400 ? error.message : 'Sugestões indisponíveis no momento.') }
}

