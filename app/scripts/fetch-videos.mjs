// Baixa vídeos de demonstração da Pexels (mockup) e grava em public/video/.
// Uso: PEXELS_API_KEY=... node scripts/fetch-videos.mjs
// (na nuvem do Claude o proxy injeta a chave; qualquer valor serve)
import { writeFile, mkdir } from 'node:fs/promises'

const ITENS = {
  'cappuccino-tradicional': 'cappuccino coffee pouring',
  'cold-brew-tradicional': 'iced coffee glass',
  'caramelo-frappuccino-base-cafe': 'frappuccino whipped cream',
  'cafe-latte-gelado': 'iced latte cold beverage',
}
const key = process.env.PEXELS_API_KEY ?? 'proxy-injected'
await mkdir('public/video', { recursive: true })
const creditos = {}
for (const [id, q] of Object.entries(ITENS)) {
  const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&size=medium&per_page=5`, { headers: { Authorization: key } })
  const { videos } = await r.json()
  const v = videos.find((x) => x.duration <= 20) ?? videos[0]
  const f = v.video_files.find((x) => x.width === 540 && x.height === 960) ?? v.video_files.find((x) => x.width >= 540)
  const buf = Buffer.from(await (await fetch(f.link)).arrayBuffer())
  await writeFile(`public/video/${id}.mp4`, buf)
  creditos[id] = { pexels: v.url, autor: v.user.name, kb: Math.round(buf.length / 1024) }
  console.log(id, creditos[id])
}
await writeFile('public/video/creditos.json', JSON.stringify(creditos, null, 2))
