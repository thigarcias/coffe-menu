import { test } from './adminSession'
import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const menu = JSON.parse(readFileSync(new URL('../src/data/menu.json', import.meta.url), 'utf8'))

const cafe = { id: '11111111-1111-4111-8111-111111111111', slug: 'cafe-teste', name: 'Café Teste' }
const categories = menu.categories.slice(1, 3)
const items = menu.items.filter((item: any) => categories.some((category: any) => category.id === item.category)).slice(0, 6)
const draftMenu = { ...menu, categories, items, cafe: { ...menu.cafe, name: 'Café Teste', slug: 'cafe-teste' } }
const draft = { id: 'd1', name: 'Cardápio de verão', current_version: 3, current_version_id: 'v3', created_at: '2026-11-10T12:00:00Z', updated_at: '2026-11-13T12:00:00Z', menu: draftMenu, versions: [{ id: 'v3', version: 3, saved_at: '2026-11-13T12:00:00Z' }] }
const published = { publication_id: 'p1', draft_id: 'd1', draft_name: 'Cardápio de verão', version_id: 'v3', version: 3, published_at: '2026-11-13T12:00:00Z', menu: draftMenu }

type Call = { rpc: string; args: Record<string, any> }

async function openEditor(page: Page, opts: { stock?: Record<string, unknown>; fill?: unknown } = {}) {
  const calls: Call[] = []
  const availability = { ...(opts.stock ?? {}) }
  await page.route('**/api/menu-data', async (route) => {
    const request = route.request().postDataJSON()
    calls.push({ rpc: request.rpc, args: request.args ?? {} })
    if (request.rpc === 'list_my_cafes') return route.fulfill({ json: [cafe] })
    if (request.rpc === 'get_menu_editor') return route.fulfill({ json: { cafe, drafts: [draft], published, publications: [], availability } })
    if (request.rpc === 'set_product_stock') {
      availability[request.args.p_product_id] = { available: request.args.p_available && request.args.p_quantity !== 0, quantity: request.args.p_quantity, note: null }
      return route.fulfill({ json: {} })
    }
    if (request.rpc === 'save_menu_draft') return route.fulfill({ json: { draft_id: 'd1', version: 4, version_id: 'v4' } })
    return route.fulfill({ json: {} })
  })
  await page.route('**/api/menu-suggest', async (route) => route.fulfill({ json: opts.fill ?? { name: '', description: '', lookalike: '', ingredients: [], allergens: [], labels: [], newLabels: [], tags: {}, allergensVerified: false } }))
  await page.goto('/admin#cardapio')
  await expect(page.getByRole('heading', { name: 'Cardápio de verão' })).toBeVisible()
  return calls
}


async function openBrand(page: Page) {
  const calls = await openEditor(page)
  await page.getByRole('tab', { name: 'Marca', exact: true }).click()
  await expect(page.locator('.menu-editor__phone .app')).toBeVisible()
  return calls
}
const phoneVar = (page: Page, name: string) => page.locator('.menu-editor__phone .app').evaluate((el, n) => getComputedStyle(el).getPropertyValue(n).trim(), name)

test('marca: escolher um tema muda o cardápio inteiro na prévia ao lado, fundo e chips incluídos', async ({ page }) => {
  await openBrand(page)
  expect(await phoneVar(page, '--matcha')).toBe('#dcebe2')
  await page.getByRole('button', { name: 'Uva', exact: true }).click()
  expect(await phoneVar(page, '--sage')).toBe('#6b3fa0')
  expect(await phoneVar(page, '--bg')).toBe('#f5f0f9')
  expect(await phoneVar(page, '--matcha')).toBe('#e7dcf4')
  const bg = await page.locator('.menu-editor__phone .app').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(bg).toBe('rgb(245, 240, 249)')
  await expect(page.getByRole('button', { name: 'Uva', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Tema Uva')).toBeVisible()
})

test('marca: ajustar uma cor solta vira "personalizado" e muda só aquela parte', async ({ page }) => {
  await openBrand(page)
  await page.getByRole('button', { name: 'Cereja', exact: true }).click()
  await page.getByText('Ajustar cada cor').click()
  await page.getByLabel('Código da cor fundo').fill('#ffffff')
  expect(await phoneVar(page, '--bg')).toBe('#ffffff')
  expect(await phoneVar(page, '--sage')).toBe('#b3263e') // o resto do tema fica
  await expect(page.getByText('Cores personalizadas')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cereja', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Voltar ao visual padrão' }).click()
  expect(await phoneVar(page, '--matcha')).toBe('#dcebe2')
  await expect(page.getByText('Visual padrão (Matcha)')).toBeVisible()
})

test('marca: o tema vai junto no rascunho salvo e a tela cabe no celular', async ({ page }) => {
  const calls = await openBrand(page)
  await page.getByRole('button', { name: 'Oceano', exact: true }).click()
  const over = await page.evaluate(() => { const adm = document.querySelector('.adm') as HTMLElement; return adm.scrollWidth - adm.clientWidth })
  expect(over).toBeLessThanOrEqual(0)
  for (const chip of await page.locator('.menu-editor__theme-chip').all()) expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  const phone = await page.locator('.menu-editor__phone').boundingBox()
  expect(phone!.x).toBeGreaterThanOrEqual(0)
  expect(phone!.x + phone!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 0.5)
  await page.getByRole('button', { name: /^Salvar/ }).first().click()
  await expect.poll(() => calls.some((c) => c.rpc === 'save_menu_draft')).toBe(true)
  const saved = calls.find((c) => c.rpc === 'save_menu_draft')!.args.p_menu.cafe.branding
  expect(saved).toMatchObject({ theme: 'oceano', accent_color: '#1b6683', background_color: '#eef4f6', soft_color: '#d4e7ef' })
  await page.screenshot({ path: test.info().outputPath('marca.png'), fullPage: false })
})

/** PNG de verdade (gerado no navegador): fundo branco com um bloco roxo grande e um detalhe laranja. */
async function brandImage(page: Page) {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 300; c.height = 200
    const g = c.getContext('2d')!
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 300, 200)
    g.fillStyle = '#6b3fa0'; g.fillRect(20, 20, 180, 160)
    g.fillStyle = '#e8892b'; g.fillRect(210, 60, 70, 70)
    return c.toDataURL('image/png')
  })
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}

test('marca: imagens da marca viram 3 paletas sugeridas; as cores vêm do cálculo e a escolhida aparece na prévia', async ({ page }) => {
  let sent: any
  await page.route('**/api/admin-palette', async (route) => {
    sent = route.request().postDataJSON()
    const hexes = sent.colors.map((c: any) => c.hex)
    await route.fulfill({ json: { ok: true, source: 'ia', palettes: [
      { name: 'Fiel ao logo', note: 'Roxo do logo, fundo suave.', accent: hexes[0], secondary: hexes[1] ?? '#e8892b', background: '#f5f0f9', soft: '#e7dcf4' },
      { name: 'Leve e claro', note: 'Quase branco.', accent: '#6b3fa0', secondary: '#e8892b', background: '#fbf9fd', soft: '#ece4f5' },
      { name: 'Cheio de cor', note: 'Mais cor.', accent: '#6b3fa0', secondary: '#e8892b', background: '#efe6f8', soft: '#ddcdf0' },
    ] } })
  })
  await openBrand(page)
  await page.getByLabel('Imagens da marca para sugerir paletas').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: await brandImage(page) })
  await expect(page.getByRole('group', { name: 'Paletas sugeridas' }).getByRole('button')).toHaveCount(3)
  // o cálculo achou o roxo e o laranja (e o branco do fundo ficou de fora)
  expect(sent.colors.length).toBeGreaterThan(0)
  const near = (hex: string, ref: number[]) => { const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return Math.hypot(n[0] - ref[0], n[1] - ref[1], n[2] - ref[2]) < 40 }
  expect(near(sent.colors[0].hex, [0x6b, 0x3f, 0xa0])).toBe(true)
  expect(sent.colors.some((c: any) => near(c.hex, [0xe8, 0x89, 0x2b]))).toBe(true)
  expect(sent.colors.some((c: any) => near(c.hex, [255, 255, 255]))).toBe(false)
  // vai uma imagem reduzida (JPEG) para a IA ver
  expect(sent.images).toHaveLength(1)
  expect(sent.images[0]).toMatch(/^data:image\/jpeg;base64,/)
  await page.getByRole('button', { name: /Cheio de cor/ }).click()
  expect(await phoneVar(page, '--bg')).toBe('#efe6f8')
  expect(await phoneVar(page, '--sage')).toBe('#6b3fa0')
  await expect(page.getByText('Cores personalizadas')).toBeVisible()
})

test('marca: se a IA falha ou o arquivo não serve, mostra um aviso claro e não muda o tema', async ({ page }) => {
  await page.route('**/api/admin-palette', (route) => route.fulfill({ status: 500, json: { error: 'detalhe interno' } }))
  await openBrand(page)
  const input = page.getByLabel('Imagens da marca para sugerir paletas')
  await input.setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: await brandImage(page) })
  await expect(page.getByRole('alert').filter({ hasText: 'Não consegui sugerir paletas agora' })).toBeVisible()
  await expect(page.getByText('detalhe interno')).toHaveCount(0)
  await input.setInputFiles({ name: 'x.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') })
  await expect(page.getByRole('alert')).toContainText('JPG, PNG ou WebP')
  expect(await phoneVar(page, '--matcha')).toBe('#dcebe2')
})
