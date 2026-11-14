import { expect, type Page } from '@playwright/test'

/** Item do menu lateral. No celular o menu é uma gaveta: abre pelo botão "Menu" se estiver fechada. */
export const navItem = (page: Page, name: string) =>
  page.locator('nav[aria-label="Seções do painel"]').getByRole('button', { name, exact: true, includeHidden: true })

export async function openMenu(page: Page) {
  const side = page.locator('#adm-side')
  if (await side.evaluate((e) => getComputedStyle(e).visibility === 'visible')) return
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await expect(side).toBeVisible()
}

/** Vai para uma seção pelo menu lateral e confere que ela ficou ativa. */
export async function goSection(page: Page, name: string) {
  await openMenu(page)
  const dash = page.getByRole('button', { name: 'Dashboard', exact: true })
  if (['Visão geral', 'Vendas', 'Produtos', 'IA e Parecidos', 'Tráfego'].includes(name) && (await dash.getAttribute('aria-expanded')) === 'false') await dash.click()
  await navItem(page, name).click()
  await openMenu(page)
  await expect(navItem(page, name)).toHaveAttribute('aria-current', 'page')
  // no celular a gaveta fecha sozinha ao escolher
  await page.keyboard.press('Escape').catch(() => {})
}
