// Matemática de cor usada pelo navegador (tema) e pelo servidor (paletas sugeridas pela IA).
export const HEX = /^#[0-9a-fA-F]{6}$/

export const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
export const toHex = (c) => '#' + c.map((n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')).join('')

/** Mistura `a` com `b`: t = 0 devolve `a`, t = 1 devolve `b`. */
export function mix(a, b, t) {
  const x = rgb(a)
  const y = rgb(b)
  return toHex(x.map((n, i) => n + (y[i] - n) * t))
}

const lum = (h) => {
  const [r, g, b] = rgb(h).map((n) => {
    const s = n / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Razão de contraste WCAG entre duas cores (1 a 21). */
export function contrast(a, b) {
  const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (hi + 0.05) / (lo + 0.05)
}

/** Saturação (0 a 1) e claridade (0 a 1) no modelo HSL. */
export function satLight(h) {
  const [r, g, b] = rgb(h).map((n) => n / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  return { sat: d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), light: l }
}

/** Escurece `color` aos poucos até ele ler bem (contraste mínimo) sobre todas as cores de `against`. */
export function ensureContrast(color, against, min = 4.5) {
  let c = color
  for (let i = 0; i < 40 && against.some((bg) => contrast(c, bg) < min); i++) c = mix(c, '#000000', 0.06)
  return c
}

const CREAM = '#f5efe6'
export const MOODS = ['suave', 'claro', 'vivo']

/** Monta as 4 cores do tema a partir da principal e da secundária. Fundo e chips são derivados; o texto sempre lê. */
export function buildPalette(accent, secondary, mood = 'suave') {
  const m = MOODS.includes(mood) ? mood : 'suave'
  const background = m === 'claro' ? mix('#ffffff', accent, 0.04) : mix(CREAM, accent, m === 'vivo' ? 0.12 : 0.07)
  const soft = mix('#ffffff', accent, m === 'vivo' ? 0.22 : 0.16)
  const a = ensureContrast(accent, [soft, background])
  return { accent: a, secondary, background, soft }
}
