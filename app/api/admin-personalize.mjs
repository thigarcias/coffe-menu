// Função serverless da Vercel: POST /api/admin-personalize (IA que personaliza uma seção do painel).
// Mesma OPENAI_API_KEY e mesmo login de admin do chat. O tempo máximo está em vercel.json.
import { handleProtectedPersonalize } from '../server/protectedAdminChat.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Allow', 'POST')
    return res.end()
  }
  return handleProtectedPersonalize(req, res)
}
