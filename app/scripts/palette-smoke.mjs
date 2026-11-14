// Chama o GPT-6 Luna de verdade para sugerir paletas a partir de uma imagem.
// Uso: node scripts/palette-smoke.mjs caminho/da/imagem.png "#6b3fa0,#e8892b"
// (no ambiente de nuvem: NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt OPENAI_API_KEY=proxy-injected)
import { readFile } from 'node:fs/promises'
import { runPalette } from '../server/adminPalette.mjs'

const [file, list = '#6b3fa0,#e8892b'] = process.argv.slice(2)
const buf = await readFile(file)
const mime = file.endsWith('.png') ? 'png' : file.endsWith('.webp') ? 'webp' : 'jpeg'
const images = [`data:image/${mime};base64,${buf.toString('base64')}`]
const t = Date.now()
const r = await runPalette({ colors: list.split(',').map((hex) => ({ hex })), images })
console.log(`${Date.now() - t} ms`, JSON.stringify(r, null, 2))
