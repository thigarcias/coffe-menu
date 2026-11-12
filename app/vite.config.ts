import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv, type Plugin } from 'vite'
// @ts-expect-error módulo JS do servidor, sem tipos
import { handleRecommend } from './server/ai.mjs'

/** Expõe /api/recommend no `npm run dev`, com a chave lida do .env (só no servidor). */
function aiApi(): Plugin {
  return {
    name: 'ai-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      for (const k of ['OPENAI_API_KEY']) {
        if (env[k] && !process.env[k]) process.env[k] = env[k]
      }
      server.middlewares.use('/api/recommend', (req, res, next) => {
        if (req.method !== 'POST') return next()
        const menu = JSON.parse(readFileSync('src/data/menu.json', 'utf8'))
        void handleRecommend(req, res, menu)
      })
    },
  }
}

// base relativo: o build abre em qualquer pasta (e como Artifact do claude.ai)
export default defineConfig({
  base: './',
  plugins: [react(), aiApi()],
})
