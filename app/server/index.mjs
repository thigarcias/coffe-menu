// Servidor de produção: serve o build (dist/) e as rotas /api/recommend e /api/admin-chat.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { handleRecommend } from './ai.mjs'
import { handleProtectedAdminChat, handleProtectedPersonalize, handleProtectedPalette } from './protectedAdminChat.mjs'
import { handleAuth } from './auth.mjs'
import { handlePublicMenu } from './menuPublic.mjs'
import { handleMenuData } from './menuData.mjs'
import { handleMenuSuggest } from './menuSuggestApi.mjs'
import { handleMenuMedia } from './menuMedia.mjs'
import { fileURLToPath } from 'node:url'

try { process.loadEnvFile(new URL('../.env', import.meta.url)) } catch { /* sem .env: usa o ambiente */ }

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const menu = JSON.parse(await readFile(new URL('../src/data/menu.json', import.meta.url), 'utf8'))
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' }

createServer(async (req, res) => {
  if (req.url.startsWith('/api/menu-public')) return handlePublicMenu(req, res)
  if (req.url.startsWith('/api/menu-data')) return handleMenuData(req, res)
  if (req.url.startsWith('/api/menu-suggest')) return handleMenuSuggest(req, res)
  if (req.url.startsWith('/api/menu-media')) return handleMenuMedia(req, res)
  if (req.method === 'POST' && req.url === '/api/recommend') return handleRecommend(req, res, menu)
  if (req.url.startsWith('/auth/v1/')) return handleAuth(req, res)
  if (req.method === 'POST' && req.url === '/api/admin-chat') return handleProtectedAdminChat(req, res)
  if (req.method === 'POST' && req.url === '/api/admin-personalize') return handleProtectedPersonalize(req, res)
  if (req.method === 'POST' && req.url === '/api/admin-palette') return handleProtectedPalette(req, res)
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '')
  const file = join(root, (/^[/\\]admin[/\\]?$/.test(path) || /^[/\\]c[/\\][a-z0-9-]+[/\\]?$/.test(path) || path.endsWith('/')) ? 'index.html' : path)
  try {
    const data = await readFile(file)
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream')
    res.end(data)
  } catch {
    res.statusCode = 404
    res.end('not found')
  }
}).listen(process.env.PORT || 3000, () => console.log(`http://localhost:${process.env.PORT || 3000}`))

