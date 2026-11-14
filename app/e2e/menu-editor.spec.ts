import { test } from './adminSession'
import { expect } from '@playwright/test'

test('editor carrega unidade autorizada e cria rascunho vazio', async ({ page }) => {
  const cafe = { id: '11111111-1111-4111-8111-111111111111', slug: 'cafe-teste', name: 'Café Teste' }
  let draft: any = null
  await page.route('**/api/menu-data', async (route) => {
    const request = route.request().postDataJSON()
    if (request.rpc === 'list_my_cafes') return route.fulfill({ json: [cafe] })
    if (request.rpc === 'create_menu_draft') {
      draft = { id: 'draft-1', name: request.args.p_name, current_version: 1, current_version_id: 'version-1', created_at: '2026-11-13T12:00:00Z', updated_at: '2026-11-13T12:00:00Z', menu: request.args.p_menu, versions: [] }
      return route.fulfill({ json: { draft_id: draft.id, version: 1 } })
    }
    if (request.rpc === 'get_menu_editor') return route.fulfill({ json: { cafe, drafts: draft ? [draft] : [], published: null, publications: [], availability: {} } })
    return route.fulfill({ status: 400, json: { message: 'operação inesperada' } })
  })
  await page.goto('/admin#cardapio')
  await expect(page.getByRole('combobox', { name: 'Cafeteria' })).toHaveValue(cafe.id)
  const name = page.getByLabel('Novo rascunho')
  await name.fill('Primeira versão')
  await page.getByRole('button', { name: 'Criar', exact: true }).click()
  await expect(page.getByText('Rascunho criado.', { exact: false })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('editor.png') })
  await page.getByRole('button', { name: 'Publicar cardápio' }).click()
  await expect(page.getByRole('alert')).toContainText('Crie ao menos uma categoria e um produto.')
  await page.getByLabel('Nova categoria').fill('Cafés')
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await page.getByRole('button', { name: 'Adicionar produto' }).click()
  const title = page.getByRole('heading', { name: 'Adicionar produto' })
  await expect(title).toBeInViewport()
  const onTop = await title.evaluate((el) => { const rect = el.getBoundingClientRect(); return !!document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest('[role=dialog]') })
  expect(onTop).toBe(true)
  await page.screenshot({ path: test.info().outputPath('produto.png') })
  await page.getByRole('button', { name: 'Fechar', exact: true }).click()
  await page.getByRole('tab', { name: 'Marca', exact: true }).click()
  await page.getByRole('button', { name: 'Gerar QR' }).click()
  await expect(page.getByRole('img', { name: 'Código QR para o cardápio de Café Teste' })).toBeVisible()
})

