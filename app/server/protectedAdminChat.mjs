import { handleAdminChat } from './adminChat.mjs'

export async function handleProtectedAdminChat(req, res) {
  const authorization = req.headers.authorization
  if (!/^Bearer [^\s]+$/.test(authorization ?? '')) {
    return reject(res, 401, 'Entre no painel para usar o chat.')
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
  const unavailable = () => reject(res, 503, 'O acesso ao painel está indisponível no momento.')
  if (!url || !key) return unavailable()

  let user
  try {
    const response = await fetch(new URL('/auth/v1/user', url), {
      headers: { apikey: key, authorization },
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    })
    if ([401, 403].includes(response.status)) return reject(res, 401, 'Entre novamente para usar o chat.')
    if (!response.ok) return unavailable()
    user = await response.json()
  } catch {
    return unavailable()
  }

  if (user?.app_metadata?.coffe_admin !== true || user.is_anonymous) {
    return reject(res, 403, 'Esta conta ainda não tem acesso ao painel.')
  }
  return handleAdminChat(req, res)
}

function reject(res, status, error) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  return res.end(JSON.stringify({ error }))
}
