import { expect, test, type Page, type Locator } from '@playwright/test'

/** Caixa de um elemento na tela (px CSS). */
const box = async (l: Locator) => {
  const b = await l.boundingBox()
  if (!b) throw new Error('elemento sem caixa (invisível?)')
  return { ...b, right: b.x + b.width, bottom: b.y + b.height, cy: b.y + b.height / 2 }
}

async function open(page: Page, opts: { clock?: boolean } = {}) {
  // relógio de mentira: deixa adiantar o tempo do pedido (Recebido, Preparando, Pronto)
  if (opts.clock) await page.clock.install()
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

/** Responde o quiz de bebida até a última pergunta: com ou sem café = tanto faz, sem sabor, textura = tanto faz. */
async function quizToFinal(page: Page, want = 'Algo quente', taste = 'Equilibrado') {
  await page.locator('.dock__help').click()
  await page.locator('.opt', { hasText: want }).click()
  await page.locator('.opt', { hasText: 'Tanto faz' }).click()
  await page.getByRole('button', { name: 'Sem preferência' }).click()
  await page.locator('.opt', { hasText: taste }).click()
  await page.locator('.opt', { hasText: 'Tanto faz' }).click()
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

  test('vídeo ocupa o slide inteiro (sem caixinha estreita) e o texto continua visível', async ({ page }) => {
    const slide = page.locator('.slide:has(video)').first()
    await slide.scrollIntoViewIfNeeded()
    const s = await box(slide)
    const v = await box(slide.locator('video'))
    // antes o vídeo ficava numa caixa de ~40% da largura, com máscara nas bordas
    expect(v.width).toBeGreaterThanOrEqual(s.width - 1)
    expect(v.height).toBeGreaterThanOrEqual(s.height - 1)
    await expect(slide.locator('.slide__name')).toBeVisible()
  })

  test('dica de deslizar aparece no primeiro produto, fica acima do dock e some ao deslizar', async ({ page }) => {
    const hint = page.locator('.swipe-hint')
    await expect(hint).toBeVisible()
    const h = await box(hint)
    expect(h.bottom).toBeLessThanOrEqual((await box(page.locator('.dock'))).y)
    // respiro de pelo menos 8px até a descrição (antes encostava no iPhone SE)
    expect(h.y).toBeGreaterThanOrEqual((await box(page.locator('.slide__body').first())).bottom + 8)
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
    for (const sel of ['.brand', '.cats', '.dock', '.slide__name >> nth=0', '.slide__actions >> nth=0']) {
      const b = await box(page.locator(sel))
      expect(b.x, sel).toBeGreaterThanOrEqual(0)
      expect(b.right, sel).toBeLessThanOrEqual(vp.width + 0.5)
    }
  })

  test('todos os botões fora do trilho de categorias cabem na tela', async ({ page }) => {
    const out = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.top button, .dock button, .dock__group, .slide__actions button')]
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

  test('texto e botões do produto ficam acima do dock', async ({ page }) => {
    const body = await box(page.locator('.slide__body').first())
    const dock = await box(page.locator('.dock'))
    expect(body.bottom).toBeLessThanOrEqual(dock.y)
    // um botão só no produto: "Eu quero"
    await expect(page.locator('.slide').first().locator('.chipbtn')).toHaveCount(1)
    const add = await box(page.locator('.wantbtn').first())
    expect(add.bottom).toBeLessThanOrEqual(body.y)
    // borda direita alinhada ao texto e ao dock (margem = gutter); o botão é a caixa de toque, o chip é o vidro
    const vp = page.viewportSize()!
    const gutter = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gutter')))
    const dockG = await box(page.locator('.dock__group').first())
    const addPill = await box(page.locator('.wantbtn .chipbtn__pill').first())
    expect(Math.abs(add.right - (vp.width - gutter))).toBeLessThanOrEqual(1)
    expect(Math.abs(add.right - dockG.right)).toBeLessThanOrEqual(1)
    expect(addPill.right).toBeLessThanOrEqual(vp.width - gutter + 0.5)
    expect(add.x).toBeGreaterThanOrEqual(gutter)
    // chip de vidro com 36–40px de altura; alvo de toque (botão) ≥ 44px
    for (const sel of ['.wantbtn']) {
      const b = page.locator(sel).first()
      const pill = b.locator('.chipbtn__pill')
      await expect(pill).toHaveClass(/glass/)
      const p = await box(pill)
      expect(p.height, sel).toBeGreaterThanOrEqual(36)
      expect(p.height, sel).toBeLessThanOrEqual(40)
      const hit = await box(b)
      expect(hit.width, sel).toBeGreaterThanOrEqual(44)
      expect(hit.height, sel).toBeGreaterThanOrEqual(44)
      // ícone + texto na mesma linha, sem quebra nem corte
      const info = await pill.evaluate((el) => {
        const lbl = el.querySelector('.chipbtn__lbl') as HTMLElement
        const svg = el.querySelector('svg')!.getBoundingClientRect()
        const l = lbl.getBoundingClientRect(), r = el.getBoundingClientRect(), cs = getComputedStyle(lbl)
        return {
          cut: el.scrollWidth > el.clientWidth + 1 || lbl.scrollWidth > lbl.clientWidth + 1,
          lines: Math.round(l.height / parseFloat(cs.lineHeight === 'normal' ? String(parseFloat(cs.fontSize) * 1.2) : cs.lineHeight)),
          sameRow: Math.abs((svg.top + svg.bottom) / 2 - (l.top + l.bottom) / 2) <= 2 && svg.right <= l.left + 0.5,
          inside: l.left >= r.left && l.right <= r.right,
          size: parseFloat(cs.fontSize), weight: Number(cs.fontWeight), wrap: cs.whiteSpace,
        }
      })
      expect(info.cut, sel).toBe(false)
      expect(info.lines, sel).toBe(1)
      expect(info.sameRow, sel).toBe(true)
      expect(info.inside, sel).toBe(true)
      expect(info.wrap, sel).toBe('nowrap')
      expect(info.weight, sel).toBeGreaterThanOrEqual(600)
      expect(info.size, sel).toBeGreaterThanOrEqual(13.5)
      await expect(b.locator('.chipbtn__lbl')).toBeVisible()
    }
    await expect(page.locator('.wantbtn .chipbtn__lbl').first()).toHaveText('Eu quero')
  })

  test('os botões do produto ficam dentro da área da foto e não tocam o texto', async ({ page }) => {
    for (const id of ['matcha-latte-proteico-gelado', 'chocolate-quente', 'bolo-red-velvet-fatia', 'mocha-strate-frappuccino-com-caramelo-salgado-cold-foam']) {
      const slide = page.locator(`[data-item="${id}"]`)
      await slide.scrollIntoViewIfNeeded()
      const photo = await box(slide.locator('.pimg__box'))
      const body = await box(slide.locator('.slide__body'))
      const cats = await box(page.locator('.cats'))
      for (const sel of ['.wantbtn']) {
        const b = await box(slide.locator(sel))
        expect(b.right, `${id} ${sel}: gutter`).toBeLessThanOrEqual(page.viewportSize()!.width - 16 + 0.5)
        expect(b.y, `${id} ${sel}`).toBeGreaterThanOrEqual(photo.y)
        expect(b.bottom, `${id} ${sel}`).toBeLessThanOrEqual(photo.bottom + 12) // a margem de baixo da foto
        expect(b.bottom, `${id} ${sel}: sobre o texto`).toBeLessThanOrEqual(body.y)
        expect(b.y, `${id} ${sel}: sobre as categorias`).toBeGreaterThanOrEqual(cats.bottom)
        expect(b.x, `${id} ${sel}`).toBeGreaterThanOrEqual(photo.x)
        expect(b.right, `${id} ${sel}`).toBeLessThanOrEqual(photo.right)
      }
    }
  })

  test('a foto do produto não invade o texto nem as categorias', async ({ page }) => {
    // inclui o nome mais longo do cardápio: a foto não pode encolher demais no iPhone SE
    for (const id of ['matcha-latte-proteico-gelado', 'chocolate-quente', 'bolo-red-velvet-fatia', 'mocha-strate-frappuccino-com-caramelo-salgado-cold-foam']) {
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

  test('produto com preço "a partir de" cabe na largura, com descrição de uma linha', async ({ page }) => {
    const slide = page.locator('[data-item="chocolate-quente"]')
    await slide.scrollIntoViewIfNeeded()
    const body = await box(slide.locator('.slide__body'))
    expect(body.right).toBeLessThanOrEqual(page.viewportSize()!.width)
    const lines = await slide.locator('.slide__desc').evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)))
    expect(lines).toBe(1)
  })

  test('os rótulos do dock cabem numa linha só, sem corte nem reticências', async ({ page }) => {
    const labels = ['Me ajuda', 'Sacola', 'Ver tudo']
    await expect(page.locator('.dock__lbl')).toHaveText(labels)
    const info = await page.locator('.dock__lbl').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect(), b = el.parentElement!.getBoundingClientRect(), cs = getComputedStyle(el)
        const lines = Math.round(r.height / parseFloat(cs.lineHeight))
        return { txt: el.textContent, lines, cut: el.scrollWidth > el.clientWidth + 1, ell: cs.textOverflow === 'ellipsis', inside: r.left >= b.left && r.right <= b.right && r.bottom <= b.bottom }
      }),
    )
    for (const i of info) {
      expect(i.lines, i.txt!).toBe(1)
      expect(i.cut, i.txt!).toBe(false)
      expect(i.ell, i.txt!).toBe(false)
      expect(i.inside, i.txt!).toBe(true)
    }
    // três abas iguais e a barra fina
    const tabs = await page.locator('.dock__btn').all()
    const w = await Promise.all(tabs.map(async (t) => (await box(t)).width))
    expect(Math.max(...w) - Math.min(...w)).toBeLessThanOrEqual(1)
    expect((await box(page.locator('.dock__group'))).height).toBeLessThanOrEqual(56)
  })

  test('a dica de deslizar não encosta no dock nem nos botões do produto', async ({ page }) => {
    const h = await box(page.locator('.swipe-hint'))
    expect(h.bottom).toBeLessThanOrEqual((await box(page.locator('.dock__group'))).y - 2)
    expect(h.y).toBeGreaterThanOrEqual((await box(page.locator('.wantbtn').first())).bottom)
  })

  test('na grade, o dock some ao rolar para baixo e volta ao rolar para cima', async ({ page }) => {
    await page.getByRole('button', { name: 'Ver tudo' }).click()
    const dock = page.locator('.dock')
    const grid = page.locator('.grid-view')
    await expect(dock).not.toHaveClass(/dock--hidden/)
    await grid.evaluate((el) => el.scrollTo({ top: 400 }))
    await expect(dock).toHaveClass(/dock--hidden/)
    await grid.evaluate((el) => el.scrollTo({ top: 200 }))
    await expect(dock).not.toHaveClass(/dock--hidden/)
    // parando de rolar, ele também volta
    await grid.evaluate((el) => el.scrollTo({ top: 700 }))
    await expect(dock).toHaveClass(/dock--hidden/)
    await expect(dock).not.toHaveClass(/dock--hidden/, { timeout: 3000 })
    // e no feed ele nunca some
    await page.getByRole('button', { name: 'Ver em tela cheia' }).click()
    await page.locator('.feed').evaluate((el) => el.scrollBy(0, el.clientHeight * 3))
    await page.waitForTimeout(200)
    await expect(dock).not.toHaveClass(/dock--hidden/)
  })

  test('botões do dock: ícones centralizados e área de toque ≥ 44px', async ({ page }) => {
    for (const l of await page.locator('.dock button').all()) {
      const b = await box(l)
      expect(b.height).toBeGreaterThanOrEqual(44)
      // ícone (com o texto de apoio embaixo, quando houver) centralizado no botão
      const svg = await box(l.locator('svg'))
      const lbl = l.locator('.dock__lbl')
      const bottom = (await lbl.count()) ? (await box(lbl)).bottom : svg.bottom
      expect(Math.abs((svg.y + bottom) / 2 - b.cy)).toBeLessThanOrEqual(1.5)
    }
  })

  test('detalhe do produto abre dentro da tela e o X não cobre o título', async ({ page }) => {
    await page.locator('.wantbtn').first().click()
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
    await quizToFinal(page)
    await page.locator('#quiz-text').fill('algo cremoso')
    await page.getByText('Nada, ver sugestões').click()
    await expect(page.locator('.source')).toHaveText('Sugerido pela IA')
    await expect(page.locator('.sug')).toHaveCount(2)
  })

  test('quiz cai nas regras quando a IA falha', async ({ page }) => {
    await page.unroute('**/api/recommend')
    await page.route('**/api/recommend', (r) => r.fulfill({ status: 500, json: { error: 'x' } }))
    await quizToFinal(page, 'Algo gelado', 'Docinho')
    await page.getByText('Nada, ver sugestões').click()
    await expect(page.locator('.source')).toContainText('Sugestão rápida')
    await expect(page.locator('.sug').first()).toBeVisible()
  })

  test('detalhe: tamanho fixo e tudo cabe sem rolar, nos piores casos de texto', async ({ page }) => {
    // tradução, história, ingredientes e nome mais longos; e um item com preços e alérgeno
    const ids = [
      'mocha-strate-frappuccino-com-caramelo-salgado-cold-foam', // nome e descrição mais longos
      'matcha-sem-acucar-latte-proteico-quente', // história mais longa
      'cheesecake-de-frutas-vermelhas', // "com o que se parece" mais longo
      'bolo-red-velvet-fatia', // ingredientes mais longos
      'cappuccino-doce-de-leite', // 4 tamanhos com preço e alérgeno
    ]
    const heights = new Set<number>()
    for (const id of ids) {
      await page.locator('.feed').evaluate((feed, id) => {
        const el = feed.querySelector<HTMLElement>(`[data-item="${id}"]`)!
        feed.scrollTo({ top: el.offsetTop })
      }, id)
      await page.locator(`[data-item="${id}"] .wantbtn`).click()
      const sheet = page.locator('.sheet-wrap--open .sheet')
      await expect(sheet).toBeVisible()
      await page.waitForTimeout(450)
      const tabs = sheet.getByRole('tab')
      await expect(tabs).toHaveCount(4)
      for (let t = 0; t < 4; t++) {
        await tabs.nth(t).click()
        const over = await sheet.evaluate((el) => {
          // o nome no carrossel de parecidos corta em 2 linhas de propósito (o produto abre com o nome inteiro)
          const list = [el, ...el.querySelectorAll<HTMLElement>('.detail__panel, .detail__panel *:not(.related__name)')]
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
    await quizToFinal(page)
    await page.getByText('Nada, ver sugestões').click()
    await page.locator('.sug__main').nth(1).click() // cafe-latte, longe do topo
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

  /** Abre o detalhe de um produto do feed. */
  async function openDetail(page: Page, id: string) {
    await page.locator('.feed').evaluate((feed, id) => {
      const el = feed.querySelector<HTMLElement>(`[data-item="${id}"]`)!
      feed.scrollTo({ top: el.offsetTop })
    }, id)
    await page.locator(`[data-item="${id}"] .wantbtn`).click()
    const sheet = page.locator('.sheet-wrap--open .sheet')
    await expect(sheet).toBeVisible()
    return sheet
  }

  test('detalhe mostra as tags numa linha só, com alvo de toque ≥ 44px', async ({ page }) => {
    const sheet = await openDetail(page, 'caramelo-macchiato')
    const tags = sheet.locator('.tag')
    await expect(tags).toHaveText(['Quente', 'Café', 'Caramelo', 'Cremoso', 'Docinho'])
    const first = await box(tags.first())
    const last = await box(tags.last())
    expect(Math.abs(first.y - last.y), 'tags numa linha só').toBeLessThanOrEqual(1)
    const hit = await tags.first().evaluate((el) => {
      const r = getComputedStyle(el, '::after')
      return el.getBoundingClientRect().height - parseFloat(r.top) - parseFloat(r.bottom)
    })
    expect(hit).toBeGreaterThanOrEqual(44)
  })

  test('tocar numa tag abre a grade só com os itens dela, e dá para limpar', async ({ page }) => {
    const sheet = await openDetail(page, 'caramelo-macchiato')
    await sheet.locator('.tag', { hasText: 'Caramelo' }).click()
    await expect(page.locator('.sheet-wrap--open')).toHaveCount(0)
    const grid = page.locator('.grid-view')
    await expect(grid).toBeVisible()
    await expect(grid.locator('.filter')).toContainText('Caramelo')
    const names = await grid.locator('.card__name').allTextContents()
    expect(names.length).toBeGreaterThan(5)
    await expect(grid.locator('.filter')).toContainText(`${names.length} itens`)
    expect(names).toContain('Caramelo Macchiato')
    expect(names).not.toContain('Café Americano')
    await grid.getByRole('button', { name: 'Limpar filtro' }).click()
    await expect(grid.locator('.filter')).toHaveCount(0)
    expect(await grid.locator('.card').count()).toBeGreaterThan(names.length)
  })

  test('aba Parecidos mostra produtos parecidos e abre o escolhido', async ({ page }) => {
    const sheet = await openDetail(page, 'refresher-de-morango')
    await sheet.getByRole('tab', { name: 'Parecidos' }).click()
    const rel = sheet.locator('.related__item')
    await expect(rel).toHaveCount(6)
    const names = await sheet.locator('.related__name').allTextContents()
    expect(names.every((n) => /Refresher|Drink/.test(n)), names.join(', ')).toBe(true)
    await rel.first().click()
    await expect(sheet.locator('.detail__name')).toHaveText(names[0])
    await expect(sheet.getByRole('tab', { name: 'Parece' })).toHaveAttribute('aria-selected', 'true')
  })

  test('parecidos de comida são comida', async ({ page }) => {
    const sheet = await openDetail(page, 'bolo-red-velvet-fatia')
    await sheet.getByRole('tab', { name: 'Parecidos' }).click()
    const names = await sheet.locator('.related__name').allTextContents()
    expect(names.some((n) => /Frappuccino|Latte/.test(n)), names.join(', ')).toBe(false)
  })
})

// ---------- sacola e pedido simulado ----------

const BRL = (v: string) => new RegExp(`R\\$\\s${v}`)

/** Vai até o produto no feed, toca em "Eu quero" e adiciona pelo detalhe. */
async function addFromFeed(page: Page, id: string) {
  await page.locator('.feed').evaluate((feed, id) => {
    const el = feed.querySelector<HTMLElement>(`[data-item="${id}"]`)!
    feed.scrollTo({ top: el.offsetTop })
  }, id)
  await page.locator(`[data-item="${id}"] .wantbtn`).click()
  await page.locator('.sheet-wrap--open .sheet .cta').click()
}

const bagButton = (page: Page) => page.locator('.dock__bag')
const sheetOpen = (page: Page) => page.locator('.sheet-wrap--open .sheet')

/** Abre a sacola pelo dock (os painéis só abrem com o dock visível). */
async function openBag(page: Page) {
  await bagButton(page).click()
  await expect(sheetOpen(page)).toBeVisible()
  await page.waitForTimeout(450)
}

const storedEvents = (page: Page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem('cm.events') ?? '[]') as { type: string; from?: string }[]))

test.describe('sacola e pedido', () => {
  test.beforeEach(async ({ page }) => open(page, { clock: true }))

  test('salgado entra direto na sacola e o número sobe', async ({ page }) => {
    await expect(page.locator('.dock__bag .count')).toHaveCount(0)
    await addFromFeed(page, 'misto-quente')
    const toast = page.locator('.toast')
    await expect(toast).toContainText('Adicionado à sacola')
    await expect(toast.getByRole('button')).toHaveText(['Desfazer'])
    await expect(page.locator('.dock__bag .count')).toHaveText('1')
    await expect(page.locator('[data-item="misto-quente"] .wantbtn .count')).toHaveText('1')
    await expect(page.locator('.dock__total')).toHaveText(BRL('19,90'))
    // "Desfazer" tira o que acabou de entrar
    await toast.getByRole('button', { name: 'Desfazer' }).click()
    await expect(page.locator('.dock__bag .count')).toHaveCount(0)
    await expect(page.locator('.toast')).toHaveCount(0)
  })

  test('bebida entra com o padrão e dá para personalizar: Grande + leite de aveia + 1 dose', async ({ page }) => {
    await addFromFeed(page, 'cafe-latte')
    const toast = page.locator('.toast')
    await expect(toast.getByRole('button')).toHaveText(['Usar o padrão', 'Personalizar'])
    await expect(page.locator('.dock__total')).toHaveText(BRL('16,90')) // Tall, leite integral
    await toast.getByRole('button', { name: 'Personalizar' }).click()
    const sheet = sheetOpen(page)
    await expect(sheet.locator('.detail__name')).toHaveText('Café Latte')
    await page.waitForTimeout(450)
    await expect(sheet.getByRole('radio', { name: /Tall/ })).toHaveAttribute('aria-checked', 'true')
    await expect(sheet.getByRole('radio', { name: /Leite integral/ })).toHaveAttribute('aria-checked', 'true')
    await sheet.getByRole('radio', { name: /Grande/ }).click()
    await sheet.getByRole('radio', { name: /Leite de aveia/ }).click()
    await sheet.getByRole('button', { name: 'Mais Dose extra de café' }).click()
    await sheet.locator('#custom-note').fill('bem quente')
    // 18,90 + 5,50 + 4,90
    await expect(sheet.locator('.cta')).toHaveText(/Salvar · R\$\s29,30/)
    await sheet.locator('.cta').click()
    await expect(page.locator('.sheet-wrap--open')).toHaveCount(0)
    await expect(page.locator('.dock__total')).toHaveText(BRL('29,30'))

    await openBag(page)
    const row = page.locator('.bagrow')
    await expect(row).toHaveCount(1)
    await expect(row.locator('.bagrow__sum')).toHaveText('Grande · Leite de aveia · +1 dose')
    await expect(row.locator('.bagrow__note')).toContainText('bem quente')
    await expect(row.locator('.bagrow__price')).toHaveText(BRL('29,30'))
  })

  test('o mesmo item com escolhas diferentes vira duas linhas; igual soma a quantidade', async ({ page }) => {
    await addFromFeed(page, 'cafe-latte')
    await page.locator('.toast').getByRole('button', { name: 'Usar o padrão' }).click()
    await addFromFeed(page, 'cafe-latte') // igual ao primeiro: só soma
    await page.locator('.toast').getByRole('button', { name: 'Personalizar' }).click()
    const sheet = sheetOpen(page)
    await page.waitForTimeout(450)
    await sheet.getByRole('radio', { name: /Grande/ }).click()
    await sheet.locator('.cta').click()

    await openBag(page)
    const rows = page.locator('.bagrow')
    // a unidade personalizada sai da linha padrão (que ficava com 2) e vira outra linha
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0).locator('.stepper__n')).toHaveText('1')
    await expect(rows.nth(1).locator('.bagrow__sum')).toHaveText('Grande')
    await expect(page.locator('.cart .foot__total strong')).toHaveText(BRL('35,80')) // 16,90 + 18,90
    // quantidade e remover
    await rows.nth(0).getByRole('button', { name: /^Mais/ }).click()
    await expect(rows.nth(0).locator('.stepper__n')).toHaveText('2')
    await expect(page.locator('.cart .foot__total strong')).toHaveText(BRL('52,70'))
    await rows.nth(1).getByRole('button', { name: /^Remover/ }).click()
    await expect(rows).toHaveCount(1)
  })

  test('sacola, nome e enviar levam a Recebido, Preparando e Pronto', async ({ page }) => {
    await addFromFeed(page, 'misto-quente')
    await openBag(page)
    await page.getByRole('button', { name: 'Continuar' }).click()
    const send = page.getByRole('button', { name: /^Enviar pedido/ })
    await expect(send).toBeDisabled() // sem nome, não envia
    await page.locator('#order-name').fill('Thiago')
    await expect(send).toHaveText(/Enviar pedido · R\$\s19,90/)
    await send.click()

    const now = page.locator('.sheet-wrap--open .step-row--now .step-row__label')
    await expect(page.locator('.sheet-wrap--open .order__code')).toHaveText(/^#[A-Z]\d{2}$/)
    await expect(now).toHaveText('Recebido')
    await expect(page.locator('.sheet-wrap--open .cart__count')).toHaveText('Thiago')
    await expect(page.locator('.sheet-wrap--open .recap')).toContainText('1× Misto Quente')
    await expect(page.locator('.sheet-wrap--open .ready')).toHaveCount(0)

    await page.clock.fastForward(4_000)
    await expect(now).toHaveText('Preparando')
    await page.clock.fastForward(5_000)
    await expect(page.locator('.sheet-wrap--open .ready h4')).toHaveText('Seu pedido está pronto, Thiago')
    await expect(page.locator('.sheet-wrap--open .step-row--done')).toHaveCount(3)

    await page.getByRole('button', { name: 'Pedir mais alguma coisa?' }).click()
    await expect(page.locator('.sheet-wrap--open')).toHaveCount(0)
    await expect(page.locator('.dock__total')).toHaveCount(0) // sacola e pedido zerados
    await expect(page.locator('.dock__bag .dock__lbl')).toHaveText('Sacola')
    const events = (await storedEvents(page)).map((e) => e.type)
    expect(events).toEqual(expect.arrayContaining(['cart_add', 'checkout_start', 'order_sent']))
  })

  test('recarregar mantém a sacola e o pedido em andamento', async ({ page }) => {
    await addFromFeed(page, 'misto-quente')
    await page.reload()
    await page.locator('[data-item]').first().waitFor()
    await expect(page.locator('.dock__bag .count')).toHaveText('1')
    await openBag(page)
    await expect(page.locator('.bagrow')).toHaveCount(1)
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.locator('#order-name').fill('Ana')
    await page.getByRole('button', { name: /^Enviar pedido/ }).click()
    await page.locator('.sheet-wrap--open .sheet__close').click()
    await expect(page.locator('.dock__status')).toHaveText('Recebido…')

    await page.reload()
    await page.locator('[data-item]').first().waitFor()
    await expect(page.locator('.dock__status')).toBeVisible() // o pedido continua
    await expect(page.locator('.dock__bag .count')).toHaveCount(0) // a sacola foi para o pedido

    // o andamento vem de sentAt: com o pedido "antigo", o celular já mostra Pronto
    await page.evaluate(() => {
      const o = JSON.parse(localStorage.getItem('cm.order')!)
      o.sentAt = Date.now() - 25_000
      localStorage.setItem('cm.order', JSON.stringify(o))
    })
    await page.reload()
    await page.locator('[data-item]').first().waitFor()
    await expect(page.locator('.dock__status')).toHaveText('Pronto!')
    await bagButton(page).click()
    await expect(page.locator('.sheet-wrap--open .ready h4')).toHaveText('Seu pedido está pronto, Ana')
  })

  test('item com alérgeno mostra o aviso no fechamento', async ({ page }) => {
    await addFromFeed(page, 'cappuccino-doce-de-leite')
    await page.locator('.toast').getByRole('button', { name: 'Usar o padrão' }).click()
    await addFromFeed(page, 'misto-quente')
    await openBag(page)
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.locator('.alert')).toHaveText('Contém lactose, glúten. Confirme com a equipe.')
  })

  test('adicionar pelo detalhe, pela grade e pelo quiz registra de onde veio', async ({ page }) => {
    // detalhe
    await page.locator('.wantbtn').first().click()
    await page.waitForTimeout(450)
    await expect(sheetOpen(page).locator('.cta')).toHaveText(/Adicionar · R\$\s\d+,\d{2}/)
    await sheetOpen(page).locator('.cta').click()
    await expect(page.locator('.sheet-wrap--open')).toHaveCount(0)
    await expect(page.locator('.dock__bag .count')).toHaveText('1')
    // grade
    await page.getByRole('button', { name: 'Ver tudo' }).click()
    await page.locator('.card__add').nth(3).click()
    await expect(page.locator('.dock__bag .count')).toHaveText('2')
    // quiz (IA simulada: caramelo-macchiato e cafe-latte)
    await quizToFinal(page)
    await page.getByText('Nada, ver sugestões').click()
    await page.locator('.sug__add').first().click()
    await page.locator('.sheet-wrap--open .sheet__close').click()
    await expect(page.locator('.dock__bag .count')).toHaveText('3')
    const events = (await storedEvents(page)).filter((e) => e.type === 'cart_add').map((e) => e.from)
    expect(events).toEqual(['detail', 'grid', 'quiz'])
  })

  test('os favoritos antigos viram itens da sacola, uma vez só', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('cm.favorites', JSON.stringify(['cafe-latte', 'misto-quente'])))
    await page.reload()
    await page.locator('[data-item]').first().waitFor()
    await expect(page.locator('.dock__bag .count')).toHaveText('2')
    expect(await page.evaluate(() => localStorage.getItem('cm.favorites'))).toBeNull()
    await page.reload()
    await page.locator('[data-item]').first().waitFor()
    await expect(page.locator('.dock__bag .count')).toHaveText('2') // não dobra
  })

  test('o app funciona sem localStorage', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('sem storage')
        },
      })
    })
    await page.reload()
    await page.locator('[data-item]').first().waitFor()
    await addFromFeed(page, 'misto-quente')
    await expect(page.locator('.dock__bag .count')).toHaveText('1')
  })
})

// A sacola e a personalização cabem em qualquer celular e têm alvos de toque ≥ 44px.
test.describe('sacola e pedido: layout', () => {
  test.beforeEach(async ({ page }) => open(page, { clock: true }))

  /** O painel aberto cabe na tela, não rola para o lado e todo botão tem pelo menos 44px. */
  async function expectSheetFits(page: Page, what: string) {
    const sheet = sheetOpen(page)
    await expect(sheet).toBeVisible()
    await page.waitForTimeout(500)
    const vp = page.viewportSize()!
    const s = await box(sheet)
    expect(s.x, what).toBeGreaterThanOrEqual(0)
    expect(s.right, what).toBeLessThanOrEqual(vp.width + 0.5)
    expect(s.y, what).toBeGreaterThanOrEqual(0)
    expect(s.bottom, what).toBeLessThanOrEqual(vp.height + 0.5)
    const info = await sheet.evaluate((el) => {
      const sr = el.getBoundingClientRect()
      const small: string[] = []
      const wide: string[] = []
      for (const b of el.querySelectorAll<HTMLElement>('button, input, [role=radio], [role=switch]')) {
        if (b.classList.contains('sheet__close')) continue // o X é do painel, anterior à sacola
        const r = b.getBoundingClientRect()
        if (r.width && (r.height < 43.5 || r.width < 43.5)) small.push(`${b.className || b.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`)
      }
      for (const n of el.querySelectorAll<HTMLElement>('*')) {
        const r = n.getBoundingClientRect()
        if (r.width && (r.left < sr.left - 0.5 || r.right > sr.right + 0.5) && !n.closest('.sheet__grip')) wide.push(`${n.className} ${Math.round(r.left)}..${Math.round(r.right)}`)
      }
      const cut = [...el.querySelectorAll<HTMLElement>('.pane, .pane *')].filter((n) => n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflowX === 'visible' && n.clientWidth > 0).map((n) => n.className)
      return { small, wide, cut }
    })
    expect(info.small, `${what}: alvos de toque menores que 44px`).toEqual([])
    expect(info.wide, `${what}: elementos para fora do painel`).toEqual([])
    expect(info.cut, `${what}: conteúdo que passa da largura`).toEqual([])
    const fh = sheet.locator('.foot')
    if (await fh.count()) expect((await box(fh)).bottom, `${what}: rodapé`).toBeLessThanOrEqual(s.bottom)
  }

  test('sacola, fechamento e pedido', async ({ page }) => {
    // o pior caso: nomes longos, observação, personalização e alérgenos
    await addFromFeed(page, 'mocha-strate-frappuccino-com-caramelo-salgado-cold-foam')
    await page.locator('.toast').getByRole('button', { name: 'Personalizar' }).click()
    const custom = sheetOpen(page)
    await page.waitForTimeout(450)
    await custom.getByRole('radio', { name: /Leite vegetal de coco/ }).click()
    await custom.getByRole('button', { name: /^Mais/ }).first().click()
    await custom.locator('#custom-note').fill('bem gelado, pouco gelo e um canudo de papel')
    await expectSheetFits(page, 'personalização')
    await custom.locator('.cta').click()
    await addFromFeed(page, 'misto-quente')
    await page.locator('.toast').getByRole('button', { name: 'Desfazer' }).waitFor()

    await openBag(page)
    await expectSheetFits(page, 'sacola')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.locator('#order-name').fill('Maria Eduarda')
    await expectSheetFits(page, 'fechamento')
    await page.getByRole('button', { name: /^Enviar pedido/ }).click()
    await expectSheetFits(page, 'pedido')
    await page.clock.fastForward(21_000)
    await expect(page.locator('.sheet-wrap--open .ready')).toBeVisible()
    await expectSheetFits(page, 'pedido pronto')
  })

  test('sacola vazia e dock com a sacola cheia cabem na tela', async ({ page }) => {
    await bagButton(page).click()
    await expect(page.locator('.sheet-wrap--open .empty')).toBeVisible()
    await expectSheetFits(page, 'sacola vazia')
    await page.locator('.sheet-wrap--open .sheet__close').click()
    await expect(page.locator('.sheet-wrap--open')).toHaveCount(0)

    for (const id of ['cafe-latte', 'cafe-mocha', 'misto-quente']) {
      await addFromFeed(page, id)
    }
    await page.waitForTimeout(500)
    const vp = page.viewportSize()!
    const dock = await box(page.locator('.dock'))
    expect(dock.right).toBeLessThanOrEqual(vp.width)
    const group = await box(page.locator('.dock__group'))
    expect(group.x).toBeGreaterThanOrEqual(0)
    expect(group.right).toBeLessThanOrEqual(vp.width - 8)
    const bag = page.locator('.dock__bag')
    expect(await bag.evaluate((el) => el.scrollWidth > el.clientWidth + 1)).toBe(false)
    for (const l of await page.locator('.dock button').all()) {
      const b = await box(l)
      expect(b.height).toBeGreaterThanOrEqual(44)
      expect(b.width).toBeGreaterThanOrEqual(42)
    }
  })

  test('o aviso de "Adicionado" cabe na tela e não cobre os botões do produto', async ({ page }) => {
    await addFromFeed(page, 'cafe-latte')
    const t = await box(page.locator('.toast'))
    const vp = page.viewportSize()!
    expect(t.x).toBeGreaterThanOrEqual(0)
    expect(t.right).toBeLessThanOrEqual(vp.width)
    expect(t.y).toBeGreaterThanOrEqual((await box(page.locator('.cats'))).bottom)
    // o botão de sacola do produto continua livre para outro toque
    expect(t.bottom).toBeLessThanOrEqual((await box(page.locator('[data-item="cafe-latte"] .wantbtn'))).y)
    for (const b of await page.locator('.toast__btn').all()) expect((await box(b)).height).toBeGreaterThanOrEqual(44)
  })

  test('todo botão de ícone tem um texto de apoio visível', async ({ page }) => {
    // dock: cada ícone com o nome embaixo
    await expect(page.locator('.dock__bag .dock__lbl')).toHaveText('Sacola')
    await expect(page.getByRole('button', { name: 'Ver tudo' }).locator('.dock__lbl')).toHaveText('Ver tudo')
    await expect(page.locator('.dock__help .dock__lbl')).toHaveText('Me ajuda')
    // feed
    await expect(page.locator('.wantbtn').first()).toContainText('Eu quero')
    // com algo na sacola, o "Me ajuda" continua com o texto e a sacola mostra o total
    await addFromFeed(page, 'misto-quente')
    await expect(page.locator('.dock__help .dock__lbl')).toBeVisible()
    await expect(page.locator('.dock__bag .dock__lbl')).toHaveText(BRL('19,90'))
    // sacola: editar e remover por extenso
    await openBag(page)
    const row = page.locator('.sheet-wrap--open .bagrow').first()
    await expect(row.locator('.tool').first()).toHaveText('Editar')
    await expect(row.locator('.tool').nth(1)).toHaveText('Remover')
    await page.locator('.sheet-wrap--open .sheet__close').click()
    // grade
    await page.getByRole('button', { name: 'Ver tudo' }).click()
    await expect(page.locator('.card__add').first()).toHaveText('Adicionar')
    await expect(page.getByRole('button', { name: 'Ver em tela cheia' }).locator('.dock__lbl')).toHaveText('Tela cheia')
  })

  test('botões de sacola do feed, da grade e do quiz têm pelo menos 44px', async ({ page }) => {
    const feedBtn = await box(page.locator('.wantbtn').first())
    expect(feedBtn.width).toBeGreaterThanOrEqual(44)
    expect(feedBtn.height).toBeGreaterThanOrEqual(44)
    await page.getByRole('button', { name: 'Ver tudo' }).click()
    const gridBtn = await box(page.locator('.card__add').first())
    expect(gridBtn.width).toBeGreaterThanOrEqual(44)
    const card = await box(page.locator('.card').first())
    expect(gridBtn.right).toBeLessThanOrEqual(card.right)
  })
})

// Capturas de referência: qualquer mudança visual não intencional quebra o teste.
// Para aceitar uma mudança de propósito: npx playwright test --update-snapshots
test.describe('visual', () => {
  test.beforeEach(async ({ page }) => open(page, { clock: true }))

  test('feed', async ({ page }) => {
    await expect(page).toHaveScreenshot('feed.png')
  })
  test('detalhe', async ({ page }) => {
    await page.locator('.wantbtn').first().click()
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
  test('sacola', async ({ page }) => {
    await addFromFeed(page, 'cafe-latte')
    await page.locator('.toast').getByRole('button', { name: 'Personalizar' }).click()
    await page.waitForTimeout(450)
    await sheetOpen(page).getByRole('radio', { name: /Grande/ }).click()
    await sheetOpen(page).getByRole('radio', { name: /Leite de aveia/ }).click()
    await sheetOpen(page).getByRole('button', { name: 'Mais Dose extra de café' }).click()
    await sheetOpen(page).locator('#custom-note').fill('bem quente')
    await sheetOpen(page).locator('.cta').click()
    await addFromFeed(page, 'misto-quente')
    await openBag(page)
    await expect(page).toHaveScreenshot('sacola.png')
  })
  test('personalizar', async ({ page }) => {
    await addFromFeed(page, 'cafe-mocha')
    await page.locator('.toast').getByRole('button', { name: 'Personalizar' }).click()
    await page.waitForTimeout(500)
    await expect(page).toHaveScreenshot('personalizar.png')
  })
  test('pedido', async ({ page }) => {
    await page.evaluate(() => {
      Math.random = () => 0.3 // número do pedido fixo, para a captura não variar
    })
    await addFromFeed(page, 'cafe-latte')
    await openBag(page)
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.locator('#order-name').fill('Thiago')
    await page.getByRole('button', { name: /^Enviar pedido/ }).click()
    await page.clock.fastForward(4_000)
    await page.waitForTimeout(300)
    await expect(page).toHaveScreenshot('pedido.png')
  })
})
