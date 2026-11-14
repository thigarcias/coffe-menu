/**
 * Tema do cardápio: transforma a marca da cafeteria (`cafe.branding`) em variáveis CSS.
 *
 * O dono escolhe um tema pronto ou ajusta cada cor. Cores que faltam são derivadas da cor
 * principal, então um cardápio salvo só com "principal" também ganha fundo e chips na mesma família.
 * Toda cor vem de fora (banco), então só entra no CSS se for #RRGGBB.
 */
export interface ThemeBranding {
  theme?: string | null
  accent_color?: string | null
  secondary_color?: string | null
  background_color?: string | null
  soft_color?: string | null
}

export interface ThemePreset {
  id: string
  name: string
  accent: string
  secondary: string
  background: string
  soft: string
}

export const HEX = /^#[0-9a-fA-F]{6}$/

export const THEMES: ThemePreset[] = [
  { id: 'matcha', name: 'Matcha', accent: '#4f7f64', secondary: '#b07a45', background: '#f5efe6', soft: '#dcebe2' },
  { id: 'uva', name: 'Uva', accent: '#6b3fa0', secondary: '#c0762f', background: '#f5f0f9', soft: '#e7dcf4' },
  { id: 'cereja', name: 'Cereja', accent: '#b3263e', secondary: '#8a5a44', background: '#faf0ee', soft: '#f7d9de' },
  { id: 'oceano', name: 'Oceano', accent: '#1b6683', secondary: '#b9772a', background: '#eef4f6', soft: '#d4e7ef' },
  { id: 'cacau', name: 'Cacau', accent: '#6b4226', secondary: '#a86f2b', background: '#f4ece3', soft: '#ead9c6' },
  { id: 'rose', name: 'Rosé', accent: '#a63a60', secondary: '#8f6b3a', background: '#fbf0f3', soft: '#f6dbe4' },
  { id: 'tangerina', name: 'Tangerina', accent: '#a34410', secondary: '#55774a', background: '#fbf1e8', soft: '#f8dcc6' },
  { id: 'grafite', name: 'Grafite', accent: '#3d4a5c', secondary: '#a8741f', background: '#f1f2f4', soft: '#dde1e8' },
]

export const THEME_FIELDS = ['accent_color', 'secondary_color', 'background_color', 'soft_color'] as const
export type ThemeField = (typeof THEME_FIELDS)[number]

const hex = (v: unknown): string | null => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : null)

const rgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
const toHex = (c: number[]) => '#' + c.map((n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')).join('')

/** Mistura `a` com `b`: t = 0 devolve `a`, t = 1 devolve `b`. */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a)
  const y = rgb(b)
  return toHex(x.map((n, i) => n + (y[i] - n) * t))
}

const lum = (h: string) => {
  const [r, g, b] = rgb(h).map((n) => {
    const s = n / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Razão de contraste WCAG entre duas cores (1 a 21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (hi + 0.05) / (lo + 0.05)
}

export const presetOf = (id: string | null | undefined) => THEMES.find((t) => t.id === id) ?? null

export interface ThemeColors {
  accent: string
  secondary: string
  background: string
  soft: string
}

/** Cores finais do tema (null = o cardápio usa o visual padrão, sem mexer em nada). */
export function resolveTheme(b?: ThemeBranding | null): ThemeColors | null {
  if (!b) return null
  const preset = presetOf(b.theme)
  const accent = hex(b.accent_color) ?? preset?.accent ?? null
  const secondary = hex(b.secondary_color) ?? preset?.secondary ?? null
  const background = hex(b.background_color) ?? preset?.background ?? null
  const soft = hex(b.soft_color) ?? preset?.soft ?? null
  if (!accent && !secondary && !background && !soft) return null
  const base = THEMES[0]
  const a = accent ?? base.accent
  return {
    accent: a,
    secondary: secondary ?? base.secondary,
    background: background ?? (accent ? mix(base.background, a, 0.07) : base.background),
    soft: soft ?? (accent ? mix('#ffffff', a, 0.16) : base.soft),
  }
}

/** Variáveis CSS do tema, para o `style` do app. Vazio quando o dono não personalizou. */
export function themeVars(b?: ThemeBranding | null): Record<string, string> {
  const t = resolveTheme(b)
  if (!t) return {}
  const [r, g, bl] = rgb(t.background)
  return {
    '--sage': t.accent,
    '--caramel': t.secondary,
    '--bg': t.background,
    '--bg-rgb': `${r}, ${g}, ${bl}`,
    '--matcha': t.soft,
    '--blush': mix('#ffffff', t.secondary, 0.16),
    '--surface': mix(t.background, '#ffffff', 0.55),
    '--thick-fill': `color-mix(in srgb, ${mix(t.background, '#ffffff', 0.55)} 90%, transparent)`,
    '--cafe-accent': t.accent,
    '--cafe-secondary': t.secondary,
  }
}

/** Avisos de leitura: texto na cor principal sobre o fundo dos chips precisa de contraste. */
export function themeWarnings(b?: ThemeBranding | null): string[] {
  const t = resolveTheme(b)
  if (!t) return []
  const out: string[] = []
  if (contrast(t.accent, t.soft) < 3.5) out.push('A cor principal fica difícil de ler sobre a cor dos chips. Escolha uma principal mais escura ou chips mais claros.')
  if (contrast(t.accent, t.background) < 3) out.push('A cor principal tem pouco contraste com o fundo.')
  return out
}
