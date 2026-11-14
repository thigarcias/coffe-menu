import { test } from './adminSession'
import { expect, type Locator, type Page } from '@playwright/test'
import { goSection } from './adminNav'
import { runQuery } from '../shared/analytics.mjs'

const CAFE = '11111111-1111-4111-8111-111111111111'

type Item = Record<string, unknown>
interface Version { version: number; items: Item[] | null; source: string; saved_at: string }

/** Servidor falso: mesmas regras das RPCs (versão esperada, reset = itens nulos, restore copia). */
async function fakeBackend(page: Page, opts: { seed?: Record<string, Item[]>; conflictOnSave?: boolean; down?: boolean } = {}) {
  const store: Record<string, Version[]> = {}
  for (const [section, items] of Object.entries(opts.seed ?? {})) store[section] = [{ version: 1, items, source: 'manual', saved_at: '2026-11-14T12:00:00Z' }]
  const calls: { rpc: string; args: Record<string, any> }[] = []
  const current = (s: string) => store[s]?.[store[s].length - 1]
  await page.route('**/api/menu-data', async (route) => {
    const { rpc, args = {} } = route.request().postDataJSON()
    calls.push({ rpc, args })
    if (opts.down) return route.fulfill({ status: 503, json: { message: 'Editor indisponível no momento.' } })
    if (rpc === 'list_my_cafes') return route.fulfill({ json: [{ id: CAFE, slug: 'cafe-teste', name: 'Café Teste', is_active: true }] })
    if (rpc === 'get_dashboard_layouts') {
      const sections: Record<string, unknown> = {}
      const history: Record<string, unknown> = {}
      for (const [s, vs] of Object.entries(store)) {
        const c = vs[vs.length - 1]
        sections[s] = { version: c.version, items: c.items, source: c.source, saved_at: c.saved_at }
        history[s] = [...vs].reverse().map((v) => ({ version: v.version, source: v.source, saved_at: v.saved_at, is_default: v.items === null }))
      }
      return route.fulfill({ json: { cafe_id: CAFE, sections, history } })
    }
    if (rpc === 'save_dashboard_layout' || rpc === 'restore_dashboard_layout') {
      const s = args.p_section as string
      if (opts.conflictOnSave || args.p_expected_version !== (current(s)?.version ?? 0)) return route.fulfill({ status: 409, json: { message: 'conflito' } })
      const vs = (store[s] ??= [])
      const items = rpc === 'save_dashboard_layout' ? args.p_items : (vs.find((v) => v.version === args.p_version)?.items ?? null)
      const source = rpc === 'save_dashboard_layout' ? args.p_source : 'restore'
      vs.push({ version: vs.length + 1, items, source, saved_at: '2026-11-14T13:00:00Z' })
      return route.fulfill({ json: { section: s, version: vs.length } })
    }
    return route.fulfill({ json: {} })
  })
  return { calls, store }
}

const box = async (l: Locator) => {
  const b = await l.boundingBox()
  if (!b) throw new Error('sem caixa')
  return b
}
const open = async (page: Page, section = 'visao') => {
  await page.goto(`/admin#${section}`)
  await expect(page.getByRole('heading', { name: 'Painel', level: 1 })).toBeVisible()
}
const edit = (page: Page) => page.getByRole('button', { name: 'Personalizar', exact: true })
const bar = (page: Page) => page.getByRole('region', { name: /^Personalizar / })
const titles = (page: Page) => page.locator('.adm-grid .adm-card__head h2, .adm-grid .adm-bk__head h3, .adm-grid .adm-kpi__label')

test.describe('personalizar o painel', () => {
  test('sem o servidor o painel segue no padrão e não oferece a edição', async ({ page }) => {
    await fakeBackend(page, { down: true })
    await open(page)
    await expect(page.locator('.adm-kpi')).toHaveCount(5)
    await expect(edit(page)).toHaveCount(0)
  })

  test('sem personalização: padrão intacto e sem a etiqueta "Personalizado"', async ({ page }) => {
    await fakeBackend(page)
    await open(page)
    await expect(edit(page)).toBeVisible()
    await expect(page.locator('.adm-kpi')).toHaveCount(5)
    await expect(page.getByText('Personalizado', { exact: true })).toHaveCount(0)
  })

  test('esconder um cartão e salvar: ele some, a seção fica "Personalizada" e a mudança sobrevive ao recarregar', async ({ page }) => {
    const { calls } = await fakeBackend(page)
    await open(page)
    await edit(page).click()
    await expect(bar(page)).toBeVisible()
    await page.getByRole('button', { name: 'Esconder Pedidos (indicador)' }).click()
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(bar(page)).toHaveCount(0)
    await expect(page.locator('.adm-kpi')).toHaveCount(4)
    await expect(page.getByText('Personalizado', { exact: true })).toBeVisible()
    const save = calls.find((c) => c.rpc === 'save_dashboard_layout')!
    expect(save.args).toMatchObject({ p_cafe_id: CAFE, p_section: 'visao', p_expected_version: 0, p_source: 'manual' })
    expect(save.args.p_items).toHaveLength(5)
    await page.reload()
    await expect(page.locator('.adm-kpi')).toHaveCount(4)
  })

  test('Cancelar descarta tudo e não grava nada', async ({ page }) => {
    const { calls } = await fakeBackend(page)
    await open(page)
    await edit(page).click()
    await page.getByRole('button', { name: 'Esconder Por que vendeu' }).click()
    await expect(page.getByRole('region', { name: 'Cartões escondidos' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByRole('heading', { name: 'Por que vendeu' })).toBeVisible()
    expect(calls.some((c) => c.rpc === 'save_dashboard_layout')).toBe(false)
  })

  test('Salvar só liga quando há mudança', async ({ page }) => {
    await fakeBackend(page)
    await open(page)
    await edit(page).click()
    await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Esconder Conversão (indicador)' }).click()
    await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeEnabled()
  })

  test('subir e descer reordena (o funil passa na frente do gráfico de vendas)', async ({ page }) => {
    await fakeBackend(page)
    await open(page, 'vendas')
    await expect(titles(page).first()).toHaveText('Vendas no período')
    await edit(page).click()
    await page.getByRole('button', { name: 'Subir Do cardápio ao pedido' }).click()
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(bar(page)).toHaveCount(0)
    await expect(titles(page).first()).toHaveText('Do cardápio ao pedido')
  })

  test('o primeiro não sobe e o último não desce', async ({ page }) => {
    await fakeBackend(page)
    await open(page, 'vendas')
    await edit(page).click()
    await expect(page.getByRole('button', { name: 'Subir Vendas no período' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Descer Do cardápio ao pedido' })).toBeDisabled()
  })

  test('cartões escondidos voltam pela lista "Cartões escondidos"', async ({ page }) => {
    await fakeBackend(page)
    await open(page, 'vendas')
    await edit(page).click()
    await page.getByRole('button', { name: 'Esconder Do cardápio ao pedido' }).click()
    const tray = page.getByRole('region', { name: 'Cartões escondidos' })
    await expect(tray.getByText('Do cardápio ao pedido')).toBeVisible()
    await expect(tray.getByRole('listitem')).toHaveCount(1) // só os desta seção; os outros ficam recolhidos
    await tray.getByRole('button', { name: 'Mostrar Do cardápio ao pedido' }).click()
    await expect(tray.getByRole('listitem')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Subir Do cardápio ao pedido' })).toBeVisible()
  })

  test('dá para trazer um cartão de outra seção (recolhido por padrão)', async ({ page }) => {
    const { calls } = await fakeBackend(page)
    await open(page, 'vendas')
    await edit(page).click()
    const tray = page.getByRole('region', { name: 'Cartões escondidos' })
    await expect(tray.getByRole('heading', { name: 'Cartões escondidos' })).toHaveCount(0) // nada escondido aqui; os de outras seções ficam no resumo recolhido
    await page.getByText('Trazer cartões de outras seções').click()
    await page.getByRole('button', { name: 'Mostrar Mais vendidos' }).click()
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Mais vendidos' })).toBeVisible()
    expect(calls.find((c) => c.rpc === 'save_dashboard_layout')!.args.p_items.map((i: any) => i.id)).toEqual(['sales', 'funnel', 'top'])
  })

  test('voltar ao padrão pede confirmação e grava um reset (o histórico fica)', async ({ page }) => {
    const { calls, store } = await fakeBackend(page, { seed: { vendas: [{ id: 'funnel', kind: 'builtin', widget: 'funnel' }] } })
    await open(page, 'vendas')
    await expect(page.locator('.adm-grid .adm-card')).toHaveCount(1)
    await edit(page).click()
    await page.getByRole('button', { name: 'Voltar ao padrão', exact: true }).click()
    expect(calls.some((c) => c.rpc === 'save_dashboard_layout')).toBe(false) // ainda não gravou
    await page.getByRole('button', { name: 'Não' }).click()
    await page.getByRole('button', { name: 'Voltar ao padrão', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmar: voltar ao padrão' }).click()
    await expect(bar(page)).toHaveCount(0)
    await expect(page.locator('.adm-grid .adm-card')).toHaveCount(2)
    await expect(page.getByText('Personalizado', { exact: true })).toHaveCount(0)
    const reset = calls.find((c) => c.rpc === 'save_dashboard_layout')!
    expect(reset.args).toMatchObject({ p_items: null, p_source: 'reset', p_expected_version: 1 })
    expect(store.vendas).toHaveLength(2)
  })

  test('desfazer a última mudança salva restaura a versão anterior', async ({ page }) => {
    const { calls } = await fakeBackend(page, { seed: { vendas: [{ id: 'sales', kind: 'builtin', widget: 'sales' }] } })
    await open(page, 'vendas')
    await edit(page).click()
    await page.getByRole('button', { name: 'Mostrar Do cardápio ao pedido' }).click()
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.locator('.adm-grid .adm-card')).toHaveCount(2)
    await edit(page).click()
    await page.getByRole('button', { name: 'Desfazer a última mudança salva' }).click()
    await expect(bar(page)).toHaveCount(0)
    await expect(page.locator('.adm-grid .adm-card')).toHaveCount(1)
    expect(calls.find((c) => c.rpc === 'restore_dashboard_layout')!.args).toMatchObject({ p_version: 1, p_expected_version: 2 })
  })

  test('sem histórico não há o que desfazer', async ({ page }) => {
    await fakeBackend(page)
    await open(page)
    await edit(page).click()
    await expect(page.getByRole('button', { name: 'Desfazer a última mudança salva' })).toBeDisabled()
  })

  test('conflito de versão (outra pessoa salvou antes): mostra o aviso e não perde a tela', async ({ page }) => {
    await fakeBackend(page, { conflictOnSave: true })
    await open(page)
    await edit(page).click()
    await page.getByRole('button', { name: 'Esconder Pedidos (indicador)' }).click()
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('mudou em outra tela')
    await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeVisible() // continua editando
  })

  test('as seções são independentes: personalizar Vendas não mexe na Visão geral', async ({ page }) => {
    await fakeBackend(page, { seed: { vendas: [{ id: 'funnel', kind: 'builtin', widget: 'funnel' }] } })
    await open(page, 'visao')
    await expect(page.locator('.adm-kpi')).toHaveCount(5)
    await expect(page.getByText('Personalizado', { exact: true })).toHaveCount(0)
    await goSection(page, 'Vendas')
    await expect(page.getByText('Personalizado', { exact: true })).toBeVisible()
  })

  test('trocar de seção no meio da edição encerra o modo editar', async ({ page }) => {
    await fakeBackend(page)
    await open(page, 'visao')
    await edit(page).click()
    await expect(bar(page)).toBeVisible()
    await goSection(page, 'Vendas')
    await expect(bar(page)).toHaveCount(0)
  })
})

test.describe('blocos salvos (receita da IA)', () => {
  const spec = {
    type: 'bars', title: 'Gelados por hora', subtitle: null, metric: 'orders', metrics: [], group_by: 'hour', period: '7d', compare: false,
    limit: null, order: null, filter_source: null, filter_category: 'gelados', filter_product: null, filter_ai: null,
  }

  test('o bloco aparece com números do motor (não guardados) e acompanha o período', async ({ page }) => {
    await fakeBackend(page, { seed: { vendas: [{ id: 's_1', kind: 'spec', span: 12, spec }] } })
    await open(page, 'vendas')
    const card = page.locator('.adm-pin')
    await expect(card.getByRole('heading', { name: 'Gelados por hora' })).toBeVisible()
    const q = runQuery({ metric: 'orders', groupBy: 'hour', period: '7d', filter: { category: 'gelados' } })
    const top = q.rows.reduce((a: any, b: any) => (b.value > a.value ? b : a))
    await expect(card).toContainText(`${top.value} pedidos`)
  })

  test('receita que o motor não entende vira um aviso e não derruba a página', async ({ page }) => {
    await fakeBackend(page, { seed: { vendas: [{ id: 's_1', kind: 'spec', span: 6, spec: { ...spec, type: 'nao-existe' } }, { id: 'funnel', kind: 'builtin', widget: 'funnel' }] } })
    await open(page, 'vendas')
    await expect(page.getByText('Este bloco não está disponível agora')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Do cardápio ao pedido' })).toBeVisible()
  })

  test('no modo editar o bloco pode mudar de largura e ser removido', async ({ page }) => {
    const { calls } = await fakeBackend(page, { seed: { vendas: [{ id: 's_1', kind: 'spec', span: 12, spec }] } })
    await open(page, 'vendas')
    await edit(page).click()
    await page.getByRole('button', { name: 'Largura de Gelados por hora' }).click()
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(bar(page)).toHaveCount(0)
    expect(calls.find((c) => c.rpc === 'save_dashboard_layout')!.args.p_items[0]).toMatchObject({ id: 's_1', kind: 'spec', span: 6 })
    await edit(page).click()
    await page.getByRole('button', { name: 'Esconder Gelados por hora' }).click()
    await expect(page.locator('.adm-pin')).toHaveCount(0)
  })
})

test.describe('modo editar no celular', () => {
  test('alvos de toque de pelo menos 44px, sem rolar para o lado e sem cartões estourando', async ({ page }) => {
    await fakeBackend(page)
    await open(page, 'visao')
    await edit(page).click()
    for (const name of [/^Salvar$/, /^Cancelar$/, /^Subir /, /^Descer /, /^Esconder /]) {
      const b = await box(page.getByRole('button', { name }).first())
      expect(b.height, String(name)).toBeGreaterThanOrEqual(43.5)
    }
    const r = await page.evaluate(() => {
      const adm = document.querySelector('.adm') as HTMLElement
      return {
        overflowX: adm.scrollWidth - adm.clientWidth,
        pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
        wide: [...adm.querySelectorAll('.adm-ed, .adm-editbar, .adm-card')].filter((e) => e.getBoundingClientRect().right > adm.clientWidth + 0.5).length,
      }
    })
    expect(r).toEqual({ overflowX: 0, pageOverflow: 0, wide: 0 })
  })

  test('Salvar e Cancelar ficam à vista mesmo rolando até o último cartão', async ({ page }) => {
    await fakeBackend(page)
    await open(page, 'visao')
    await edit(page).click()
    await page.getByRole('button', { name: 'Esconder Por que vendeu' }).scrollIntoViewIfNeeded()
    const vh = page.viewportSize()!.height
    for (const name of ['Salvar', 'Cancelar']) {
      const b = await box(page.getByRole('button', { name, exact: true }))
      expect(b.y, name).toBeGreaterThanOrEqual(0)
      expect(b.y + b.height, name).toBeLessThanOrEqual(vh + 0.5)
    }
  })

  test('a barra de edição fica acima dos cartões e o cartão não é coberto por controles', async ({ page }) => {
    await fakeBackend(page)
    await open(page, 'vendas')
    await edit(page).click()
    const wrap = page.locator('.adm-ed').first()
    const barBox = await box(wrap.locator('.adm-ed__bar'))
    const cardBox = await box(wrap.locator('.adm-card'))
    expect(cardBox.y).toBeGreaterThanOrEqual(barBox.y + barBox.height - 1)
  })
})
