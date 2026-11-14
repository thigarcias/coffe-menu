import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const menu = JSON.parse(readFileSync(new URL('../src/data/menu.json', import.meta.url), 'utf8'))

/**
 * O feed mostra uma categoria por vez. Para chegar num produto de outra categoria, toca na categoria
 * dele (como a pessoa faria) e rola até ele.
 */
export async function revealItem(page: Page, id: string) {
  const slide = page.locator(`.feed [data-item="${id}"]`)
  if (!(await slide.count())) {
    const item = menu.items.find((i: { id: string }) => i.id === id)
    if (!item) throw new Error(`produto desconhecido: ${id}`)
    const cat = menu.categories.find((c: { id: string }) => c.id === item.category)
    await page.locator('.cats .cat', { hasText: new RegExp(`^${cat.name}$`) }).click()
    await slide.waitFor()
  }
  await page.locator('.feed').evaluate((feed, id) => {
    const el = feed.querySelector<HTMLElement>(`[data-item="${id}"]`)!
    feed.scrollTo({ top: el.offsetTop })
  }, id)
}
