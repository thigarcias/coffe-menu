import { expect, test, type Page, type Locator } from '@playwright/test'

/** Caixa de um elemento na tela (px CSS). */
const box = async (l: Locator) => {
  const b = await l.boundingBox()
  if (!b) throw new Error('elemento sem caixa (invisível?)')
  return { ...b, right: b.x + b.width, bottom: b.y + b.height, cy: b.y + b.height / 2 }
}

async function open(page: Page) {
  // A IA é simulada: os testes de layout não dependem da OpenAI.
  await page.route('**/api/recommend', (r) =>
    r.fulfill({
      json: {
        model: 'teste',
        suggestions: [
          { id: 'caramelo-macchiato', reason: 'Docinho e cremoso.' },
          { id: 'cafe-latte', reason: 'Suave, com bastante leite.' },
        ],
      },
    }),
  )
  await page.goto('/')
  await page.locator('[data-item]').first().waitFor()
  await page.evaluate(() => document.fonts.ready)
}

/** A pílula clara precisa cobrir exatamente a categoria ativa. */
async function expectThumbOnActive(page: Page) {
  await expect
    .poll(async () => {
      const t = await box(page.locator('.cats__thumb'))
      const a = await box(page.locator('.cat--on'))
      return Math.max(Math.abs(t.x - a.x), Math.abs(t.width - a.width))
    })
    .toBeLessThanOrEqual(1)
}

test.describe('cardápio no celular', () => {
  test.beforeEach(async ({ page }) => open(page))

  test('categorias gerais no topo', async ({ page }) => {
    await expect(page.locator('.cat')).toHaveText(['Novidades', 'Cafés', 'Gelados', 'Bebidas', 'Salgados', 'Doces'])
    await page.getByRole('button', { name: 'Salgados' }).click()
    await expect(page.locator('.cat--on')).toHaveText('Salgados')
  })

  test('dica de deslizar aparece no primeiro produto, fica acima do dock e some ao deslizar', async ({ page }) => {
    const hint = page.locator('.swipe-hint')
    await expect(hint).toBeVisible()
    const h = await box(hint)
    expect(h.bottom).toBeLessThanOrEqual((await box(page.locator('.dock'))).y)
    expect(h.y).toBeGreaterThanOrEqual((await box(page.locator('.slide__body').first())).bottom - 1)
    await page.locator('.feed').evaluate((el) => el.scrollBy(0, el.clientHeight))
    await expect(hint).toHaveCount(0)
    // voltando ao primeiro produto, a dica aparece de novo (nada fica gravado)
    await page.locator('.feed').evaluate((el) => el.scrollTo(0, 0))
    await expect(hint).toBeVisible()
    await page.reload()
    await page.locator('[data-item]').first().waitFor()
    await expect(page.locator('.swipe-hint')).toBeVisible()
  })

  test('o app preenche a tela inteira, sem faixa vazia', async ({ page }) => {
    const vp = page.viewportSize()!
    const app = await box(page.locator('.app'))
    expect(app.y).toBe(0)
    expect(Math.round(app.bottom)).toBe(vp.height)
    const slide = await box(page.locator('.slide').first())
    expect(Math.round(slide.height)).toBe(vp.height)
  })

  test('o app fica preso à janela (evita a faixa vazia sob a barra do Safari no iPhone)', async ({ page }) => {
    const pos = await page.locator('.app').evaluate((el) => getComputedStyle(el).position)
    expect(pos).toBe('fixed')
  })

  test('nada passa da largura da tela', async ({ page }) => {
    const { scroll, width } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      width: window.innerWidth,
    }))
    expect(scroll).toBeLessThanOrEqual(width)
    const vp = page.viewportSize()!
    for (const sel of ['.brand', '.cats', '.dock', '.slide__name >> nth=0', '.slide__row >> nth=0']) {
      const b = await box(page.locator(sel))
      expect(b.x, sel).toBeGreaterThanOrEqual(0)
      expect(b.right, sel).toBeLessThanOrEqual(vp.width + 0.5)
    }
  })

  test('todos os botões fora do trilho de categorias cabem na tela', async ({ page }) => {
    const out = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.top button, .dock button, .dock__group, .slide__row button')]
        .filter((el) => !el.closest('.cats__track'))
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width && r.bottom > 0 && r.top < innerHeight && (r.left < -0.5 || r.right > innerWidth + 0.5))
        .map(({ el, r }) => `${el.className} [${Math.round(r.left)}, ${Math.round(r.right)}]`),
    )
    expect(out).toEqual([])
  })

  test('o app nunca rola para o lado, nem ao abrir a grade ou pular de categoria', async ({ page }) => {
    const sideScroll = () => page.locator('.app').evaluate((el) => el.scrollLeft + Math.max(0, el.scrollWidth - el.clientWidth))
    expect(await sideScroll()).toBe(0)
    await page.locator('.cat').nth(5).click()
    expect(await sideScroll()).toBe(0)
    await page.getByRole('button', { name: 'Ver tudo' }).click()
    await page.waitForTimeout(300)
    expect(await sideScroll()).toBe(0)
    const title = await box(page.locator('.grid-sec__title').first())
    expect(title.x).toBeGreaterThanOrEqual(0)
  })

  test('a pílula da categoria acompanha a categoria ativa', async ({ page }) => {
    await expectThumbOnActive(page)
    await page.locator('.cat').nth(3).click()
    await expect(page.locator('.cat').nth(3)).toHaveClass(/cat--on/)
    await expectThumbOnActive(page)
  })

  test('a pílula se ajusta quando a fonte muda de tamanho (fonte carregada depois)', async ({ page }) => {
    await expectThumbOnActive(page)
    await page.addStyleTag({ content: '.cat { font-size: 16px !important; letter-spacing: .5px !important; }' })
    await expectThumbOnActive(page)
  })

  test('texto e botões do produto ficam acima do dock, numa linha só', async ({ page }) => {
    const body = await box(page.locator('.slide__body').first())
    const dock = await box(page.locator('.dock'))
    expect(body.bottom).toBeLessThanOrEqual(dock.y)
    const capsule = await box(page.locator('.slide__row .capsule').first())
    const heart = await box(page.locator('.slide__row .circle').first())
    expect(Math.abs(capsule.cy - heart.cy)).toBeLessThanOrEqual(2)
    expect(capsule.right).toBeLessThanOrEqual(heart.x)
    // o texto do botão não pode ser cortado
    const clipped = await page.locator('.slide__row .capsule').first().evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    expect(clipped).toBe(false)
  })

  test('a foto do produto não invade o texto nem as categorias', async ({ page }) => {
    for (const id of ['matcha-latte-gelado-proteico', 'chocolate-classico', 'bolo-red-velvet']) {
      const slide = page.locator(`[data-item="${id}"]`)
      await slide.scrollIntoViewIfNeeded()
      const img = await box(slide.locator('.pimg__box'))
      const body = await box(slide.locator('.slide__body'))
      const cats = await box(page.locator('.cats'))
      expect(img.bottom, id).toBeLessThanOrEqual(body.y + 1)
      expect(img.y - (await box(slide)).y, id).toBeGreaterThanOrEqual(cats.bottom - 1)
      expect(img.height, id).toBeGreaterThan(120)
    }
  })

  test('o texto do botão de ajuda aparece inteiro', async ({ page }) => {
    const cut = await page.locator('.dock__help span').evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    expect(cut).toBe(false)
  })

  test('produto com preço "a partir de" cabe na linha', async ({ page }) => {
    const slide = page.locator('[data-item="chocolate-classico"]')
    await slide.scrollIntoViewIfNeeded()
    const row = slide.locator('.slide__row')
    const r = await box(row)
    const vp = page.viewportSize()!
    expect(r.right).toBeLessThanOrEqual(vp.width)
    expect(r.height).toBeLessThanOrEqual(48)
  })

  test('botões do dock: ícones centralizados e área de toque ≥ 44px', async ({ page }) => {
    for (const l of await page.locator('.dock button').all()) {
      const b = await box(l)
      expect(b.height).toBeGreaterThanOrEqual(44)
      const svg = await box(l.locator('svg'))
      expect(Math.abs(svg.cy - b.cy)).toBeLessThanOrEqual(1.5)
    }
  })

  test('detalhe do produto abre dentro da tela e o X não cobre o título', async ({ page }) => {
    await page.locator('.slide__row .capsule').first().click()
    const sheet = page.locator('.sheet-wrap--open .sheet')
    await expect(sheet).toBeVisible()
    await page.waitForTimeout(500)
    const s = await box(sheet)
    const vp = page.viewportSize()!
    expect(s.x).toBeGreaterThanOrEqual(0)
    expect(s.right).toBeLessThanOrEqual(vp.width)
    expect(s.bottom).toBeLessThanOrEqual(vp.height)
    const close = await box(sheet.locator('.sheet__close'))
    const title = await box(sheet.locator('.detail__name'))
    expect(title.right).toBeLessThanOrEqual(close.x)
    await sheet.getByRole('tab', { name: 'Ingredientes' }).click()
    await expect(sheet.locator('.ingredients li').first()).toBeVisible()
    // o reflexo do vidro não pode ficar por cima do texto (deixava o título desbotado)
    const onTop = await sheet.locator('.detail__name').evaluate((el) => {
      const r = el.getBoundingClientRect()
      return document.elementFromPoint(r.left + 10, r.top + r.height / 2) === el || el.contains(document.elementFromPoint(r.left + 10, r.top + r.height / 2))
    })
    expect(onTop).toBe(true)
    await expect(page.locator('.dock')).toHaveClass(/dock--hidden/)
  })

  test('quiz com IA mostra as sugestões', async ({ page }) => {
    await page.locator('.dock__help').click()
    await page.getByText('Algo quente').click()
    await page.getByText('Equilibrado').click()
    await page.locator('#quiz-text').fill('algo cremoso')
    await page.getByText('Nada, ver sugestões').click()
    await expect(page.locator('.source')).toHaveText('Sugerido pela IA')
    await expect(page.locator('.sug')).toHaveCount(2)
  })

  test('quiz cai nas regras quando a IA falha', async ({ page }) => {
    await page.unroute('**/api/recommend')
    await page.route('**/api/recommend', (r) => r.fulfill({ status: 500, json: { error: 'x' } }))
    await page.locator('.dock__help').click()
    await page.getByText('Algo gelado').click()
    await page.getByText('Docinho').click()
    await page.getByText('Nada, ver sugestões').click()
    await expect(page.locator('.source')).toContainText('Sugestão rápida')
    await expect(page.locator('.sug').first()).toBeVisible()
  })

  test('detalhe: tamanho fixo e tudo cabe sem rolar, nos piores casos de texto', async ({ page }) => {
    // tradução, história, ingredientes e nome mais longos; e um item com preços e alérgeno
    const ids = ['latte-macchiato', 'caramelo-macchiato-gelado', 'frappuccino-brigadeiro', 'morango-frappuccino-cold-foam-proteico', 'chocolate-classico']
    const heights = new Set<number>()
    for (const id of ids) {
      await page.locator('.feed').evaluate((feed, id) => {
        const el = feed.querySelector<HTMLElement>(`[data-item="${id}"]`)!
        feed.scrollTo({ top: el.offsetTop })
      }, id)
      await page.locator(`[data-item="${id}"] .slide__row .capsule`).click()
      const sheet = page.locator('.sheet-wrap--open .sheet')
      await expect(sheet).toBeVisible()
      await page.waitForTimeout(450)
      const tabs = sheet.getByRole('tab')
      await expect(tabs).toHaveCount(3)
      for (let t = 0; t < 3; t++) {
        await tabs.nth(t).click()
        const over = await sheet.evaluate((el) => {
          const list = [el, ...el.querySelectorAll<HTMLElement>('.detail__panel, .detail__panel *')]
          return list.filter((n) => n.scrollHeight > n.clientHeight + 1 && getComputedStyle(n).overflowY !== 'visible').map((n) => n.className)
        })
        expect(over, `${id} aba ${t}`).toEqual([])
        const fits = await sheet.evaluate((el) => {
          const panel = el.querySelector<HTMLElement>('.detail__panel')!
          const pr = panel.getBoundingClientRect()
          return [...panel.querySelectorAll<HTMLElement>('*')].every((n) => n.getBoundingClientRect().bottom <= pr.bottom + 1)
        })
        expect(fits, `${id} aba ${t}: conteúdo passa do painel`).toBe(true)
      }
      const s = await box(sheet)
      heights.add(Math.round(s.height))
      const cta = await box(sheet.locator('.cta'))
      expect(cta.bottom).toBeLessThanOrEqual(s.bottom)
      await sheet.locator('.sheet__close').click()
      await expect(page.locator('.sheet-wrap--open')).toHaveCount(0)
    }
    expect(heights.size, 'o painel deve ter o mesmo tamanho para todo produto').toBe(1)
  })

  test('na galeria, tocar num item abre os detalhes dele ali mesmo', async ({ page }) => {
    await page.getByRole('button', { name: 'Ver tudo' }).click()
    const card = page.locator('.grid-sec').nth(2).locator('.card').nth(1)
    const name = (await card.locator('.card__name').textContent())!.trim()
    await card.click()
    const sheet = page.locator('.sheet-wrap--open .sheet')
    await expect(sheet.locator('.detail__name')).toHaveText(name)
    await expect(page.locator('.grid-view')).toBeVisible()
    await sheet.locator('.sheet__close').click()
    await expect(page.locator('.sheet-wrap--open')).toHaveCount(0)
    await expect(page.locator('.grid-view')).toBeVisible() // continua na galeria
  })

  test('escolher uma sugestão do quiz leva ao produto certo no feed', async ({ page }) => {
    await page.locator('.dock__help').click()
    await page.getByText('Algo quente').click()
    await page.getByText('Equilibrado').click()
    await page.getByText('Nada, ver sugestões').click()
    await page.locator('.sug').nth(1).click() // cafe-latte, longe do topo
    await expect
      .poll(() =>
        page.locator('.feed').evaluate((feed) => {
          const r = feed.getBoundingClientRect()
          const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
          return el?.closest('[data-item]')?.getAttribute('data-item')
        }),
      )
      .toBe('cafe-latte')
  })

  test('ver tudo: grade em 2 colunas, sem cortar o nome', async ({ page }) => {
    await page.getByRole('button', { name: 'Ver tudo' }).click()
    const cards = page.locator('.grid-sec').first().locator('.card')
    const a = await box(cards.nth(0))
    const b = await box(cards.nth(1))
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1)
    expect(b.x).toBeGreaterThan(a.right)
  })
})

// Capturas de referência: qualquer mudança visual não intencional quebra o teste.
// Para aceitar uma mudança de propósito: npx playwright test --update-snapshots
test.describe('visual', () => {
  test.beforeEach(async ({ page }) => open(page))

  test('feed', async ({ page }) => {
    await expect(page).toHaveScreenshot('feed.png')
  })
  test('detalhe', async ({ page }) => {
    await page.locator('.slide__row .capsule').first().click()
    await page.waitForTimeout(500)
    await expect(page).toHaveScreenshot('detalhe.png')
  })
  test('quiz', async ({ page }) => {
    await page.locator('.dock__help').click()
    await page.waitForTimeout(500)
    await expect(page).toHaveScreenshot('quiz.png')
  })
  test('grade', async ({ page }) => {
    await page.getByRole('button', { name: 'Ver tudo' }).click()
    await page.waitForTimeout(500)
    await expect(page).toHaveScreenshot('grade.png')
  })
})
