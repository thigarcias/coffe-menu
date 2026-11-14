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

