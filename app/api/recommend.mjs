// Função serverless da Vercel: POST /api/recommend (mesma lógica do servidor local).
// Na Vercel, configure só OPENAI_API_KEY em Settings → Environment Variables.
import menu from '../src/data/menu.json' with { type: 'json' }
import { handleRecommend } from '../server/ai.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Allow', 'POST')
    return res.end()
  }
  return handleRecommend(req, res, menu)
}
