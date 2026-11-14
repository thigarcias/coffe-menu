import { test, expect } from '@playwright/test'
import { Readable } from 'node:stream'
import { cleanColors, fallbackPalettes, palettesFromModel, runPalette, handlePalette, MAX_IMAGES } from '../../server/adminPalette.mjs'
import { HEX, contrast } from '../../shared/color.mjs'

const colors = ['#6b3fa0', '#e8a33d', '#2d2d2d', '#f4efe8', '#3c8d5a']
const png = 'data:image/png;base64,iVBORw0KGgo='

const readable = (p: { colors: unknown; images: unknown }) => {
  const r: any = Readable.from([Buffer.from(JSON.stringify(p))])
  r.headers = {}
  return r
}
const fakeRes = () => {
  const r: any = { statusCode: 0, headers: {} as Record<string, string>, body: '', listeners: {} as any }
  r.setHeader = (k: string, v: string) => { r.headers[k] = v }
  r.end = (b: string) => { r.body = b }
  r.on = () => {}
  return r
}

test('cleanColors: só #RRGGBB, sem repetir, no máximo 12', () => {
  const out = cleanColors([{ hex: '#ABCDEF' }, { hex: '#abcdef' }, { hex: 'red' }, { hex: 'url(x)' }, { hex: '#12345' }, null, { hex: 5 }, ...Array.from({ length: 30 }, (_, i) => ({ hex: '#' + (i + 16).toString(16).padStart(2, '0').repeat(3) }))])
  expect(out[0]).toBe('#abcdef')
  expect(out.length).toBe(12)
  expect(out.every((c) => HEX.test(c))).toBe(true)
  expect(cleanColors('x')).toEqual([])
})

test('a IA só escolhe posições da lista: hex inventado ou índice fora dela é descartado', () => {
  const ok = { name: 'Fiel ao logo', note: 'Roxo do logo com fundo suave.', accent: 0, secondary: 1, mood: 'suave' }
  const out = palettesFromModel({ palettes: [
    ok,
    { ...ok, name: 'Índice fora', accent: 99 },
    { ...ok, name: 'Igual', secondary: 0 },
    { ...ok, name: '', accent: 4 },
    { ...ok, name: 'Hex inventado', accent: '#ff0000' },
  ] }, colors)
  expect(out).toHaveLength(1)
  expect(out[0].name).toBe('Fiel ao logo')
  expect(out[0].secondary).toBe('#e8a33d')
})

test('toda paleta devolvida tem hex válido e a principal lê bem sobre fundo e chips', () => {
  const out = palettesFromModel({ palettes: [0, 1, 2].map((i) => ({ name: 'P' + i, note: 'x', accent: i, secondary: 4, mood: ['suave', 'claro', 'vivo'][i] })) }, ['#f2e08a', '#6b3fa0', '#e8a33d', '#3c8d5a', '#b3263e'])
  expect(out.length).toBeGreaterThan(0)
  for (const p of out) {
    for (const c of [p.accent, p.secondary, p.background, p.soft]) expect(c).toMatch(HEX)
    expect(contrast(p.accent, p.soft)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(p.accent, p.background)).toBeGreaterThanOrEqual(4.5)
  }
})

test('texto da IA é limpo: sem tags, sem quebra, com limite', () => {
  const [p] = palettesFromModel({ palettes: [{ name: '<b>Nome</b>\n\ncompridíssimo demais para caber', note: 'a'.repeat(300) + '<script>', accent: 0, secondary: 1, mood: 'vivo' }] }, colors)
  expect(p.name).not.toMatch(/[<>\n]/)
  expect(p.name.length).toBeLessThanOrEqual(28)
  expect(p.note.length).toBeLessThanOrEqual(90)
})

test('runPalette: sempre devolve 3 paletas; sem IA usa o cálculo', async () => {
  const falha = async () => { throw new Error('fora do ar') }
  const r = await runPalette({ colors: colors.map((hex) => ({ hex })), images: [], model: falha })
  expect(r).toMatchObject({ ok: true, source: 'calculo' })
  expect((r as any).palettes).toHaveLength(3)
  const parcial = await runPalette({ colors: colors.map((hex) => ({ hex })), images: [], model: async () => ({ palettes: [{ name: 'Uma só', note: '', accent: 0, secondary: 1, mood: 'suave' }] }) })
  expect((parcial as any).palettes).toHaveLength(3)
  expect((parcial as any).source).toBe('ia+calculo')
  expect((parcial as any).palettes[0].name).toBe('Uma só')
})

test('runPalette: sem cor legível, pede outra imagem em vez de inventar', async () => {
  const r = await runPalette({ colors: [{ hex: 'nada' }], images: [], model: async () => { throw new Error('não deveria chamar') } })
  expect(r.ok).toBe(false)
})

test('a lista de cores e as imagens chegam ao modelo, e a instrução trata o texto da imagem como dado', async () => {
  let seen: any
  await runPalette({ colors: colors.map((hex) => ({ hex })), images: [png], model: async (a: any) => { seen = a; return { palettes: [] } } })
  const content = seen.input[0].content
  expect(content[0].text).toContain('0: #6b3fa0')
  expect(content[1]).toEqual({ type: 'input_image', image_url: png })
  expect(seen.instructions).toMatch(/nunca instrução/i)
  expect(seen.instructions).toMatch(/Nunca escreva códigos de cor/)
})

test('fallbackPalettes funciona até com uma cor só', () => {
  const f = fallbackPalettes(['#6b3fa0'])
  expect(f).toHaveLength(3)
  for (const p of f) expect(p.accent).toMatch(HEX)
})

test('rota: recusa imagem que não é data URL de JPG/PNG/WebP, e mais de 4 imagens', async () => {
  for (const images of [['http://x/y.png'], ['data:image/svg+xml;base64,AAAA'], ['data:text/html;base64,AAAA'], Array(MAX_IMAGES + 1).fill(png), [5]]) {
    const res = fakeRes()
    await handlePalette(readable({ colors: [], images }), res)
    expect(res.statusCode, JSON.stringify(images).slice(0, 40)).toBe(400)
  }
})

test('rota: imagem válida passa e devolve paletas', async () => {
  const res = fakeRes()
  await handlePalette(readable({ colors: colors.map((hex) => ({ hex })), images: [png] }), res, { model: async () => ({ palettes: [] }) })
  expect(res.statusCode).toBe(200)
  expect(JSON.parse(res.body).palettes).toHaveLength(3)
})
