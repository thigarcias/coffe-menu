import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv, type Plugin } from 'vite'
// @ts-expect-error módulo JS do servidor, sem tipos
import { handleRecommend } from './server/ai.mjs'
// @ts-expect-error módulo JS do servidor, sem tipos
import { handleProtectedAdminChat } from './server/protectedAdminChat.mjs'
// @ts-expect-error módulo JS do servidor, sem tipos
import { handleAuth } from './server/auth.mjs'
// @ts-expect-error módulo JS do servidor, sem tipos
import { handlePublicMenu } from './server/menuPublic.mjs'
// @ts-expect-error módulo JS do servidor, sem tipos
import { handleMenuData } from './server/menuData.mjs'
// @ts-expect-error módulo JS do servidor, sem tipos
import { handleMenuSuggest } from './server/menuSuggestApi.mjs'
// @ts-expect-error módulo JS do servidor, sem tipos
import { handleMenuMedia } from './server/menuMedia.mjs'

/** Expõe /api/recommend e /api/admin-chat no `npm run dev` e no `vite preview`, com a chave lida do .env (só no servidor). */
function aiApi(): Plugin {
  function authApi(server: { config: { mode: string }; middlewares: import('vite').Connect.Server }) {
    const env = loadEnv(server.config.mode, process.cwd(), '')
    for (const key of ['OPENAI_API_KEY', 'SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY']) {
      if (env[key] && !process.env[key]) process.env[key] = env[key]
    }
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/auth/v1/')) return void handleAuth(req, res)
      if (req.url?.startsWith('/api/menu-public')) return void handlePublicMenu(req, res)
      if (req.url?.startsWith('/api/menu-data')) return void handleMenuData(req, res)
      if (req.url?.startsWith('/api/menu-suggest')) return void handleMenuSuggest(req, res)
      if (req.url?.startsWith('/api/menu-media')) return void handleMenuMedia(req, res)
      next()
    })
  }

  return {
    name: 'ai-api',
    configurePreviewServer(server) {
      authApi(server)
      server.middlewares.use('/api/admin-chat', (req, res, next) => {
        if (req.method !== 'POST') return next()
        void handleProtectedAdminChat(req, res)
      })
    },
    configureServer(server) {
      authApi(server)
      server.middlewares.use('/api/admin-chat', (req, res, next) => {
        if (req.method !== 'POST') return next()
        void handleProtectedAdminChat(req, res)
      })
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

