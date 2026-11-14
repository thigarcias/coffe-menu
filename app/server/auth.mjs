// Proxy de Auth: a chave publishable fica configurada apenas no servidor.
import { clientIp, createLimiter } from './rateLimit.mjs'
// 10 tentativas de senha a cada 5 minutos por IP (renovar sessão não conta)
export const passwordLimiter = createLimiter({ max: 10, windowMs: 5 * 60 * 1000 })
export async function handleAuth(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const incoming = new URL(req.url, 'http://localhost')
  const path = incoming.pathname === '/api/auth'
    ? incoming.searchParams.get('auth_path')
    : incoming.pathname.slice('/auth/v1/'.length)
  const grantType = incoming.searchParams.get('grant_type')
  const tokenRequest = path === 'token' && ['password', 'refresh_token'].includes(grantType)
  if (req.method !== 'POST' || (!tokenRequest && path !== 'logout')) {
    res.statusCode = 404
    return res.end()
  }

  if (grantType === 'password' && path === 'token') {
    const wait = passwordLimiter(clientIp(req))
    if (wait) {
      res.statusCode = 429
      res.setHeader('Retry-After', String(wait))
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ message: 'Muitas tentativas de entrada. Aguarde alguns minutos e tente de novo.' }))
    }
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return unavailable(res, 503)

  const headers = { apikey: key }
  for (const name of ['content-type', 'authorization', 'x-client-info', 'x-supabase-api-version']) {
    if (req.headers[name]) headers[name] = req.headers[name]
  }
  if (headers.authorization === 'Bearer auth-proxy') delete headers.authorization
  try {
    const target = new URL(`/auth/v1/${path}`, url)
    if (tokenRequest) target.searchParams.set('grant_type', grantType)
    else target.searchParams.set('scope', 'local')

    let body
    if (tokenRequest) {
      if (req.body !== undefined) body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      else {
        const chunks = []
        let size = 0
        for await (const chunk of req) { size += chunk.length; if (size > 65536) { res.statusCode = 413; return res.end() }; chunks.push(chunk) }
        body = Buffer.concat(chunks)
      }
    }
    const response = await fetch(target, { method: req.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(10000) })
    res.statusCode = response.status
    for (const name of ['content-type', 'retry-after']) {
      const value = response.headers.get(name)
      if (value) res.setHeader(name, value)
    }
    return res.end(Buffer.from(await response.arrayBuffer()))
  } catch { return unavailable(res, 502) }
}

function unavailable(res, status) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  return res.end(JSON.stringify({ message: 'Serviço de autenticação indisponível.' }))
}
