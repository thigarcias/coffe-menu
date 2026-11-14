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
