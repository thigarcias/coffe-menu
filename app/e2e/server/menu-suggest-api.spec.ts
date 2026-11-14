import { test, expect } from '@playwright/test'
import { handleMenuSuggest } from '../../server/menuSuggestApi.mjs'
function response() { return { statusCode: 200, setHeader() {}, end(body) { this.body = body } } }
test('sugestões não são oferecidas para unidade de outro proprietário', async () => {
  const env = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_PUBLISHABLE_KEY }
  const oldFetch = globalThis.fetch; process.env.SUPABASE_URL = 'https://example.test'; process.env.SUPABASE_PUBLISHABLE_KEY = 'key'
  let calls = 0; globalThis.fetch = async () => { calls++; return new Response(JSON.stringify([]), { status: 200 }) }
  try {
    const res = response()
    await handleMenuSuggest({ method: 'POST', headers: { authorization: 'Bearer usuario' }, body: { cafeId: '11111111-1111-1111-1111-111111111111', product: { name: 'Café', description: '', ingredients: [] } } }, res)
    expect(res.statusCode).toBe(403); expect(calls).toBe(1)
  } finally { globalThis.fetch = oldFetch; if (env.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = env.url; if (env.key === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = env.key }
})

