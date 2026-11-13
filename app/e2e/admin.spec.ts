import { expect, test, type Locator, type Page } from '@playwright/test'

const box = async (l: Locator) => {
  const b = await l.boundingBox()
  if (!b) throw new Error('sem caixa')
  return { ...b, right: b.x + b.width, bottom: b.y + b.height }
}

const TABS = ['Visão geral', 'Vendas', 'Produtos', 'IA e Parecidos', 'Tráfego', 'Sessões'] as const
const IDS: Record<(typeof TABS)[number], string> = { 'Visão geral': 'visao', Vendas: 'vendas', Produtos: 'produtos', 'IA e Parecidos': 'ia', Tráfego: 'trafego', Sessões: 'sessoes' }

const tab = (page: Page, name: (typeof TABS)[number]) => page.getByRole('tab', { name, exact: true })
const goTab = async (page: Page, name: (typeof TABS)[number]) => {
  await tab(page, name).click()
  await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true')
}

test.describe('painel do dono (/admin) no celular', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Painel', level: 1 })).toBeVisible()
  })

  test('não rola para o lado, em nenhuma aba, e todos os cards cabem na largura', async ({ page }) => {
    for (const t of TABS) {
      await goTab(page, t)
      const r = await page.evaluate(() => {
        const adm = document.querySelector('.adm') as HTMLElement
        const W = adm.clientWidth
        return {
          overflowX: adm.scrollWidth - adm.clientWidth,
          pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
          wide: [...adm.querySelectorAll('.adm-card, .adm-top__inner')].filter((e) => e.getBoundingClientRect().right > W + 0.5).length,
        }
      })
      expect(r, t).toEqual({ overflowX: 0, pageOverflow: 0, wide: 0 })
    }
  })

  test('avisa que os números são de exemplo', async ({ page }) => {
    await expect(page.getByText('Dados de exemplo')).toBeVisible()
  })

  test('abre na Visão geral: cinco indicadores, o de vendas na linha toda e os outros quatro em 2 × 2', async ({ page }) => {
    await expect(tab(page, 'Visão geral')).toHaveAttribute('aria-selected', 'true')
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

  test('menu em abas: cada item mostra só a sua seção', async ({ page }) => {
    await expect(page.getByRole('tablist', { name: 'Seções do painel' }).getByRole('tab')).toHaveText([...TABS])
    for (const t of TABS) {
      await goTab(page, t)
      // só um painel existe por vez: as outras seções saem da tela e do código
      await expect(page.getByRole('tabpanel')).toHaveCount(1)
      await expect(page.locator(`#${IDS[t]}`)).toBeVisible()
      for (const other of TABS) if (other !== t) await expect(page.locator(`#${IDS[other]}`)).toHaveCount(0)
      await expect(page.locator(`#h-${IDS[t]}`)).toHaveText(t)
    }
  })

  test('trocar de aba volta ao alto da página', async ({ page }) => {
    await goTab(page, 'Produtos')
    await page.locator('.adm').evaluate((el) => el.scrollTo(0, el.scrollHeight))
    expect(await page.locator('.adm').evaluate((el) => el.scrollTop)).toBeGreaterThan(100)
    await goTab(page, 'Tráfego')
    expect(await page.locator('.adm').evaluate((el) => el.scrollTop)).toBe(0)
  })

  test('a aba fica no endereço: abrir /admin#vendas já mostra Vendas', async ({ page }) => {
    await goTab(page, 'IA e Parecidos')
    expect(page.url()).toContain('#ia')
    await page.goto('/admin#vendas')
    await expect(tab(page, 'Vendas')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('#vendas')).toBeVisible()
    // endereço desconhecido cai na Visão geral
    await page.goto('/admin#nada')
    await expect(tab(page, 'Visão geral')).toHaveAttribute('aria-selected', 'true')
  })

  test('teclado: setas, Home e End trocam de aba', async ({ page }) => {
    await tab(page, 'Visão geral').focus()
    await page.keyboard.press('ArrowRight')
    await expect(tab(page, 'Vendas')).toHaveAttribute('aria-selected', 'true')
    await expect(tab(page, 'Vendas')).toBeFocused()
    await page.keyboard.press('End')
    await expect(tab(page, 'Sessões')).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowRight')
    await expect(tab(page, 'Visão geral')).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowLeft')
    await expect(tab(page, 'Sessões')).toHaveAttribute('aria-selected', 'true')
  })

  test('a aba ativa fica inteira à vista dentro do menu (que rola de lado no celular)', async ({ page }) => {
    const nav = page.getByRole('tablist', { name: 'Seções do painel' })
    for (const t of ['Tráfego', 'IA e Parecidos', 'Visão geral'] as const) {
      await goTab(page, t)
      await expect
        .poll(async () => {
          const n = await box(nav)
          const b = await box(tab(page, t))
          return b.x >= n.x - 1 && b.right <= n.right + 1
        })
        .toBe(true)
    }
  })

  test('o filtro de período fica no começo da página, não no topo fixo, e vale para todas as abas', async ({ page }) => {
    await expect(page.locator('.adm-top .adm-seg')).toHaveCount(0)
    const seg = page.locator('.adm-filters .adm-seg')
    await expect(seg).toBeVisible()
    const top = await box(page.locator('.adm-top'))
    const s = await box(seg)
    expect(s.y).toBeGreaterThanOrEqual(top.bottom - 1)
    expect(s.right).toBeLessThanOrEqual(page.viewportSize()!.width)
    for (const n of ['Hoje', '7 dias', '30 dias']) expect((await box(seg.getByRole('button', { name: n }))).right).toBeLessThanOrEqual(s.right + 1)
    // escolhido numa aba, vale nas outras
    await seg.getByRole('button', { name: '30 dias' }).click()
    await goTab(page, 'Vendas')
    await expect(seg.getByRole('button', { name: '30 dias' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Comparado com 30 dias antes')).toBeVisible()
    await goTab(page, 'Tráfego')
    await expect(seg).toBeVisible()
    expect((await box(page.locator('.adm-top'))).y).toBeLessThanOrEqual(1)
  })

  test('alvos de toque com pelo menos 44px (abas, período, tabela e link)', async ({ page }) => {
    for (const t of TABS) expect((await box(tab(page, t))).height).toBeGreaterThanOrEqual(43.5)
    for (const n of ['Hoje', '7 dias', '30 dias']) expect((await box(page.getByRole('button', { name: n }))).height).toBeGreaterThanOrEqual(43.5)
    expect((await box(page.getByRole('link', { name: 'Voltar ao cardápio' }))).height).toBeGreaterThanOrEqual(43.5)
    await goTab(page, 'Vendas')
    expect((await box(page.getByRole('button', { name: 'Ver como tabela' }))).height).toBeGreaterThanOrEqual(43.5)
  })

  test('topo fixo enxuto: deixa espaço para o conteúdo (≤ 130px)', async ({ page }) => {
    expect((await box(page.locator('.adm-top'))).height).toBeLessThanOrEqual(130)
  })

  test('trocar o período troca os números e o gráfico', async ({ page }) => {
    const sales = page.locator('.adm-kpi').first().locator('.adm-kpi__value')
    const before = await sales.textContent()
    await page.getByRole('button', { name: 'Hoje' }).click()
    await expect(page.getByRole('button', { name: 'Hoje' })).toHaveAttribute('aria-pressed', 'true')
    expect(await sales.textContent()).not.toBe(before)
    await goTab(page, 'Vendas')
    await page.getByRole('button', { name: 'Ver como tabela' }).click()
    await expect(page.getByRole('columnheader', { name: 'Hora' })).toBeVisible()
    await page.getByRole('button', { name: 'Ver gráfico' }).click()
    await expect(page.locator('.adm-line svg')).toBeVisible()
  })

  test('passar o dedo ou o mouse no gráfico mostra o valor do dia', async ({ page }) => {
    await goTab(page, 'Vendas')
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

  test('a dica do gráfico não quebra o rótulo em duas linhas', async ({ page }) => {
    await goTab(page, 'Vendas')
    const svg = page.locator('.adm-line svg').first()
    await svg.scrollIntoViewIfNeeded()
    const b = await box(svg)
    await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5)
    const row = page.locator('.adm-tip span').first()
    await expect(row).toBeVisible()
    expect((await box(row)).height).toBeLessThan(22)
  })

  test('mapa de calor: tocar numa célula diz o dia, a hora e os pedidos', async ({ page }) => {
    await goTab(page, 'Tráfego')
    await page.locator('.adm-heat__cell').nth(30).click()
    await expect(page.locator('.adm-heat__read')).toContainText('pedidos')
  })

  test('as barras ocupam a largura do cartão (nada de barra minúscula)', async ({ page }) => {
    // regressão: sem miniatura, a coluna extra deixava a barra com uma fração da largura
    await goTab(page, 'Produtos')
    const card = page.locator('.adm-card').filter({ has: page.getByRole('heading', { name: 'Vendas por categoria', exact: true }) })
    expect((await box(card.locator('.adm-bar__track').first())).width).toBeGreaterThan((await box(card)).width * 0.4)
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

  test('Visão geral: indicadores numa linha só', async ({ page }) => {
    const k = page.locator('.adm-kpi')
    const ys = await Promise.all([0, 1, 2, 3, 4].map(async (i) => (await box(k.nth(i))).y))
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2)
  })

  test('Vendas: gráfico ao lado do funil, com a mesma altura', async ({ page }) => {
    await goTab(page, 'Vendas')
    const chart = await box(page.locator('.adm-card').filter({ has: page.getByRole('heading', { name: 'Vendas no período', exact: true }) }))
    const funnel = await box(page.locator('.adm-card').filter({ has: page.getByRole('heading', { name: 'Do cardápio ao pedido', exact: true }) }))
    expect(Math.abs(chart.y - funnel.y)).toBeLessThan(2)
    expect(funnel.x).toBeGreaterThan(chart.right)
    expect(chart.width).toBeGreaterThan(funnel.width * 1.6)
    // o gráfico enche o cartão (sem um vazio grande embaixo)
    const plot = await box(page.locator('.adm-line svg'))
    expect(chart.bottom - plot.bottom).toBeLessThan(120)
  })

  test('cada aba cabe em pouco mais de uma tela (é enxuto)', async ({ page }) => {
    for (const t of TABS) {
      await goTab(page, t)
      const h = await page.locator('.adm').evaluate((e) => e.scrollHeight)
      expect(h, t).toBeLessThan(1400)
    }
  })

  test('o conteúdo respeita a largura máxima e não rola para o lado', async ({ page }) => {
    const g = await box(page.locator('.adm-main'))
    expect(g.width).toBeLessThanOrEqual(1280)
    expect(await page.locator('.adm').evaluate((e) => e.scrollWidth - e.clientWidth)).toBe(0)
  })

  test('topo numa linha só: marca, abas centralizadas e link do cardápio', async ({ page }) => {
    const top = await box(page.locator('.adm-top'))
    expect(top.height).toBeLessThanOrEqual(80)
    const brand = await box(page.locator('.adm-top__brand'))
    const nav = await box(page.locator('.adm-nav'))
    const link = await box(page.getByRole('link', { name: 'Ver cardápio' }))
    expect(Math.abs(nav.y - brand.y)).toBeLessThan(30)
    expect(nav.x).toBeGreaterThan(brand.right)
    expect(link.x).toBeGreaterThan(nav.right)
    expect(await page.locator('.adm-nav').evaluate((e) => e.scrollWidth - e.clientWidth)).toBe(0)
  })

  test('IA e Parecidos: os dois cartões ficam lado a lado', async ({ page }) => {
    await goTab(page, 'IA e Parecidos')
    const a = await box(page.locator('#ia .adm-card').nth(0))
    const b = await box(page.locator('#ia .adm-card').nth(1))
    expect(Math.abs(a.y - b.y)).toBeLessThan(2)
  })

  test('Produtos: a vitrine mostra os quatro grupos lado a lado', async ({ page }) => {
    await goTab(page, 'Produtos')
    const cols = page.locator('.adm-radar__col')
    await expect(cols).toHaveCount(4)
    const ys = await Promise.all([0, 1, 2, 3].map(async (i) => (await box(cols.nth(i))).y))
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2)
  })
})
