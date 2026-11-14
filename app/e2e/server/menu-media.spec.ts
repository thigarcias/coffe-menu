import { test, expect } from '@playwright/test'
import { handleMenuMedia } from '../../server/menuMedia.mjs'
import { handlePublicMenu } from '../../server/menuPublic.mjs'
function response() { return { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v }, end(body) { this.body = body } } }
test('imagens privadas não são servidas quando não pertencem à versão publicada', async () => {
  const old = { ...process.env }; const fetchBefore = globalThis.fetch
  process.env.SUPABASE_URL = 'https://example.test'; process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable'; process.env.SUPABASE_SECRET_KEY = 'secret'
  let calls = 0; globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ cafe: { id: '11111111-1111-1111-1111-111111111111' }, menu: { items: [] } })) }
  try {
    const res = response(); await handleMenuMedia({ method: 'GET', url: '/api/menu-media?slug=cafe&key=11111111-1111-1111-1111-111111111111%2F22222222-2222-2222-2222-222222222222.jpg' }, res)
    expect(res.statusCode).toBe(404); expect(calls).toBe(1)
  } finally { globalThis.fetch = fetchBefore; process.env.SUPABASE_URL = old.SUPABASE_URL; process.env.SUPABASE_PUBLISHABLE_KEY = old.SUPABASE_PUBLISHABLE_KEY; process.env.SUPABASE_SECRET_KEY = old.SUPABASE_SECRET_KEY }
})
test('consulta pública recusa slug inválido antes de acessar o banco', async () => {
  const res = response(); await handlePublicMenu({ method: 'GET', url: '/api/menu-public?slug=..%2Fadmin' }, res)
  expect(res.statusCode).toBe(400)
})


test('cardápio publicado mantém foto e vídeo do próprio app e converte só as fotos enviadas pelo editor', async () => {
  const old = { ...process.env }; const fetchBefore = globalThis.fetch
  process.env.SUPABASE_URL = 'https://example.test'; process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable'
  const own = '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg'
  const items = [
    { id: 'a', image: 'menu/avela-caramelo-latte.jpg', video: 'video/cappuccino-tradicional.mp4' },
    { id: 'b', image: own },
    { id: 'c', image: 'menu/../../etc/passwd', video: 'http://evil.test/x.mp4' },
    { id: 'd', image: 'https://evil.test/x.jpg', video: own },
  ]
  globalThis.fetch = async () => new Response(JSON.stringify({ cafe: { id: 'x' }, menu: { items, cafe: {} } }))
  try {
    const res = response(); await handlePublicMenu({ method: 'GET', url: '/api/menu-public?slug=cafe-teste' }, res)
    const out = JSON.parse(res.body).menu.items
    expect(out[0]).toMatchObject({ image: '/menu/avela-caramelo-latte.jpg', video: '/video/cappuccino-tradicional.mp4' })
    expect(out[1].image).toBe(`/api/menu-media?slug=cafe-teste&key=${encodeURIComponent(own)}`)
    expect(out[2].image).toBeNull(); expect('video' in out[2]).toBe(false) // caminho com .. e vídeo externo não passam
    expect(out[3].image).toBeNull(); expect('video' in out[3]).toBe(false)
  } finally { globalThis.fetch = fetchBefore; process.env.SUPABASE_URL = old.SUPABASE_URL; process.env.SUPABASE_PUBLISHABLE_KEY = old.SUPABASE_PUBLISHABLE_KEY }
})
