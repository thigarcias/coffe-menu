import { test, expect } from '@playwright/test'
import { handleMenuData } from '../../server/menuData.mjs'

function response() { return { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v }, end(text) { this.body = text } } }
test('bloqueia chamadas sem sessão antes de consultar o banco', async () => {
  const res = response()
  await handleMenuData({ method: 'POST', headers: {}, body: { rpc: 'list_my_cafes', args: {} } }, res)
  expect(res.statusCode).toBe(401)
})
test('recusa chamadas arbitrárias mesmo quando há uma sessão', async () => {
  const previous = process.env.SUPABASE_URL; const key = process.env.SUPABASE_PUBLISHABLE_KEY
  process.env.SUPABASE_URL = 'https://example.test'; process.env.SUPABASE_PUBLISHABLE_KEY = 'key'
  try {
    const res = response()
    await handleMenuData({ method: 'POST', headers: { authorization: 'Bearer valid' }, body: { rpc: 'execute_sql', args: {} } }, res)
    expect(res.statusCode).toBe(400)
  } finally { if (previous === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous; if (key === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = key }
})
test('o proxy encaminha o JWT do usuário e não substitui a autorização do banco', async () => {
  const previous = process.env.SUPABASE_URL; const key = process.env.SUPABASE_PUBLISHABLE_KEY; const originalFetch = globalThis.fetch
  process.env.SUPABASE_URL = 'https://example.test'; process.env.SUPABASE_PUBLISHABLE_KEY = 'key'
  let forwarded = ''
  globalThis.fetch = async (_url, options) => { forwarded = options.headers.authorization; return new Response(JSON.stringify({ code: '42501' }), { status: 403 }) }
  try {
    const res = response()
    await handleMenuData({ method: 'POST', headers: { authorization: 'Bearer usuario' }, body: { rpc: 'get_menu_editor', args: { p_cafe_id: 'id-de-outra-unidade' } } }, res)
    expect(forwarded).toBe('Bearer usuario'); expect(res.statusCode).toBe(403)
  } finally { globalThis.fetch = originalFetch; if (previous === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous; if (key === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = key }
})

