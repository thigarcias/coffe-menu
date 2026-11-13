// Recomendação do quiz (rota POST /api/recommend). Roda só no servidor: a chave nunca vai ao navegador.
// A lógica fica em quiz.mjs; aqui só o HTTP. O modelo e o esforço fixos estão em openai.mjs.
import { recommendQuiz } from './quiz.mjs'

export { callStructured, config } from './openai.mjs'

/** Pontuação por etiquetas + escolha final pelo GPT-6 Luna (ver quiz.mjs). */
export const recommend = (input, menu) => recommendQuiz(input, menu)

/** Handler HTTP compartilhado pelo Vite (dev) e pelo servidor de produção. */
export async function handleRecommend(req, res, menu) {
  // A Vercel já entrega o corpo lido em req.body; no Vite e no Node puro, lemos o stream.
  let body = ''
  if (req.body !== undefined) body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
  else for await (const chunk of req) body += chunk
  res.setHeader('Content-Type', 'application/json')
  try {
    const out = await recommend(JSON.parse(body || '{}'), menu)
    res.end(JSON.stringify(out))
  } catch (e) {
    res.statusCode = e.status || (e.name === 'AbortError' ? 504 : 500)
    res.end(JSON.stringify({ error: e.name === 'AbortError' ? 'A IA demorou demais' : e.message }))
  }
}
