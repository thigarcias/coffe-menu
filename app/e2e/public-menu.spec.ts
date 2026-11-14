import { expect, test } from '@playwright/test'
const cafe = { id: '11111111-1111-4111-8111-111111111111', slug: 'cafe-teste', name: 'Cadastro original' }
const menu = { cafe: { name: 'Marca publicada', orderBy: 'nome' }, categories: [{ id: 'cafes', name: 'Cafés' }], items: [{ id: 'cafe', name: 'Café da casa', category: 'cafes', description: 'Café', prices: [{ size: 'Único', price: 10 }], image: null, lookalike: 'Café', allergensVerified: false, tags: { sweet: 0, bitter: 1, milk: false, iced: false, caffeine: true, hunger: 0 }, labels: [] }] }
const revision = { publication_id: 'p1', draft_id: 'd1', version_id: 'v1', version: 1, published_at: '2026-11-13T10:00:00Z' }

test('unidade sem publicação mostra preparação sem mostrar o cardápio de exemplo', async ({ page }) => {
  await page.route('**/api/menu-public?*', (route) => route.fulfill({ json: { cafe, menu: null, revision: null, availability: {} } }))
  await page.goto('/?unidade=cafe-teste')
  await expect(page.getByRole('heading', { name: 'Cardápio em preparação' })).toBeVisible()
  await expect(page.getByText('Starbucks', { exact: false })).toHaveCount(0)
})

test('produto esgotado não é enviado quando muda após abrir a sacola', async ({ page }) => {
  let unavailable = false
  await page.route('**/api/menu-public?*', (route) => route.fulfill({ json: { cafe, menu, revision, availability: unavailable ? { cafe: false } : {} } }))
  await page.goto('/?unidade=cafe-teste')
  await expect(page.getByText('Marca publicada', { exact: true })).toBeVisible()
  await page.locator('[data-item="cafe"] .wantbtn').click()
  await page.locator('.sheet-wrap--open .sheet .cta').click()
  await page.locator('.dock__bag').click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.locator('#order-name').fill('Cliente')
  unavailable = true
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: /^Enviar pedido/ }).click()
  await expect(page.locator('.order__code')).toHaveCount(0)
  await expect(page.getByText('Indisponível nesta unidade').first()).toBeVisible()
})

