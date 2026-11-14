import { test, expect } from '@playwright/test'
import { THEMES, HEX, contrast, mix, resolveTheme, themeVars, themeWarnings } from '../../src/lib/theme'

// O Matcha é a paleta original do cardápio (mantida como estava); os temas novos nasceram com contraste AA.
test('todo tema pronto usa só #RRGGBB e tem texto legível (principal sobre chips e fundo)', () => {
  expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length)
  for (const t of THEMES) {
    for (const c of [t.accent, t.secondary, t.background, t.soft]) expect(c, t.id).toMatch(HEX)
    if (t.id === 'matcha') continue
    expect(contrast(t.accent, t.soft), `${t.id}: principal sobre chips`).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t.accent, t.background), `${t.id}: principal sobre fundo`).toBeGreaterThanOrEqual(4.5)
    expect(themeWarnings({ theme: t.id }), t.id).toEqual([])
  }
})

test('sem marca personalizada, nada é sobrescrito (o cardápio fica no visual padrão)', () => {
  expect(themeVars(null)).toEqual({})
  expect(themeVars({})).toEqual({})
  expect(themeVars({ accent_color: null, secondary_color: null })).toEqual({})
})

test('o tema escolhido muda fundo, chips, principal e secundária de uma vez', () => {
  const v = themeVars({ theme: 'uva' })
  const uva = THEMES.find((t) => t.id === 'uva')!
  expect(v['--sage']).toBe(uva.accent)
  expect(v['--caramel']).toBe(uva.secondary)
  expect(v['--bg']).toBe(uva.background)
  expect(v['--matcha']).toBe(uva.soft)
  expect(v['--bg-rgb']).toBe('245, 240, 249')
})

test('cada cor solta ganha do tema; as que faltam vêm da principal (nada fica verde por engano)', () => {
  const only = resolveTheme({ accent_color: '#6b3fa0' })!
  expect(only.accent).toBe('#6b3fa0')
  // fundo e chips derivados da principal: nada do verde matcha
  expect(only.soft).not.toBe('#dcebe2')
  expect(only.background).not.toBe('#f5efe6')
  expect(contrast(only.accent, only.soft)).toBeGreaterThanOrEqual(4.5)
  const mixed = resolveTheme({ theme: 'uva', background_color: '#ffffff' })!
  expect(mixed.background).toBe('#ffffff')
  expect(mixed.accent).toBe(THEMES.find((t) => t.id === 'uva')!.accent)
})

test('valor que não é #RRGGBB é ignorado (CSS vindo do banco não entra no estilo)', () => {
  for (const bad of ['red', '#12345', 'red;background:url(x)', 'url(javascript:1)', '#GGGGGG', '', null, 5 as unknown as string]) {
    expect(themeVars({ accent_color: bad, background_color: bad, soft_color: bad, secondary_color: bad }), String(bad)).toEqual({})
  }
  const v = themeVars({ accent_color: '#6b3fa0', soft_color: 'red;x:y' })
  expect(Object.values(v).every((x) => !/[;{}]|url\(/.test(x))).toBe(true)
})

test('avisa quando a cor principal não lê bem sobre os chips', () => {
  expect(themeWarnings({ accent_color: '#f0e68c', soft_color: '#ffffff', background_color: '#ffffff' }).length).toBeGreaterThan(0)
  expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
})
