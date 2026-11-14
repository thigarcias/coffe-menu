import { test } from './adminSession'
import { expect } from '@playwright/test'

test('equipe permite simular convite sem persistência', async ({ page }) => {
  await page.goto('/admin#equipe')
  await expect(page.getByText('dados fictícios', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Convidar pessoa' }).click()
  await expect(page.getByRole('heading', { name: 'Convidar para a equipe' })).toBeInViewport()
  const dialogOnTop = await page.getByRole('heading', { name: 'Convidar para a equipe' }).evaluate((el) => { const r = el.getBoundingClientRect(); return !!document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('[role=dialog]') })
  expect(dialogOnTop).toBe(true)
  await page.getByLabel('Nome', { exact: true }).fill('Maria Exemplo')
  await page.getByLabel('E-mail', { exact: true }).fill('maria@exemplo.com')
  await page.getByLabel('Perfil inicial').selectOption({ label: 'Gerente' })
  await page.getByRole('button', { name: 'Simular convite' }).click()
  await expect(page.getByText('Maria Exemplo', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Maria Exemplo', { exact: true })).toHaveCount(0)
})



