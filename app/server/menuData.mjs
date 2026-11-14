const allowed = new Set(['list_my_cafes', 'get_menu_editor', 'create_menu_draft', 'save_menu_draft', 'restore_menu_draft_version', 'rename_menu_draft', 'delete_menu_draft', 'publish_menu_draft', 'set_product_availability'])

export async function readJson(req, limit = 1048576) {
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    if (Buffer.byteLength(raw) > limit) throw new Error('Payload too large')
    return JSON.parse(raw)
  }
  const chunks = []; let size = 0
  for await (const chunk of req) { size += chunk.length; if (size > limit) throw new Error('Payload too large'); chunks.push(chunk) }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export async function handleMenuData(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  const fail = (status, message) => { res.statusCode = status; return res.end(JSON.stringify({ message })) }
  if (req.method !== 'POST') return fail(405, 'Método não permitido.')
  const authorization = req.headers.authorization
  if (!/^Bearer [^\s]+$/.test(authorization ?? '')) return fail(401, 'Entre novamente para acessar o cardápio.')
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return fail(503, 'Editor indisponível no momento.')
  let body
  try { body = await readJson(req) } catch { return fail(400, 'Dados inválidos.') }
  if (!body || !allowed.has(body.rpc) || !body.args || typeof body.args !== 'object' || Array.isArray(body.args)) return fail(400, 'Operação inválida.')
  try {
    const response = await fetch(new URL(`/rest/v1/rpc/${body.rpc}`, url), {
      method: 'POST', headers: { apikey: key, authorization, 'Content-Type': 'application/json' }, body: JSON.stringify(body.args), signal: AbortSignal.timeout(15000),
    })
    const text = await response.text()
    if (!response.ok) {
      let upstream; try { upstream = JSON.parse(text) } catch { /* sem detalhes */ }
      if (response.status === 401 || response.status === 403 || upstream?.code === '42501') return fail(403, 'Você não tem acesso a esta unidade.')
      if (upstream?.code === '40001' || upstream?.code === 'PT409') return fail(409, 'Este rascunho foi alterado. Atualize a página antes de salvar.')
      if (response.status >= 400 && response.status < 500) return fail(400, 'Não foi possível concluir. Revise os dados e tente novamente.')
      return fail(502, 'Editor indisponível no momento.')
    }
    res.statusCode = response.status
    return res.end(text || 'null')
  } catch { return fail(503, 'Editor indisponível no momento.') }
}

