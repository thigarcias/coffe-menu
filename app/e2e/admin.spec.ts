import { expect, test, type Locator } from '@playwright/test'

const box = async (l: Locator) => {
  const b = await l.boundingBox()
  if (!b) throw new Error('sem caixa')
  return { ...b, right: b.x + b.width, bottom: b.y + b.height }
}

test.describe('painel do dono (/admin) no celular', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Painel', level: 1 })).toBeVisible()
  })

  test('não rola para o lado e todos os cards cabem na largura', async ({ page }) => {
    const r = await page.evaluate(() => {
      const adm = document.querySelector('.adm') as HTMLElement
      const W = adm.clientWidth
      return {
        overflowX: adm.scrollWidth - adm.clientWidth,
        pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
        wide: [...adm.querySelectorAll('.adm-card, .adm-top__inner')].filter((e) => e.getBoundingClientRect().right > W + 0.5).length,
      }
    })
    expect(r.overflowX).toBe(0)
    expect(r.pageOverflow).toBe(0)
    expect(r.wide).toBe(0)
  })

  test('avisa que os números são de exemplo', async ({ page }) => {
    await expect(page.getByText('Dados de exemplo')).toBeVisible()
  })

  test('cinco indicadores: o de vendas ocupa a linha toda e os outros quatro ficam em 2 × 2', async ({ page }) => {
    const k = page.locator('.adm-kpi')
    await expect(k).toHaveCount(5)
    const [hero, a, b, c, d] = await Promise.all([0, 1, 2, 3, 4].map((i) => box(k.nth(i))))
    expect(hero.width).toBeGreaterThan(a.width * 1.8)
    expect(Math.abs(a.y - b.y)).toBeLessThan(2)
    expect(Math.abs(c.y - d.y)).toBeLessThan(2)
    expect(c.y).toBeGreaterThan(a.bottom)
    // o número não pode estourar o cartão (no iPhone SE o espaço é de ~140px)
    for (const i of [1, 2, 3, 4]) {
      const sw = await k.nth(i).locator('.adm-kpi__value').evaluate((e) => e.scrollWidth - e.clientWidth)
      expect(sw).toBeLessThanOrEqual(0)
    }
  })

  test('alvos de toque com pelo menos 44px (período, tabela e link)', async ({ page }) => {
    for (const l of [page.getByRole('button', { name: 'Hoje' }), page.getByRole('button', { name: '7 dias' }), page.getByRole('button', { name: '30 dias' }), page.getByRole('button', { name: 'Ver como tabela' }), page.getByRole('link', { name: 'Voltar ao cardápio' })]) {
      expect((await box(l)).height).toBeGreaterThanOrEqual(43.5)
    }
  })

  test('trocar o período troca os números e o gráfico', async ({ page }) => {
    const sales = page.locator('.adm-kpi').first().locator('.adm-kpi__value')
    const before = await sales.textContent()
    await page.getByRole('button', { name: 'Hoje' }).click()
    await expect(page.getByRole('button', { name: 'Hoje' })).toHaveAttribute('aria-pressed', 'true')
    expect(await sales.textContent()).not.toBe(before)
    await page.getByRole('button', { name: 'Ver como tabela' }).click()
    await expect(page.getByRole('columnheader', { name: 'Hora' })).toBeVisible()
    await page.getByRole('button', { name: 'Ver gráfico' }).click()
    await expect(page.locator('.adm-line svg')).toBeVisible()
  })

  test('passar o dedo ou o mouse no gráfico mostra o valor do dia', async ({ page }) => {
    const svg = page.locator('.adm-line svg').first()
    await svg.scrollIntoViewIfNeeded()
    const b = await box(svg)
    await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.5)
    const tip = page.locator('.adm-tip')
    await expect(tip).toBeVisible()
    await expect(tip).toContainText('R$')
    // a dica fica dentro do cartão do gráfico
    const t = await box(tip)
    const c = await box(page.locator('.adm-line'))
    expect(t.x).toBeGreaterThanOrEqual(c.x - 1)
    expect(t.right).toBeLessThanOrEqual(c.right + 1)
  })

  test('mapa de calor: tocar numa célula diz o dia, a hora e os pedidos', async ({ page }) => {
    const cell = page.locator('.adm-heat__cell').nth(30)
    await cell.scrollIntoViewIfNeeded()
    await cell.click()
    await expect(page.locator('.adm-heat__read')).toContainText('pedidos')
  })

  test('as barras ocupam a largura do cartão (nada de barra minúscula)', async ({ page }) => {
    // regressão: sem miniatura, a coluna extra deixava a barra com uma fração da largura
    const first = page.locator('.adm-card', { hasText: 'Vendas por categoria' }).locator('.adm-bar__track').first()
    await first.scrollIntoViewIfNeeded()
    const card = await box(page.locator('.adm-card', { hasText: 'Vendas por categoria' }))
    expect((await box(first)).width).toBeGreaterThan(card.width * 0.4)
  })

  test('o seletor de período e o resto do topo não se sobrepõem (iPhone SE)', async ({ page }) => {
    const seg = await box(page.locator('.adm-seg'))
    const brand = await box(page.locator('.adm-top__brand'))
    expect(seg.y).toBeGreaterThanOrEqual(brand.bottom - 1)
    const vw = page.viewportSize()!.width
    expect(seg.right).toBeLessThanOrEqual(vw)
    // nenhum botão do seletor é cortado
    for (const n of ['Hoje', '7 dias', '30 dias']) {
      const b = await box(page.getByRole('button', { name: n }))
      expect(b.right).toBeLessThanOrEqual(seg.right + 1)
    }
  })

  test('a dica do gráfico não quebra o rótulo em duas linhas', async ({ page }) => {
    const svg = page.locator('.adm-line svg').first()
    await svg.scrollIntoViewIfNeeded()
    const b = await box(svg)
    await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5)
    const row = page.locator('.adm-tip span').first()
    await expect(row).toBeVisible()
    expect((await box(row)).height).toBeLessThan(22)
  })

  test('o cardápio não baixa o código do painel', async ({ page }) => {
    const reqs: string[] = []
    page.on('request', (r) => reqs.push(r.url()))
    await page.goto('/')
    await expect(page.locator('.slide').first()).toBeVisible()
    expect(reqs.filter((u) => /Admin-.*\.(js|css)/.test(u))).toEqual([])
  })
})

test.describe('painel do dono (/admin) no desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 })
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Painel', level: 1 })).toBeVisible()
  })

  test('indicadores numa linha só e gráfico ao lado do funil', async ({ page }) => {
    const k = page.locator('.adm-kpi')
    const ys = await Promise.all([0, 1, 2, 3, 4].map(async (i) => (await box(k.nth(i))).y))
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2)
    const chart = await box(page.locator('.adm-card').filter({ has: page.getByRole('heading', { name: 'Vendas no período', exact: true }) }))
    const funnel = await box(page.locator('.adm-card', { hasText: 'Do cardápio ao pedido' }))
    expect(Math.abs(chart.y - funnel.y)).toBeLessThan(2)
    expect(funnel.x).toBeGreaterThan(chart.right)
    expect(chart.width).toBeGreaterThan(funnel.width * 1.6)
  })

  test('o conteúdo respeita a largura máxima e fica centralizado', async ({ page }) => {
    const g = await box(page.locator('.adm-grid'))
    expect(g.width).toBeLessThanOrEqual(1280)
    const adm = page.locator('.adm')
    const sw = await adm.evaluate((e) => e.scrollWidth - e.clientWidth)
    expect(sw).toBe(0)
  })

  test('a vitrine mostra os quatro grupos lado a lado', async ({ page }) => {
    const cols = page.locator('.adm-radar__col')
    await expect(cols).toHaveCount(4)
    const ys = await Promise.all([0, 1, 2, 3].map(async (i) => (await box(cols.nth(i))).y))
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2)
  })
})
