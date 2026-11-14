import { satLight, toHex } from '../../shared/color.mjs'

export interface Extracted {
  /** cores dominantes da imagem, as mais marcantes primeiro */
  colors: string[]
  /** a imagem reduzida (JPEG), para a IA enxergar o clima da marca */
  preview: string
}

const MAX_SIDE = 512

/** Distância simples entre duas cores (quanto maior, mais diferentes). */
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/**
 * Lê as cores que mais marcam uma imagem. Agrupa os pixels em "baldes" de cor e ordena por
 * quanto aparecem, dando mais peso às cores vivas (logo e post costumam ter fundo branco ou
 * preto, que não dizem nada da marca). Roda só no navegador; nada sai daqui.
 */
export async function extractColors(file: Blob): Promise<Extracted> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h) // PNG transparente vira fundo branco, não preto
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const preview = canvas.toDataURL('image/jpeg', 0.72)

  const { data } = ctx.getImageData(0, 0, w, h)
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4)
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    e.n++
    e.r += data[i]
    e.g += data[i + 1]
    e.b += data[i + 2]
    buckets.set(key, e)
  }
  const scored = [...buckets.values()].map((e) => {
    const rgb = [e.r / e.n, e.g / e.n, e.b / e.n]
    const hex = toHex(rgb)
    const { sat, light } = satLight(hex)
    // cor viva e nem muito clara nem muito escura pesa mais
    const weight = e.n * (0.25 + sat * 1.5)
    return { rgb, hex, weight, plain: light > 0.93 || light < 0.07 }
  })
  scored.sort((a, b) => b.weight - a.weight)
  // branco e preto quase puros são fundo e texto, não a marca: só entram se a imagem não tiver mais nada
  const useful = scored.filter((c) => !c.plain)
  const picked: typeof scored = []
  for (const c of useful.length ? useful : scored) {
    if (picked.every((p) => dist(p.rgb, c.rgb) > 48)) picked.push(c)
    if (picked.length >= 6) break
  }
  return { colors: picked.map((p) => p.hex), preview }
}
