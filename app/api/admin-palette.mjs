// Função serverless da Vercel: POST /api/admin-palette (IA que sugere paletas a partir das imagens da marca).
// Mesma OPENAI_API_KEY e mesmo login de admin do chat. O tempo máximo está em vercel.json.
import { handleProtectedPalette } from '../server/protectedAdminChat.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Allow', 'POST')
    return res.end()
  }
  return handleProtectedPalette(req, res)
}
