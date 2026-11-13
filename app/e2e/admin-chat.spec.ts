import { expect, test, type Locator, type Page } from '@playwright/test'

const box = async (l: Locator) => {
  const b = await l.boundingBox()
  if (!b) throw new Error('sem caixa')
  return { ...b, right: b.x + b.width, bottom: b.y + b.height }
}

/** Estes testes usam as respostas de exemplo do código (`cm.admin.mock`), não a OpenAI. A IA de verdade é testada em admin-chat-ia.spec.ts. */
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('cm.admin.mock', '1'))
})

/** Nos testes de "andamento" a IA de exemplo roda no ritmo normal (uns 3 s); nos demais, acelerada. */
const fast = (page: Page) => page.addInitScript(() => localStorage.setItem('cm.admin.fast', '1'))

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Chat com a IA' })
const openChat = async (page: Page) => {
  await page.getByRole('button', { name: 'Perguntar à IA' }).click()
  await expect(dialog(page)).toBeVisible()
}
const ask = async (page: Page, q: string) => {
  const box = page.getByLabel('Pergunta para a IA')
  await box.fill(q)
  await box.press('Enter')
}
const sessionIds = (page: Page) => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('cm.admin.chats') ?? '{}')))

test.describe('chat da IA no painel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Painel', level: 1 })).toBeVisible()
  })

  test('o botão tem texto, e o chat começa fechado', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Perguntar à IA' })).toBeVisible()
    await expect(dialog(page)).toHaveCount(0)
  })

  test('abre por cima do painel e Esc fecha', async ({ page }) => {
    await openChat(page)
    await expect(page.getByText('O que você quer ver?')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toHaveCount(0)
  })

  test('no celular o chat ocupa a tela toda', async ({ page }) => {
    await openChat(page)
    const b = await box(dialog(page))
    const vw = page.viewportSize()!.width
    expect(Math.round(b.width)).toBe(vw)
    expect(b.x).toBeLessThanOrEqual(1)
  })
})

test.describe('chat da IA: conversa e andamento', () => {
  test('a pergunta vira resposta com gráfico e texto', async ({ page }) => {
    await fast(page)
    await page.goto('/admin')
    await openChat(page)
    await ask(page, 'Como foram as vendas nos últimos dias?')
    await expect(dialog(page).locator('.adm-msg--user')).toContainText('Como foram as vendas')
    await expect(dialog(page).locator('.adm-msg--assistant svg').first()).toBeVisible()
    await expect(dialog(page).locator('.adm-chat__text').last()).toContainText('Dados de exemplo')
    // a resposta terminou: dá para perguntar de novo
    await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible()
  })

  test('cada tipo de pergunta traz o bloco certo', async ({ page }) => {
    await fast(page)
    await page.goto('/admin')
    await openChat(page)
    for (const [q, sel] of [
      ['Onde as pessoas desistem?', '.adm-funnel'],
      ['Quais horários vendem mais?', '.adm-heat'],
      ['Quais produtos vendem mais?', '.adm-bars'],
      ['O que a IA mais recomenda?', '.adm-stats'],
    ] as const) {
      await ask(page, q)
      await expect(dialog(page).locator(sel).last()).toBeVisible()
      await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible()
    }
  })

  test('pergunta que não entende recebe um texto com o que dá para perguntar', async ({ page }) => {
    await fast(page)
    await page.goto('/admin')
    await openChat(page)
    await ask(page, 'blablabla')
    await expect(dialog(page).locator('.adm-chat__text').last()).toContainText('exemplos prontos')
  })

  test('fechar o chat NÃO interrompe a resposta: ela continua e aparece em Sessões', async ({ page }) => {
    await page.goto('/admin')
    await openChat(page)
    await ask(page, 'Como foram as vendas?')
    await expect(dialog(page).locator('.adm-chat__status')).toBeVisible()
    await page.getByRole('button', { name: 'Fechar chat' }).click()
    await expect(dialog(page)).toHaveCount(0)
    await page.getByRole('tab', { name: 'Sessões' }).click()
    const row = page.locator('[data-session]').first()
    await expect(row.locator('.adm-chip')).toHaveText('Rodando')
    await expect(row.locator('.adm-chip')).toHaveText('Concluída', { timeout: 15_000 })
    // ao reabrir, a resposta completa está lá
    await row.getByRole('button', { name: /^Abrir conversa/ }).click()
    await expect(dialog(page).locator('.adm-msg--assistant svg').first()).toBeVisible()
  })

  test('parar a resposta libera o campo e avisa', async ({ page }) => {
    await page.goto('/admin')
    await openChat(page)
    await ask(page, 'Como foram as vendas?')
    await page.getByRole('button', { name: 'Parar' }).click()
    await expect(dialog(page).getByText('Você parou esta resposta.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible()
    await expect(page.getByLabel('Pergunta para a IA')).toBeEnabled()
  })

  test('o histórico sobrevive a recarregar a página', async ({ page }) => {
    await fast(page)
    await page.goto('/admin')
    await openChat(page)
    await ask(page, 'Quais produtos vendem mais?')
    await expect(dialog(page).locator('.adm-bars')).toBeVisible()
    await page.reload()
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page).locator('.adm-msg--user')).toContainText('Quais produtos vendem mais?')
    await expect(dialog(page).locator('.adm-bars')).toBeVisible()
  })

  test('várias sessões: cada uma com seu histórico, listadas em Sessões', async ({ page }) => {
    await fast(page)
    await page.goto('/admin')
    await openChat(page)
    await ask(page, 'Onde as pessoas desistem?')
    await expect(dialog(page).locator('.adm-funnel')).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Nova conversa' }).click()
    await expect(page.getByText('O que você quer ver?')).toBeVisible()
    await ask(page, 'Quais horários vendem mais?')
    await expect(dialog(page).locator('.adm-heat')).toBeVisible()
    await page.getByRole('button', { name: 'Fechar chat' }).click()
    await page.getByRole('tab', { name: 'Sessões' }).click()
    await expect(page.locator('[data-session]')).toHaveCount(2)
    await expect(page.getByText('2 conversas · 0 rodando')).toBeVisible()
    // abrir a mais antiga mostra o histórico dela, não o da outra
    await page.locator('[data-session]').filter({ hasText: 'Onde as pessoas desistem?' }).getByRole('button', { name: /^Abrir conversa/ }).click()
    await expect(dialog(page).locator('.adm-funnel')).toBeVisible()
    await expect(dialog(page).locator('.adm-heat')).toHaveCount(0)
  })

  test('a lista de Sessões também abre dentro do chat', async ({ page }) => {
    await fast(page)
    await page.goto('/admin')
    await openChat(page)
    await ask(page, 'Quais horários vendem mais?')
    await expect(dialog(page).locator('.adm-heat')).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Nova conversa' }).click()
    await dialog(page).getByRole('button', { name: 'Sessões' }).click()
    await expect(dialog(page).locator('[data-session]')).toHaveCount(1)
    await dialog(page).getByRole('button', { name: /^Abrir conversa/ }).click()
    await expect(dialog(page).locator('.adm-heat')).toBeVisible()
  })

  test('tela cheia e reduzir', async ({ page }) => {
    await fast(page)
    await page.goto('/admin')
    await openChat(page)
    await dialog(page).getByRole('button', { name: 'Tela cheia' }).click()
    const vw = page.viewportSize()!.width
    expect(Math.round((await box(dialog(page))).width)).toBe(vw)
    await expect(dialog(page).getByRole('button', { name: 'Reduzir' })).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Reduzir' }).click()
    await expect(dialog(page).getByRole('button', { name: 'Tela cheia' })).toBeVisible()
  })

  test('a guia só do chat mostra a MESMA sessão e acompanha a resposta em tempo real', async ({ page, context }) => {
    await page.goto('/admin')
    await openChat(page)
    await ask(page, 'Como foram as vendas?')
    await expect(dialog(page).locator('.adm-chat__status')).toBeVisible()
    const [id] = await sessionIds(page)
    const other = await context.newPage()
    await other.goto(`/admin?chat=${id}`)
    // só o chat: sem abas do painel
    await expect(other.getByRole('tablist')).toHaveCount(0)
    await expect(other.getByRole('link', { name: 'Voltar ao painel' })).toBeVisible()
    await expect(other.locator('.adm-msg--user')).toContainText('Como foram as vendas?')
    // a resposta que está sendo gerada na outra guia chega aqui sem recarregar
    await expect(other.locator('.adm-msg--assistant svg').first()).toBeVisible({ timeout: 15_000 })
    await expect(other.getByRole('button', { name: 'Enviar' })).toBeVisible({ timeout: 15_000 })
    // e as duas guias terminam iguais
    await expect(dialog(page).locator('.adm-msg--assistant svg').first()).toBeVisible()
  })

  test('guia só do chat: dá para continuar a conversa lá', async ({ page, context }) => {
    await fast(page)
    await page.goto('/admin')
    await openChat(page)
    await ask(page, 'Onde as pessoas desistem?')
    await expect(dialog(page).locator('.adm-funnel')).toBeVisible()
    const [id] = await sessionIds(page)
    const other = await context.newPage()
    await other.goto(`/admin?chat=${id}`)
    await expect(other.locator('.adm-funnel')).toBeVisible()
    await other.getByLabel('Pergunta para a IA').fill('Quais horários vendem mais?')
    await other.getByLabel('Pergunta para a IA').press('Enter')
    await expect(other.locator('.adm-heat')).toBeVisible()
    // a primeira guia vê a pergunta nova
    await expect(dialog(page).locator('.adm-heat')).toBeVisible()
  })

  test('guia só do chat com sessão que não existe: começa uma conversa nova', async ({ page }) => {
    await fast(page)
    await page.goto('/admin?chat=nao-existe')
    await expect(page.getByText('O que você quer ver?')).toBeVisible()
    await ask(page, 'Quais horários vendem mais?')
    await expect(page.locator('.adm-heat')).toBeVisible()
  })

  test('resposta interrompida (a guia que gerava foi fechada): aparece o aviso e dá para retomar', async ({ page }) => {
    await fast(page)
    const now = Date.now()
    const session = {
      id: 's-teste', title: 'Como foram as vendas?', createdAt: now - 60_000, updatedAt: now - 60_000, status: 'running', owner: 'guia-que-sumiu', pulse: now - 60_000,
      messages: [
        { id: 'm1', role: 'user', createdAt: now - 60_000, blocks: [{ type: 'text', text: 'Como foram as vendas?' }], state: 'done' },
        { id: 'm2', role: 'assistant', createdAt: now - 60_000, blocks: [], state: 'streaming', status: 'Consultando as vendas…' },
      ],
    }
    await page.addInitScript((s) => {
      if (localStorage.getItem('cm.admin.chats')) return
      localStorage.setItem('cm.admin.chats', JSON.stringify({ [s.id]: s }))
      sessionStorage.setItem('cm.admin.chat.ui', JSON.stringify({ open: true, mode: 'side', sessionId: s.id }))
    }, session)
    await page.goto('/admin')
    await expect(dialog(page).getByRole('alert')).toContainText('Resposta interrompida')
    await dialog(page).getByRole('button', { name: 'Retomar' }).click()
    await expect(dialog(page).locator('.adm-msg--assistant svg').first()).toBeVisible()
    await expect(dialog(page).getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible()
  })
})

test.describe('chat da IA: layout no celular', () => {
  test('nada estoura a largura, nem com gráfico, funil e mapa de calor na conversa', async ({ page }) => {
    await fast(page)
    await page.goto('/admin')
    await openChat(page)
    for (const q of ['Como foram as vendas?', 'Onde as pessoas desistem?', 'Quais horários vendem mais?', 'Quais produtos vendem mais?', 'O que a IA mais recomenda?']) {
      await ask(page, q)
      await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible()
    }
    const over = await page.evaluate(() => {
      const d = document.querySelector('[role=dialog]') as HTMLElement
      const log = d.querySelector('.adm-chat__log') as HTMLElement
      return { panel: d.scrollWidth - d.clientWidth, log: log.scrollWidth - log.clientWidth, page: document.documentElement.scrollWidth - window.innerWidth }
    })
    expect(over).toEqual({ panel: 0, log: 0, page: 0 })
    // cada cartão cabe na largura do chat
    const wide = await page.evaluate(() => {
      const log = document.querySelector('.adm-chat__log') as HTMLElement
      const W = log.getBoundingClientRect().right
      return [...log.querySelectorAll('.adm-bk, .adm-msg')].filter((e) => e.getBoundingClientRect().right > W + 0.5).length
    })
    expect(wide).toBe(0)
  })

  test('alvos de toque de pelo menos 44px no chat', async ({ page }) => {
    await fast(page)
    await page.goto('/admin')
    await openChat(page)
    const d = dialog(page)
    for (const l of [d.getByRole('button', { name: 'Sessões' }), d.getByRole('button', { name: 'Nova conversa' }), d.getByRole('button', { name: 'Tela cheia' }), d.getByRole('button', { name: 'Nova guia' }), d.getByRole('button', { name: 'Fechar chat' }), d.getByLabel('Pergunta para a IA')]) {
      expect((await box(l)).height).toBeGreaterThanOrEqual(43.5)
    }
    await ask(page, 'Quais horários vendem mais?')
    await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible()
    await page.getByLabel('Pergunta para a IA').fill('x')
    expect((await box(page.getByRole('button', { name: 'Enviar' }))).height).toBeGreaterThanOrEqual(43.5)
  })

  test('o campo de pergunta e o botão ficam à vista (dentro da tela)', async ({ page }) => {
    await page.goto('/admin')
    await openChat(page)
    const vh = page.viewportSize()!.height
    const c = await box(dialog(page).locator('.adm-chat__composer'))
    expect(c.bottom).toBeLessThanOrEqual(vh + 1)
    expect(c.y).toBeGreaterThan(vh * 0.5)
  })

  test('Sessões: a lista cabe na largura e os botões têm 44px', async ({ page }) => {
    await fast(page)
    await page.goto('/admin')
    await openChat(page)
    await ask(page, 'Quais horários vendem mais?')
    await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible()
    await page.getByRole('button', { name: 'Fechar chat' }).click()
    await page.getByRole('tab', { name: 'Sessões' }).click()
    const over = await page.evaluate(() => {
      const a = document.querySelector('.adm') as HTMLElement
      return a.scrollWidth - a.clientWidth
    })
    expect(over).toBe(0)
    const row = page.locator('[data-session]').first()
    expect((await box(row.getByRole('button', { name: /^Abrir em nova guia/ }))).height).toBeGreaterThanOrEqual(43.5)
    expect((await box(page.getByRole('button', { name: 'Nova conversa' }))).height).toBeGreaterThanOrEqual(43.5)
  })
})

test.describe('chat da IA no desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 })

  test('painel lateral à direita, por cima do painel, sem cobrir tudo', async ({ page }) => {
    await page.goto('/admin')
    await openChat(page)
    const b = await box(dialog(page))
    expect(Math.round(b.right)).toBe(1280)
    expect(b.width).toBeGreaterThan(400)
    expect(b.width).toBeLessThanOrEqual(540)
    expect(b.height).toBeGreaterThanOrEqual(799)
    // clicar fora fecha
    await page.mouse.click(200, 400)
    await expect(dialog(page)).toHaveCount(0)
  })

  test('os botões da barra do chat cabem numa linha só', async ({ page }) => {
    await page.goto('/admin')
    await openChat(page)
    const ys = await Promise.all(['Sessões', 'Nova conversa', 'Tela cheia', 'Nova guia'].map(async (n) => (await box(dialog(page).getByRole('button', { name: n }))).y))
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2)
  })

  test('tela cheia: a conversa fica numa coluna centralizada de até 880px', async ({ page }) => {
    await fast(page)
    await page.goto('/admin')
    await openChat(page)
    await ask(page, 'Como foram as vendas?')
    await expect(dialog(page).locator('svg').first()).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Tela cheia' }).click()
    expect(Math.round((await box(dialog(page))).width)).toBe(1280)
    const panel = await box(dialog(page).locator('.adm-chat__panel'))
    expect(panel.width).toBeLessThanOrEqual(880)
    expect(Math.abs(panel.x - (1280 - panel.right))).toBeLessThan(2)
  })

  test('guia só do chat usa a largura toda, com a conversa centralizada', async ({ page }) => {
    await fast(page)
    await page.goto('/admin?chat=nova')
    const panel = await box(page.locator('.adm-chat__panel'))
    expect(panel.width).toBeGreaterThan(700)
    expect(panel.width).toBeLessThanOrEqual(880)
    expect(Math.abs(panel.x - (1280 - panel.right))).toBeLessThan(2)
  })

  test('a aba Sessões lista as conversas e abre uma nova guia só do chat', async ({ page, context }) => {
    await fast(page)
    await page.goto('/admin')
    await openChat(page)
    await ask(page, 'Onde as pessoas desistem?')
    await expect(dialog(page).locator('.adm-funnel')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: 'Sessões' }).click()
    const popup = context.waitForEvent('page')
    await page.locator('[data-session]').first().getByRole('button', { name: /^Abrir em nova guia/ }).click()
    const tab = await popup
    await tab.waitForLoadState()
    expect(tab.url()).toContain('?chat=s-')
    await expect(tab.locator('.adm-funnel')).toBeVisible()
  })
})
