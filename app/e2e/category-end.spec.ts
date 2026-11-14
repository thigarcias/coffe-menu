import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { revealItem } from './feedNav'

const menu = JSON.parse(readFileSync(new URL('../src/data/menu.json', import.meta.url), 'utf8'))
const cats: { id: string; name: string }[] = menu.categories
const inCat = (id: string) => menu.items.filter((i: any) => i.category === id)

const box = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!

async function open(page: Page) {
  await page.goto('/')
  await page.locator('[data-item]').first().waitFor()
  await page.evaluate(() => document.fonts.ready)
}
const toEnd = (page: Page) => page.locator('.feed').evaluate((f) => { f.scrollTo({ top: f.scrollHeight }) })

test.describe('o feed termina no fim da categoria', () => {
  test('mostra só os produtos da categoria ativa, e o último "slide" é o cartão de fim', async ({ page }) => {
    await open(page)
    const first = cats[0]
    await expect(page.locator('.feed [data-item]')).toHaveCount(inCat(first.id).length)
    const ids = await page.locator('.feed [data-item]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.item))
    expect(ids.every((id) => menu.items.find((i: any) => i.id === id).category === first.id)).toBe(true)
    await expect(page.locator('.feed section').last()).toHaveAttribute('data-end')
  })

  test('não dá para passar do cartão de fim: ele é o fim da rolagem e mostra a próxima categoria', async ({ page }) => {
    await open(page)
    await toEnd(page)
    await expect(page.getByRole('heading', { name: `Você viu tudo em ${cats[0].name}` })).toBeVisible()
    const feed = await page.locator('.feed').evaluate((f) => ({ top: f.scrollTop, max: f.scrollHeight - f.clientHeight, end: (f.querySelector('[data-end]') as HTMLElement).offsetTop }))
    expect(feed.top).toBeGreaterThanOrEqual(feed.max - 1)
    expect(Math.abs(feed.end - feed.max)).toBeLessThanOrEqual(1) // o cartão de fim é o último: nada vem depois dele
    // tentar rolar mais não leva a lugar nenhum e não troca de categoria
    await page.mouse.move(100, 400)
    await page.mouse.wheel(0, 3000)
    await page.waitForTimeout(300)
    await expect(page.locator('.cat--on')).toHaveText(cats[0].name)
    await expect(page.getByRole('button', { name: new RegExp(`Ver ${cats[1].name}`) })).toBeVisible()
  })

  test('"Ver <próxima>" abre a categoria do lado, no primeiro produto', async ({ page }) => {
    await open(page)
    await toEnd(page)
    await page.getByRole('button', { name: new RegExp(`Ver ${cats[1].name}`) }).click()
    await expect(page.locator('.cat--on')).toHaveText(cats[1].name)
    await expect(page.locator('.feed [data-item]')).toHaveCount(inCat(cats[1].id).length)
    const firstId = inCat(cats[1].id)[0].id
    const top = await page.locator(`[data-item="${firstId}"]`).evaluate((el) => el.getBoundingClientRect().top - (el.parentElement as HTMLElement).getBoundingClientRect().top)
    expect(Math.abs(top)).toBeLessThanOrEqual(1)
    expect(await page.locator('.feed').evaluate((f) => f.scrollTop)).toBeLessThanOrEqual(1)
  })

  test('na última categoria, o botão volta para a primeira (o cardápio fecha em círculo)', async ({ page }) => {
    await open(page)
    await page.locator('.cats .cat', { hasText: new RegExp(`^${cats[cats.length - 1].name}$`) }).click()
    await toEnd(page)
    await expect(page.getByRole('heading', { name: `Você viu tudo em ${cats[cats.length - 1].name}` })).toBeVisible()
    await page.getByRole('button', { name: new RegExp(`Voltar para ${cats[0].name}`) }).click()
    await expect(page.locator('.cat--on')).toHaveText(cats[0].name)
    await expect(page.locator('.feed [data-item]').first()).toHaveAttribute('data-item', inCat(cats[0].id)[0].id)
  })

  test('"Ver em grade" abre a grade (o botão do dock passa a ser "Tela cheia")', async ({ page }) => {
    await open(page)
    await toEnd(page)
    await page.getByRole('button', { name: 'Ver em grade' }).click()
    await expect(page.getByRole('button', { name: 'Tela cheia' })).toBeVisible()
  })

  test('a barra de categorias também troca o feed, e a categoria nova começa no topo', async ({ page }) => {
    await open(page)
    await page.locator('.cats .cat', { hasText: new RegExp(`^${cats[2].name}$`) }).click()
    await expect(page.locator('.feed [data-item]')).toHaveCount(inCat(cats[2].id).length)
    expect(await page.locator('.feed').evaluate((f) => f.scrollTop)).toBeLessThanOrEqual(1)
  })

  test('registra o evento "viu tudo" da categoria', async ({ page }) => {
    await open(page)
    await toEnd(page)
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cm.events') ?? '[]').some((e: any) => e.type === 'category_end'))).toBe(true)
    const ev = await page.evaluate(() => JSON.parse(localStorage.getItem('cm.events') ?? '[]').find((e: any) => e.type === 'category_end'))
    expect(ev.categoryId).toBe(cats[0].id)
  })

  test('a dica "deslize" some no cartão de fim', async ({ page }) => {
    await open(page)
    await expect(page.locator('.swipe-hint')).toBeVisible()
    await toEnd(page)
    await expect(page.locator('.swipe-hint')).toHaveCount(0)
  })

  test('o cartão de fim cabe na tela: botões com 44px, sem tocar nas categorias nem no dock, sem rolar para o lado', async ({ page }) => {
    await open(page)
    await toEnd(page)
    await expect(page.locator('.end__next')).toBeVisible()
    const vw = page.viewportSize()!.width
    const cs = await box(page, '.cats')
    const dock = await box(page, '.dock')
    for (const sel of ['.end__stack', '.end__kicker', '.end__title', '.end__sub', '.end__next', '.end__grid']) {
      const b = await box(page, sel)
      expect(b.x, sel).toBeGreaterThanOrEqual(0)
      expect(b.x + b.width, sel).toBeLessThanOrEqual(vw + 0.5)
      expect(b.y, sel).toBeGreaterThanOrEqual(cs.y + cs.height)
      expect(b.y + b.height, sel).toBeLessThanOrEqual(dock.y)
    }
    for (const sel of ['.end__next', '.end__grid']) expect((await box(page, sel)).height).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  })
})

test.describe('ir até um produto de outra categoria', () => {
  test('abrir pela sacola um produto de outra categoria leva até ele no feed', async ({ page }) => {
    await open(page)
    const other = inCat(cats[3].id)[0]
    await revealItem(page, other.id)
    await page.locator(`[data-item="${other.id}"] .wantbtn`).click()
    await page.locator('.sheet-wrap--open .sheet .cta').click()
    await page.locator('.cats .cat', { hasText: new RegExp(`^${cats[0].name}$`) }).click()
    await expect(page.locator(`[data-item="${other.id}"]`)).toHaveCount(0)
    await page.locator('.dock__bag').click()
    await page.locator('.bagrow__main', { hasText: other.name }).first().click()
    await expect(page.locator('.cat--on')).toHaveText(cats[3].name)
    const slide = page.locator(`[data-item="${other.id}"]`)
    await expect(slide).toBeVisible()
    const top = await slide.evaluate((el) => el.getBoundingClientRect().top - (el.parentElement as HTMLElement).getBoundingClientRect().top)
    expect(Math.abs(top)).toBeLessThanOrEqual(1)
  })
})
