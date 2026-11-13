import { test } from './adminSession'
import { expect, type Locator, type Page, type Route } from '@playwright/test'

// O chat falando com a IA de verdade: aqui a rota /api/admin-chat é simulada (a OpenAI não é chamada),
// mas o navegador usa o caminho real: pedido, leitura da resposta em linhas de JSON e desenho dos blocos.
// Sem a flag `cm.admin.mock`, o chat usa o servidor.

const lines = (events: object[]) => events.map((e) => JSON.stringify(e)).join('\n') + '\n'
const respond = (route: Route, events: object[], status = 200) => route.fulfill({ status, contentType: 'application/x-ndjson', body: lines(events) })

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Chat com a IA' })
const openChat = async (page: Page) => {
  await page.goto('/admin')
  await page.getByRole('button', { name: 'Perguntar à IA' }).click()
  await expect(dialog(page)).toBeVisible()
}
const ask = async (page: Page, q: string) => {
  const input = page.getByLabel('Pergunta para a IA')
  await input.fill(q)
  await input.press('Enter')
}
const box = async (l: Locator) => {
  const b = await l.boundingBox()
  if (!b) throw new Error('sem caixa')
  return { ...b, right: b.x + b.width }
}

const SALES = {
  type: 'line', title: 'Vendas por dia', subtitle: 'Últimos 7 dias completos (até ontem) · comparado com antes',
  labels: ['sex', 'sáb', 'dom', 'seg', 'ter', 'qua', 'qui'], tips: ['sexta, 6 nov', 'sábado, 7 nov', 'domingo, 8 nov', 'segunda, 9 nov', 'terça, 10 nov', 'quarta, 11 nov', 'quinta, 12 nov'],
  current: [3200, 4100, 3000, 2100, 2500, 2700, 3400], previous: [3000, 3900, 2900, 2200, 2300, 2600, 3100], currentName: 'Este período', previousName: 'Antes', format: 'money',
}
const PLAN = { title: 'Vendas', blocks: [{ type: 'line', title: 'Vendas por dia', metric: 'revenue', period: '7d', compare: true }] }

test.describe('chat ligado à IA do servidor', () => {
  test('a pergunta vai para POST /api/admin-chat e a resposta aparece em blocos', async ({ page }) => {
    let req: { method: string; url: string; body: any } | null = null
    await page.route('**/api/admin-chat', (route) => {
      req = { method: route.request().method(), url: route.request().url(), body: route.request().postDataJSON() }
      return respond(route, [
        { type: 'status', text: 'Consultando os dados…' },
        SALES,
        { type: 'text', text: 'As vendas somaram **R$ 21.000**, alta de **4,1%**. Dados de exemplo.' },
        { type: 'suggest', items: ['Quais produtos vendem mais?', 'Quais horários vendem mais?'] },
        { type: 'plan', plan: PLAN },
        { type: 'done' },
      ])
    })
    await openChat(page)
    await ask(page, 'Como foram as vendas da semana?')
    await expect(dialog(page).locator('.adm-msg--assistant svg').first()).toBeVisible()
    expect(req!.method).toBe('POST')
    expect(new URL(req!.url).pathname).toBe('/api/admin-chat')
    expect(req!.body.prompt).toBe('Como foram as vendas da semana?')
    expect(req!.body.history).toEqual([])
    // texto com negrito, sem HTML cru
    await expect(dialog(page).locator('.adm-chat__text b').first()).toHaveText('R$ 21.000')
    // a conversa terminou: pode perguntar de novo
    await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible()
  })

  test('mostra todos os tipos de bloco: indicadores, linha sem comparação, barras sem posição, tabela, funil, calor', async ({ page }) => {
    await page.route('**/api/admin-chat', (route) =>
      respond(route, [
        { type: 'kpis', title: 'Indicadores', items: [{ label: 'Vendas (R$)', value: 'R$ 21.000', note: '+4,1% vs antes' }, { label: 'Pedidos', value: '480' }] },
        { ...SALES, previous: [], title: 'Sem comparação' },
        { type: 'bars', title: 'Pedidos por dia da semana', ranked: false, rows: [{ label: 'segunda', value: 10, figure: '10 pedidos' }, { label: 'terça', value: 20, figure: '20 pedidos', note: '12%' }] },
        { type: 'bars', title: 'Ranking', rows: [{ label: 'Café Latte Gelado', value: 100, figure: '100 un.' }] },
        { type: 'table', title: 'Visitas por origem', columns: ['Origem', 'Visitas', 'Conversão'], rows: [['QR da mesa', '2.175', '12,6%'], ['Instagram', '716', '6,4%']] },
        { type: 'funnel', title: 'Funil', steps: [{ label: 'Abriram', hint: 'a', value: 100 }, { label: 'Pediram', hint: 'b', value: 10 }] },
        { type: 'heat', title: 'Calor', hours: [8, 9], rows: [{ label: 'seg', cells: [1, 5] }] },
        { type: 'done' },
      ]),
    )
    await openChat(page)
    await ask(page, 'mostre tudo')
    const d = dialog(page)
    await expect(d.locator('.adm-stats')).toBeVisible()
    await expect(d.getByText('+4,1% vs antes')).toBeVisible()
    // linha sem "antes": sem legenda de comparação
    const semComp = d.locator('.adm-bk', { hasText: 'Sem comparação' })
    await expect(semComp.locator('svg').first()).toBeVisible()
    await expect(semComp.locator('.adm-legend')).toHaveCount(0)
    // barras sem posição (ranked: false) e com posição (padrão)
    await expect(d.locator('.adm-bk', { hasText: 'Pedidos por dia da semana' }).locator('.adm-bars--plain')).toHaveCount(1)
    await expect(d.locator('.adm-bk', { hasText: 'Ranking' }).locator('.adm-bars--plain')).toHaveCount(0)
    await expect(d.locator('.adm-bk', { hasText: 'Pedidos por dia da semana' }).locator('.adm-bar__rank').first()).toBeHidden()
    await expect(d.locator('.adm-bk', { hasText: 'Ranking' }).locator('.adm-bar__rank').first()).toBeVisible()
    await expect(d.getByRole('columnheader', { name: 'Conversão' })).toBeVisible()
    await expect(d.getByRole('cell', { name: '12,6%' })).toBeVisible()
    await expect(d.locator('.adm-funnel')).toBeVisible()
    await expect(d.locator('.adm-heat')).toBeVisible()
  })

  test('nada passa da largura do chat, nem com os blocos todos', async ({ page }) => {
    await page.route('**/api/admin-chat', (route) =>
      respond(route, [
        SALES,
        { type: 'table', title: 'Tabela larga', columns: ['Produto', 'Visualizações', 'Pedem', 'Outra coluna'], rows: [['Caramelo Frappuccino - Base Café', '1.234', '12,6%', 'R$ 12.345']] },
        { type: 'bars', title: 'Nome comprido', rows: [{ label: 'Cappuccino Tradicional → Cappuccino Canela com leite de aveia', value: 5, figure: '35 trocas', note: '10 pedidos' }] },
        { type: 'suggest', items: ['Uma pergunta bem comprida para testar a quebra de linha dentro do botão sugerido'] },
        { type: 'done' },
      ]),
    )
    await openChat(page)
    await ask(page, 'x')
    await expect(dialog(page).locator('.adm-chat__sugg--inline button')).toBeVisible()
    const over = await page.evaluate(() => {
      const log = document.querySelector('.adm-chat__log') as HTMLElement
      const W = log.getBoundingClientRect().right
      return {
        log: log.scrollWidth - log.clientWidth,
        wide: [...log.querySelectorAll('.adm-bk, .adm-msg, .adm-chat__sugg button')].filter((e) => e.getBoundingClientRect().right > W + 0.5).length,
      }
    })
    expect(over).toEqual({ log: 0, wide: 0 })
  })

  test('o histórico vai junto: a pergunta anterior e a receita (plano) da resposta anterior', async ({ page }) => {
    const bodies: any[] = []
    await page.route('**/api/admin-chat', (route) => {
      bodies.push(route.request().postDataJSON())
      return respond(route, [SALES, { type: 'text', text: 'ok.' }, { type: 'plan', plan: PLAN }, { type: 'done' }])
    })
    await openChat(page)
    await ask(page, 'Vendas da semana')
    await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible()
    await ask(page, 'troca por barras')
    await expect(page.locator('.adm-msg--user')).toHaveCount(2)
    await expect.poll(() => bodies.length).toBe(2)
    expect(bodies[1].prompt).toBe('troca por barras')
    expect(bodies[1].history).toEqual([
      { role: 'user', text: 'Vendas da semana' },
      { role: 'assistant', text: '', plan: PLAN },
    ])
    // a pergunta atual não vai duplicada no histórico
    expect(JSON.stringify(bodies[1].history)).not.toContain('troca por barras')
  })

  test('tocar numa pergunta sugerida envia essa pergunta', async ({ page }) => {
    const prompts: string[] = []
    await page.route('**/api/admin-chat', (route) => {
      prompts.push(route.request().postDataJSON().prompt)
      return respond(route, prompts.length === 1 ? [{ type: 'text', text: 'Primeira.' }, { type: 'suggest', items: ['Quais horários vendem mais?'] }, { type: 'done' }] : [{ type: 'text', text: 'Segunda.' }, { type: 'done' }])
    })
    await openChat(page)
    await ask(page, 'oi')
    await dialog(page).getByRole('button', { name: 'Quais horários vendem mais?' }).click()
    await expect(dialog(page).getByText('Segunda.')).toBeVisible()
    expect(prompts).toEqual(['oi', 'Quais horários vendem mais?'])
  })

  test('as sugestões ficam desativadas enquanto a IA responde', async ({ page }) => {
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    let n = 0
    await page.route('**/api/admin-chat', async (route) => {
      n++
      if (n === 1) return respond(route, [{ type: 'text', text: 'A.' }, { type: 'suggest', items: ['Quais horários vendem mais?'] }, { type: 'done' }])
      await gate
      return respond(route, [{ type: 'text', text: 'B.' }, { type: 'done' }])
    })
    await openChat(page)
    await ask(page, 'a')
    await dialog(page).getByRole('button', { name: 'Quais horários vendem mais?' }).click()
    await expect(dialog(page).locator('.adm-chat__status')).toBeVisible()
    await expect(dialog(page).getByRole('button', { name: 'Quais horários vendem mais?' })).toBeDisabled()
    release()
    await expect(dialog(page).getByText('B.')).toBeVisible()
  })

  test('recusa do guardrail: mostra o texto fixo e as perguntas sugeridas, sem gráfico', async ({ page }) => {
    await page.route('**/api/admin-chat', (route) =>
      respond(route, [
        { type: 'status', text: 'Entendendo o pedido…' },
        { type: 'text', text: 'Eu só consigo ajudar com os dados do painel da cafeteria. Veja o que dá para perguntar:' },
        { type: 'suggest', items: ['Vendas dos últimos 7 dias', 'Quais produtos vendem mais?'] },
        { type: 'done' },
      ]),
    )
    await openChat(page)
    await ask(page, 'crie um script em python')
    await expect(dialog(page).getByText('Eu só consigo ajudar com os dados do painel')).toBeVisible()
    await expect(dialog(page).locator('.adm-msg--assistant svg')).toHaveCount(0)
    await expect(dialog(page).getByRole('button', { name: 'Vendas dos últimos 7 dias' })).toBeVisible()
    // a recusa é uma resposta normal: a conversa segue sem erro
    await expect(dialog(page).getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible()
  })

  test('erro do servidor: mostra o motivo, libera o campo e a sessão fica com "Erro"', async ({ page }) => {
    await page.route('**/api/admin-chat', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'A IA não está configurada neste ambiente.' }) }))
    await openChat(page)
    await ask(page, 'vendas')
    await expect(dialog(page).getByRole('alert')).toContainText('A IA não está configurada neste ambiente.')
    await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible()
    await expect(page.getByLabel('Pergunta para a IA')).toBeEnabled()
    await dialog(page).getByRole('button', { name: 'Sessões' }).click()
    await expect(dialog(page).locator('.adm-chip').first()).toHaveText('Erro')
  })

  test('sem rota (404): explica que a IA não está disponível aqui', async ({ page }) => {
    await page.route('**/api/admin-chat', (route) => route.fulfill({ status: 404, body: 'not found' }))
    await openChat(page)
    await ask(page, 'vendas')
    await expect(dialog(page).getByRole('alert')).toContainText('não está disponível neste ambiente')
  })

  test('sem internet: mensagem de conexão', async ({ page }) => {
    await page.route('**/api/admin-chat', (route) => route.abort('failed'))
    await openChat(page)
    await ask(page, 'vendas')
    await expect(dialog(page).getByRole('alert')).toContainText('Sem conexão com o servidor da IA')
  })

  test('erro no meio da resposta: o que já chegou continua na tela e o erro aparece', async ({ page }) => {
    await page.route('**/api/admin-chat', (route) => respond(route, [SALES, { type: 'error', message: 'A IA demorou demais. Tente de novo.' }]))
    await openChat(page)
    await ask(page, 'vendas')
    await expect(dialog(page).locator('.adm-msg--assistant svg').first()).toBeVisible()
    await expect(dialog(page).getByRole('alert')).toContainText('A IA demorou demais')
  })

  test('linhas partidas ao meio e linhas inválidas não quebram a leitura', async ({ page }) => {
    await page.route('**/api/admin-chat', (route) =>
      route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: 'isto não é json\n' + JSON.stringify({ type: 'text', text: 'Texto bom.' }) + '\n\n{"type":"done"}\n' }),
    )
    await openChat(page)
    await ask(page, 'vendas')
    await expect(dialog(page).getByText('Texto bom.')).toBeVisible()
    await expect(dialog(page).getByRole('alert')).toHaveCount(0)
  })

  test('Parar cancela o pedido ao servidor', async ({ page }) => {
    await page.route('**/api/admin-chat', () => new Promise<void>(() => {})) // nunca responde
    await openChat(page)
    await ask(page, 'vendas')
    await expect(dialog(page).locator('.adm-chat__status')).toBeVisible()
    await page.getByRole('button', { name: 'Parar' }).click()
    await expect(dialog(page).getByText('Você parou esta resposta.')).toBeVisible()
    await expect(page.getByLabel('Pergunta para a IA')).toBeEnabled()
  })

  test('a chave da OpenAI nunca aparece no navegador: o chat só fala com /api/admin-chat', async ({ page }) => {
    const hosts = new Set<string>()
    page.on('request', (r) => hosts.add(new URL(r.url()).host))
    await page.route('**/api/admin-chat', (route) => respond(route, [{ type: 'text', text: 'ok.' }, { type: 'done' }]))
    await openChat(page)
    await ask(page, 'vendas')
    await expect(dialog(page).getByText('ok.')).toBeVisible()
    expect([...hosts].some((h) => h.includes('openai.com'))).toBe(false)
    const headers = await page.evaluate(() => JSON.stringify(Object.keys(localStorage)))
    expect(headers).not.toMatch(/openai|api[_-]?key/i)
  })

  test('o mesmo caminho funciona na guia só do chat', async ({ page }) => {
    await page.route('**/api/admin-chat', (route) => respond(route, [SALES, { type: 'text', text: 'Pela guia própria.' }, { type: 'done' }]))
    await page.goto('/admin?chat=nova')
    await ask(page, 'vendas')
    await expect(page.getByText('Pela guia própria.')).toBeVisible()
    await expect(page.locator('.adm-msg--assistant svg').first()).toBeVisible()
    const b = await box(page.locator('.adm-chat__panel'))
    expect(b.right).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
  })
})
