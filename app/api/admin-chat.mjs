// Função serverless da Vercel: POST /api/admin-chat (chat da IA do painel, resposta em NDJSON).
// Usa a mesma OPENAI_API_KEY da outra rota. O tempo máximo está em vercel.json (são 3 chamadas ao modelo).
import { handleProtectedAdminChat } from '../server/protectedAdminChat.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Allow', 'POST')
    return res.end()
  }
  return handleProtectedAdminChat(req, res)
}
