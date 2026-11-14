import { randomUUID } from 'node:crypto'
import { readJson } from './menuData.mjs'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const keyPattern = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\.(jpg|png|webp)$/i
const mime = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
function containsKey(value, key) {
  if (typeof value === 'string') return value === key
  if (Array.isArray(value)) return value.some((x) => containsKey(x, key))
  return !!value && typeof value === 'object' && Object.values(value).some((x) => containsKey(x, key))
}
function sniff(data) {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'jpg'
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png'
  if (data.length >= 12 && data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP') return 'webp'
  return null
}
export async function handleMenuMedia(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const fail = (status, message) => { res.statusCode = status; res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify({ message })) }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return fail(503, 'Imagens indisponíveis.')
  if (req.method === 'POST') {
    const authorization = req.headers.authorization
    if (!/^Bearer [^\s]+$/.test(authorization ?? '')) return fail(401, 'Entre novamente para enviar imagens.')
    let input; try { input = await readJson(req, 4300000) } catch { return fail(400, 'Imagem inválida ou muito grande.') }
    if (!uuid.test(input?.cafeId ?? '')) return fail(400, 'Unidade inválida.')
    try {
      const check = await fetch(new URL('/rest/v1/rpc/list_my_cafes', url), { method: 'POST', headers: { apikey: key, authorization, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(8000) })
      if (!check.ok) return fail(check.status === 401 || check.status === 403 ? 403 : 503, 'Não foi possível verificar o acesso.')
      const cafes = await check.json(); if (!Array.isArray(cafes) || !cafes.some((c) => c.id === input.cafeId)) return fail(403, 'Você não tem acesso a esta unidade.')
      if (input.action === 'preview') {
        const match = keyPattern.exec(input.key ?? '')
        if (!match || match[1] !== input.cafeId || !uuid.test(match[2])) return fail(400, 'Imagem inválida.')
        const signed = await fetch(new URL(`/storage/v1/object/sign/coffe-menu-media/${input.key}`, url), { method: 'POST', headers: { apikey: key, authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 300 }), signal: AbortSignal.timeout(10000) })
        if (!signed.ok) return fail(404, 'Imagem não encontrada.')
        const data = await signed.json()
        if (typeof data.signedURL !== 'string' || !data.signedURL.startsWith('/object/sign/coffe-menu-media/')) return fail(502, 'Imagem indisponível.')
        res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ url: new URL(`/storage/v1${data.signedURL}`, url).href }))
      }
      if (typeof input?.data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.data)) return fail(400, 'Imagem inválida.')
      const bytes = Buffer.from(input.data, 'base64'); const ext = sniff(bytes)
      if (!ext || bytes.length > 3145728 || bytes.length < 12 || mime[ext] !== input.type) return fail(400, 'Envie uma imagem JPG, PNG ou WebP de até 3 MB.')
      const path = `${input.cafeId}/${randomUUID()}.${ext}`
      const upstream = await fetch(new URL(`/storage/v1/object/coffe-menu-media/${path}`, url), { method: 'POST', headers: { apikey: key, authorization, 'Content-Type': mime[ext], 'x-upsert': 'false' }, body: bytes, signal: AbortSignal.timeout(15000) })
      if (!upstream.ok) return fail(502, 'Não foi possível enviar a imagem.')
      res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ key: path }))
    } catch { return fail(503, 'Não foi possível enviar a imagem.') }
  }
  if (req.method === 'GET') {
    const params = new URL(req.url, 'http://localhost').searchParams; const slug = params.get('slug'); const path = params.get('key'); const match = keyPattern.exec(path ?? '')
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80 || !match || !uuid.test(match[1]) || !uuid.test(match[2])) return fail(400, 'Imagem inválida.')
    try {
      const menu = await fetch(new URL('/rest/v1/rpc/get_published_menu', url), { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_slug: slug }), signal: AbortSignal.timeout(8000) })
      if (!menu.ok) return fail(503, 'Imagens indisponíveis.')
      const data = await menu.json()
      if (!data?.menu || data?.cafe?.id !== match[1] || !containsKey(data.menu, path)) return fail(404, 'Imagem não encontrada.')
      const upstream = await fetch(new URL(`/storage/v1/object/authenticated/coffe-menu-media/${path}`, url), { headers: { apikey: key }, signal: AbortSignal.timeout(10000) })
      if (!upstream.ok) return fail(404, 'Imagem não encontrada.')
      const bytes = Buffer.from(await upstream.arrayBuffer()); if (bytes.length > 3145728 || sniff(bytes) !== match[3].toLowerCase()) return fail(502, 'Imagem inválida.')
      res.setHeader('Content-Type', mime[match[3].toLowerCase()]); res.setHeader('X-Content-Type-Options', 'nosniff'); return res.end(bytes)
    } catch { return fail(503, 'Imagens indisponíveis.') }
  }
  return fail(405, 'Método não permitido.')
}


