import { test, expect } from '@playwright/test'
import { createLimiter, clientIp } from '../../server/rateLimit.mjs'
import { handleAuth, passwordLimiter } from '../../server/auth.mjs'
import { handleMenuMedia, clearMediaCache } from '../../server/menuMedia.mjs'

const response = () => ({ statusCode: 200, headers: {} as Record<string, string>, setHeader(k: string, v: string) { this.headers[k] = v }, end(body?: unknown) { (this as any).body = body } })

test('limitador libera de novo depois da janela e conta por IP', () => {
  const limited = createLimiter({ max: 2, windowMs: 1000 })
  expect(limited('a', 0)).toBe(0)
  expect(limited('a', 100)).toBe(0)
  expect(limited('a', 200)).toBeGreaterThan(0)
  expect(limited('b', 200)).toBe(0)
  expect(limited('a', 1500)).toBe(0)
})

test('clientIp usa o primeiro endereço do x-forwarded-for e aguenta pedido sem cabeçalhos', () => {
  expect(clientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 9.9.9.9' } })).toBe('1.2.3.4')
  expect(clientIp({})).toBe('desconhecido')
})

test('login por senha é limitado a 10 tentativas; renovar sessão não conta', async () => {
  const old = { ...process.env }; const before = globalThis.fetch
  process.env.SUPABASE_URL = 'https://example.test'; process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable'
  globalThis.fetch = async () => new Response('{}', { status: 400, headers: { 'content-type': 'application/json' } })
  try {
    const call = (grant: string, ip = '7.7.7.7') => { const res = response(); const req = { method: 'POST', url: `/auth/v1/token?grant_type=${grant}`, headers: { 'x-forwarded-for': ip, 'content-type': 'application/json' }, body: '{}' }; return handleAuth(req, res).then(() => res) }
    for (let i = 0; i < 10; i++) expect((await call('password')).statusCode).toBe(400)
    const blocked = await call('password')
    expect(blocked.statusCode).toBe(429)
    expect(Number(blocked.headers['Retry-After'])).toBeGreaterThan(0)
    expect((await call('refresh_token')).statusCode).toBe(400)
    expect((await call('password', '8.8.8.8')).statusCode).toBe(400)
  } finally { globalThis.fetch = before; process.env.SUPABASE_URL = old.SUPABASE_URL; process.env.SUPABASE_PUBLISHABLE_KEY = old.SUPABASE_PUBLISHABLE_KEY; void passwordLimiter }
})

test('foto publicada: guarda a consulta do cardápio por um tempo e deixa a foto em cache', async () => {
  const old = { ...process.env }; const before = globalThis.fetch
  process.env.SUPABASE_URL = 'https://example.test'; process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable'
  const cafe = '11111111-1111-4111-8111-111111111111'; const file = '22222222-2222-4222-8222-222222222222'
  const key = `${cafe}/${file}.png`
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0])
  let rpc = 0
  globalThis.fetch = async (input: any) => {
    if (String(input).includes('/rpc/get_published_menu')) { rpc++; return new Response(JSON.stringify({ cafe: { id: cafe }, menu: { items: [{ image: key }] } })) }
    return new Response(png)
  }
  clearMediaCache()
  try {
    const get = () => { const res = response(); return handleMenuMedia({ method: 'GET', url: `/api/menu-media?slug=cafe-x&key=${encodeURIComponent(key)}`, headers: { 'x-forwarded-for': '5.5.5.5' } }, res).then(() => res) }
    const a = await get(); const b = await get()
    expect(a.statusCode).toBe(200); expect(b.statusCode).toBe(200)
    expect(rpc).toBe(1)
    expect(a.headers['Cache-Control']).toContain('max-age=3600')
  } finally { globalThis.fetch = before; process.env.SUPABASE_URL = old.SUPABASE_URL; process.env.SUPABASE_PUBLISHABLE_KEY = old.SUPABASE_PUBLISHABLE_KEY; clearMediaCache() }
})
