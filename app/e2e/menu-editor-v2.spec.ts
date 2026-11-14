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

test('categorias podem ser recolhidas uma a uma ou todas de uma vez', async ({ page }) => {
  await openEditor(page)
  const first = page.getByRole('region', { name: `Categoria ${categories[0].name}` })
  const second = page.getByRole('region', { name: `Categoria ${categories[1].name}` })
  const firstItem = items.find((item: any) => item.category === categories[0].id)!
  await expect(first.getByText(firstItem.name, { exact: true })).toBeVisible()
  await first.getByRole('button', { name: new RegExp(categories[0].name) }).click()
  await expect(first.getByText(firstItem.name, { exact: true })).toBeHidden()
  await expect(first.getByRole('button', { name: new RegExp(categories[0].name) })).toHaveAttribute('aria-expanded', 'false')
  await expect(second.getByRole('button', { name: new RegExp(categories[1].name) })).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('button', { name: 'Expandir todas' }).click().catch(() => {})
  await page.getByRole('button', { name: 'Recolher todas' }).click().catch(() => {})
  for (const category of categories) await expect(page.getByRole('region', { name: `Categoria ${category.name}` }).getByRole('button', { name: new RegExp(category.name) })).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('button', { name: 'Expandir todas' }).click()
  for (const category of categories) await expect(page.getByRole('region', { name: `Categoria ${category.name}` }).getByRole('button', { name: new RegExp(category.name) })).toHaveAttribute('aria-expanded', 'true')
  // buscar reabre o que estava recolhido
  await page.getByRole('button', { name: 'Recolher todas' }).click()
  await page.getByRole('searchbox', { name: 'Buscar produto', exact: true }).fill(firstItem.name)
  await expect(first.getByText(firstItem.name, { exact: true })).toBeVisible()
})

test('disponibilidade mostra a quantidade em estoque e envia a nova quantidade', async ({ page }) => {
  const stock = Object.fromEntries(items.map((item: any) => [item.id, { available: true, quantity: 20, note: null }]))
  const calls = await openEditor(page, { stock })
  await page.getByRole('tab', { name: 'Disponibilidade', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Disponibilidade e estoque' })).toBeVisible()
  const target = items[0]
  const row = page.getByRole('listitem').filter({ hasText: target.name }).first()
  await expect(row.getByText('20 em estoque')).toBeVisible()
  await row.getByRole('button', { name: `Aumentar estoque de ${target.name}` }).click()
  await expect(row.getByText('21 em estoque')).toBeVisible()
  const sent = calls.filter((call) => call.rpc === 'set_product_stock').at(-1)!
  expect(sent.args).toMatchObject({ p_product_id: target.id, p_quantity: 21, p_available: true })
  // zerar o estoque deixa o produto esgotado sozinho
  const input = row.getByRole('textbox', { name: `Quantidade em estoque de ${target.name}` })
  await input.fill('0')
  await input.press('Enter')
  await expect(row.getByRole('button', { name: 'Esgotado' })).toBeVisible()
})

test('ao editar um produto a foto aparece no começo, antes do formulário, junto da IA', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('button', { name: 'Editar', exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  const photo = dialog.getByRole('img', { name: /Foto de/ })
  await expect(photo).toBeVisible()
  const [photoBox, aiBox, nameBox, descBox] = await Promise.all([
    photo.boundingBox(),
    dialog.getByRole('region', { name: 'Preencher com IA' }).boundingBox(),
    dialog.getByLabel('Nome do produto').boundingBox(),
    dialog.getByLabel('Descrição (opcional)').boundingBox(),
  ])
  expect(photoBox!.y).toBeLessThan(aiBox!.y)
  expect(aiBox!.y).toBeLessThan(descBox!.y)
  expect(nameBox!.y).toBeLessThan(aiBox!.y)
  // tamanho médio: nem miniatura nem a tela toda
  expect(photoBox!.width).toBeGreaterThanOrEqual(120)
  expect(photoBox!.width).toBeLessThanOrEqual(280)
  await expect(dialog.getByText('Trocar foto')).toBeVisible()
  // o formulário não começa gigante: as seções extras ficam recolhidas
  for (const name of ['Detalhes para o cliente', 'Alérgenos', 'Etiquetas e características']) {
    await expect(dialog.locator('details').filter({ has: page.locator('summary', { hasText: name }) })).not.toHaveAttribute('open', '')
  }
})

test('produto sem foto mostra um quadro vazio com o botão de enviar', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('button', { name: 'Nova categoria' }).click().catch(() => {})
  await page.getByRole('button', { name: 'Adicionar produto' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Sem foto ainda')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Enviar foto' }).or(dialog.getByText('Enviar foto'))).toBeVisible()
})

test('Preencher com IA completa só os campos vazios, deixa alérgeno para conferir e dá para desfazer', async ({ page }) => {
  await openEditor(page, { fill: { name: 'Outro nome', description: 'Cremoso e doce.', lookalike: 'Parecido com latte.', ingredients: ['café', 'pistache'], allergens: ['Castanhas'], labels: [], newLabels: ['Pistache'], tags: { sweet: '2', bitter: '', hunger: '', milk: 'true', iced: '', caffeine: '' }, allergensVerified: false } })
  await page.getByRole('button', { name: 'Adicionar produto' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nome do produto').fill('Meu latte')
  await dialog.getByLabel('Descreva o produto para a IA').fill('latte de pistache')
  await dialog.getByRole('button', { name: 'Preencher com IA' }).click()
  await expect(dialog.getByRole('status')).toContainText('A IA preencheu')
  await expect(dialog.getByLabel('Nome do produto')).toHaveValue('Meu latte')
  await expect(dialog.getByLabel('Descrição (opcional)')).toHaveValue('Cremoso e doce.')
  // alérgeno nunca é aplicado sozinho
  await expect(dialog.getByLabel('Alérgenos informados pela cafeteria')).toHaveValue('')
  await expect(dialog.getByText('Possíveis alérgenos')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Usar alérgenos selecionados' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Desfazer' }).click()
  await expect(dialog.getByLabel('Descrição (opcional)')).toHaveValue('')
  await expect(dialog.getByLabel('Nome do produto')).toHaveValue('Meu latte')
})

test('etiqueta nova criada pela cafeteria entra no catálogo do cardápio ao salvar', async ({ page }) => {
  const calls = await openEditor(page)
  await page.getByRole('button', { name: 'Editar', exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('summary', { hasText: 'Etiquetas e características' }).click()
  await dialog.getByLabel('Nova etiqueta').fill('Sem açúcar')
  await dialog.getByRole('button', { name: 'Criar etiqueta' }).click()
  await expect(dialog.getByRole('checkbox', { name: 'Sem açúcar' })).toBeChecked()
  await dialog.getByRole('button', { name: 'Salvar produto no rascunho' }).click()
  await page.getByRole('button', { name: 'Salvar rascunho' }).click()
  await expect.poll(() => calls.some((call) => call.rpc === 'save_menu_draft')).toBe(true)
  const saved = calls.find((call) => call.rpc === 'save_menu_draft')!.args.p_menu
  const own = saved.tagGroups.find((group: any) => group.id === 'minhas-etiquetas')
  expect(own.tags.map((tag: any) => tag.label)).toEqual(['Sem açúcar'])
  const product = saved.items[0]
  expect(product.labels).toContain(own.tags[0].id)
})

test('editor, disponibilidade e diálogo cabem na largura da tela, sem rolar para o lado', async ({ page }) => {
  await openEditor(page)
  const overflow = () => page.evaluate(() => { const adm = document.querySelector('.adm') as HTMLElement; return adm.scrollWidth - adm.clientWidth })
  expect(await overflow()).toBeLessThanOrEqual(0)
  await page.getByRole('tab', { name: 'Disponibilidade', exact: true }).click()
  expect(await overflow()).toBeLessThanOrEqual(0)
  await page.getByRole('tab', { name: 'Produtos', exact: true }).click()
  await page.getByRole('button', { name: 'Editar', exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  const box = await dialog.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 0.5)
  expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0)
})
