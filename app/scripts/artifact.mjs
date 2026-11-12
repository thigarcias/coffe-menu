// Gera artifact/index.html: o build do Vite com CSS e JS embutidos,
// sem doctype/html/head/body (o claude.ai envolve a página).
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs'

const dist = new URL('../dist/', import.meta.url)
const out = new URL('../artifact/', import.meta.url)
const html = readFileSync(new URL('index.html', dist), 'utf8')

const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/g)]
const js = [...html.matchAll(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/g)]
const fonts = [...html.matchAll(/<link\s[^>]*fonts\.(googleapis|gstatic)[^>]*>/gs)].map((m) => m[0].replace(/\s+/g, ' '))

const read = (p) => readFileSync(new URL(p, dist), 'utf8')
const jsCode = js.map((m) => read(m[1])).join('\n').replaceAll('</script', '<\\/script')

const page = `<title>Cardápio interativo</title>
${fonts.join('\n')}
<style>${css.map((m) => read(m[1])).join('\n')}</style>
<div id="root"></div>
<script type="module">${jsCode}</script>
`
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
writeFileSync(new URL('index.html', out), page)
cpSync(new URL('menu/', dist), new URL('menu/', out), { recursive: true })
console.log('artifact/index.html', (page.length / 1024).toFixed(0) + ' KB')
