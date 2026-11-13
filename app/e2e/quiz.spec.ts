import { readFileSync } from 'node:fs'
import { expect, test, type Page, type Route } from '@playwright/test'

// Quiz "Me ajuda a escolher": as perguntas mudam com o que a pessoa quer (bebida, comida ou tanto faz),
// o que ela responde vai ao servidor, e sem servidor o mesmo algoritmo por etiquetas roda no celular.

const menu = JSON.parse(readFileSync(new URL('../src/data/menu.json', import.meta.url), 'utf8'))
const byName = new Map<string, any>(menu.items.map((i: any) => [i.name, i]))
const hasMilk = (i: any) => i.tags.milk || (i.allergens ?? []).some((a: string) => /lact|leite/i.test(a))

const IA = { source: 'ia', suggestions: [{ id: 'caramelo-macchiato-gelado', reason: 'Gelado, cremoso e com caramelo.', matched: ['Gelado', 'Com café', 'Caramelo', 'Cremoso'] }, { id: 'cafe-latte', reason: 'Suave, com leite.', matched: ['Quente'] }] }

async function openQuiz(page: Page, handler?: (route: Route) => Promise<void> | void) {
  await page.route('**/api/recommend', handler ?? ((r) => r.fulfill({ json: IA })))
  await page.goto('/')
  await page.locator('[data-item]').first().waitFor()
  await page.locator('.dock__help').click()
  await expect(page.locator('.quiz__title')).toBeVisible()
}
const title = (page: Page) => page.locator('.quiz__title')
const opt = (page: Page, text: string) => page.locator('.opt', { hasText: text })
const chip = (page: Page, text: string) => page.locator('.chip', { hasText: text })
const dots = (page: Page) => page.locator('.dots .dot')

test.describe('perguntas do quiz', () => {
  test('bebida: 6 perguntas, na ordem, e nada vem marcado antes de responder', async ({ page }) => {
    await openQuiz(page)
    await expect(title(page)).toHaveText('O que você quer agora?')
    await expect(dots(page)).toHaveCount(6)
    await opt(page, 'Algo gelado').click()
    await expect(title(page)).toHaveText('Com café ou sem?')
    await expect(page.locator('.opt--on')).toHaveCount(0) // "Tanto faz" não pode começar marcado
    await opt(page, 'Com café').click()
    await expect(title(page)).toHaveText('Algum sabor em mente?')
    await page.getByRole('button', { name: 'Sem preferência' }).click()
    await expect(title(page)).toHaveText('Qual é o seu paladar?')
    await expect(page.locator('.opt--on')).toHaveCount(0)
    await opt(page, 'Docinho').click()
    await expect(title(page)).toHaveText('Como você gosta?')
    await expect(page.locator('.opt--on')).toHaveCount(0)
    await opt(page, 'Cremoso').click()
    await expect(title(page)).toHaveText('Precisa evitar alguma coisa?')
    await expect(page.locator('.dot--on')).toHaveCount(6)
  })

  test('comida: 5 perguntas (doce ou salgado, sabor, momento)', async ({ page }) => {
    await openQuiz(page)
    await opt(page, 'Algo para comer').click()
    await expect(dots(page)).toHaveCount(5)
    await expect(title(page)).toHaveText('Doce ou salgado?')
    await opt(page, 'Salgado').click()
    await expect(title(page)).toHaveText('Qual sabor combina?')
    // os sabores de comida: queijo, frango, presunto…
    await expect(chip(page, 'Queijo')).toBeVisible()
    await expect(chip(page, 'Frango')).toBeVisible()
    await expect(chip(page, 'Matcha')).toHaveCount(0)
    await page.getByRole('button', { name: 'Sem preferência' }).click()
    await expect(title(page)).toHaveText('Para qual momento?')
    await expect(page.locator('.opt--on')).toHaveCount(0)
    await opt(page, 'Lanche').click()
    await expect(title(page)).toHaveText('Precisa evitar alguma coisa?')
  })

  test('tanto faz: 5 perguntas (momento primeiro) e sem pergunta de café', async ({ page }) => {
    await openQuiz(page)
    await opt(page, 'Tanto faz').click()
    await expect(dots(page)).toHaveCount(5)
    await expect(title(page)).toHaveText('Para qual momento?')
    await opt(page, 'Sobremesa').click()
    await expect(title(page)).toHaveText('Algum sabor em mente?')
    await page.getByRole('button', { name: 'Sem preferência' }).click()
    await expect(title(page)).toHaveText('Qual é o seu paladar?')
  })

  test('sabores: no máximo 2; o terceiro troca o mais antigo; o botão acompanha', async ({ page }) => {
    await openQuiz(page)
    await opt(page, 'Algo gelado').click()
    await opt(page, 'Com café').click()
    await expect(page.getByRole('button', { name: 'Sem preferência' })).toBeVisible()
    await chip(page, 'Chocolate').click()
    await chip(page, 'Caramelo').click()
    await chip(page, 'Frutas vermelhas').click()
    await expect(chip(page, 'Chocolate')).toHaveAttribute('aria-pressed', 'false')
    await expect(chip(page, 'Caramelo')).toHaveAttribute('aria-pressed', 'true')
    await expect(chip(page, 'Frutas vermelhas')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible()
    await chip(page, 'Caramelo').click() // desmarca
    await chip(page, 'Frutas vermelhas').click()
    await expect(page.getByRole('button', { name: 'Sem preferência' })).toBeVisible()
  })

  test('Voltar mantém o que já foi respondido; trocar de caminho zera os sabores', async ({ page }) => {
    await openQuiz(page)
    await opt(page, 'Algo gelado').click()
    await opt(page, 'Sem café').click()
    await chip(page, 'Chocolate').click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(title(page)).toHaveText('Qual é o seu paladar?')
    await page.getByRole('button', { name: 'Voltar' }).click()
    await expect(chip(page, 'Chocolate')).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Voltar' }).click()
    await expect(opt(page, 'Sem café')).toHaveClass(/opt--on/)
    await page.getByRole('button', { name: 'Voltar' }).click()
    await expect(opt(page, 'Algo gelado')).toHaveClass(/opt--on/)
    // muda de bebida para comida: o caminho e os sabores mudam
    await opt(page, 'Algo para comer').click()
    await expect(dots(page)).toHaveCount(5)
    await opt(page, 'Doce').click()
    await expect(chip(page, 'Chocolate')).toHaveAttribute('aria-pressed', 'false')
  })

  test('o Voltar some na primeira pergunta e a barra de progresso acompanha', async ({ page }) => {
    await openQuiz(page)
    await expect(page.getByRole('button', { name: 'Voltar' })).toHaveCount(0)
    await expect(page.locator('.dot--on')).toHaveCount(1)
    await opt(page, 'Algo quente').click()
    await expect(page.locator('.dot--on')).toHaveCount(2)
    await expect(page.getByRole('button', { name: 'Voltar' })).toBeVisible()
  })
})

test.describe('o que vai para o servidor', () => {
  const body = async (page: Page, run: () => Promise<void>) => {
    let sent: any = null
    await page.unroute('**/api/recommend').catch(() => {})
    await page.route('**/api/recommend', (r) => {
      sent = r.request().postDataJSON()
      return r.fulfill({ json: IA })
    })
    await run()
    await expect(page.locator('.source')).toBeVisible()
    return sent
  }

  test('bebida: todas as respostas, sem campos de comida', async ({ page }) => {
    await openQuiz(page)
    const sent = await body(page, async () => {
      await opt(page, 'Algo gelado').click()
      await opt(page, 'Sem café').click()
      await chip(page, 'Chocolate').click()
      await page.getByRole('button', { name: 'Continuar' }).click()
      await opt(page, 'Docinho').click()
      await opt(page, 'Cremoso').click()
      await chip(page, 'Leite').click()
      await page.locator('#quiz-text').fill('algo bem gelado')
      await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    })
    expect(sent.answers).toEqual({ want: 'gelada', caffeine: 'sem', flavors: ['chocolate'], taste: 'doce', body: 'cremoso', avoid: ['leite'], asked: ['taste', 'body'] })
    expect(sent.text).toBe('algo bem gelado')
  })

  test('comida: só o que foi perguntado', async ({ page }) => {
    await openQuiz(page)
    const sent = await body(page, async () => {
      await opt(page, 'Algo para comer').click()
      await opt(page, 'Salgado').click()
      await chip(page, 'Queijo').click()
      await page.getByRole('button', { name: 'Continuar' }).click()
      await opt(page, 'Lanche').click()
      await page.getByText('Nada, ver sugestões').click()
    })
    expect(sent.answers).toEqual({ want: 'comer', foodKind: 'salgado', flavors: ['queijo'], moment: 'lanche', avoid: [], asked: [] })
  })

  test('tanto faz: momento e paladar', async ({ page }) => {
    await openQuiz(page)
    const sent = await body(page, async () => {
      await opt(page, 'Tanto faz').click()
      await opt(page, 'Sobremesa').click()
      await page.getByRole('button', { name: 'Sem preferência' }).click()
      await opt(page, 'Docinho').click()
      await page.getByText('Nada, ver sugestões').click()
    })
    expect(sent.answers).toEqual({ want: 'tanto-faz', flavors: [], moment: 'sobremesa', taste: 'doce', avoid: [], asked: ['taste'] })
  })

  test('pergunta pulada vai como neutra (tanto faz / equilibrado)', async ({ page }) => {
    await openQuiz(page)
    // volta e muda de ideia no meio: o que ficou de outro caminho não vai junto
    const sent = await body(page, async () => {
      await opt(page, 'Algo quente').click()
      await opt(page, 'Com café').click()
      await page.getByRole('button', { name: 'Voltar' }).click()
      await page.getByRole('button', { name: 'Voltar' }).click()
      await opt(page, 'Algo para comer').click()
      await opt(page, 'Doce').click()
      await page.getByRole('button', { name: 'Sem preferência' }).click()
      await opt(page, 'Qualquer hora').click()
      await page.getByText('Nada, ver sugestões').click()
    })
    expect(sent.answers).toEqual({ want: 'comer', foodKind: 'doce', flavors: [], moment: 'qualquer', avoid: [], asked: [] })
    expect(sent.answers.caffeine).toBeUndefined()
  })

  test('restrição alimentar e texto livre NÃO ficam no registro de interesse (localStorage)', async ({ page }) => {
    await openQuiz(page)
    await opt(page, 'Algo quente').click()
    await opt(page, 'Com café').click()
    await page.getByRole('button', { name: 'Sem preferência' }).click()
    await opt(page, 'Equilibrado').click()
    await opt(page, 'Tanto faz').click()
    await chip(page, 'Glúten').click()
    await page.locator('#quiz-text').fill('minha alergia é séria')
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.locator('.source')).toBeVisible()
    const events = await page.evaluate(() => JSON.parse(localStorage.getItem('cm.events') ?? '[]').filter((e: any) => e.type === 'quiz_result'))
    expect(events).toHaveLength(1)
    const raw = JSON.stringify(events)
    expect(raw).not.toMatch(/gluten|alergia|avoid|text/i)
    expect(events[0].answers).toMatchObject({ want: 'quente', caffeine: 'com' })
  })
})

test.describe('resultado', () => {
  const finish = async (page: Page) => {
    await opt(page, 'Algo gelado').click()
    await opt(page, 'Tanto faz').click()
    await page.getByRole('button', { name: 'Sem preferência' }).click()
    await opt(page, 'Equilibrado').click()
    await opt(page, 'Tanto faz').click()
    await page.getByText('Nada, ver sugestões').click()
  }

  test('mostra o motivo e as etiquetas que casaram com as respostas', async ({ page }) => {
    await openQuiz(page)
    await finish(page)
    const first = page.locator('.sug').first()
    await expect(first.locator('.sug__look')).toHaveText('Gelado, cremoso e com caramelo.')
    await expect(first.locator('.tagchip')).toHaveText(['Gelado', 'Com café', 'Caramelo', 'Cremoso'])
    await expect(page.locator('.source')).toHaveText('Sugerido pela IA')
  })

  test('resposta antiga, sem etiquetas, continua funcionando', async ({ page }) => {
    await openQuiz(page, (r) => r.fulfill({ json: { suggestions: [{ id: 'cafe-latte', reason: 'Suave.' }] } }))
    await finish(page)
    await expect(page.locator('.sug')).toHaveCount(1)
    await expect(page.locator('.tagchip')).toHaveCount(0)
  })

  test('o servidor avisa que usou só as regras: o rótulo diz "Sugestão rápida"', async ({ page }) => {
    await openQuiz(page, (r) => r.fulfill({ json: { source: 'regras', suggestions: IA.suggestions } }))
    await finish(page)
    await expect(page.locator('.source')).toContainText('Sugestão rápida')
  })

  test('sem servidor, o mesmo algoritmo por etiquetas responde no celular, com etiquetas', async ({ page }) => {
    await openQuiz(page, (r) => r.fulfill({ status: 500, json: { error: 'x' } }))
    await opt(page, 'Algo gelado').click()
    await opt(page, 'Com café').click()
    await chip(page, 'Caramelo').click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await opt(page, 'Docinho').click()
    await opt(page, 'Cremoso').click()
    await page.getByText('Nada, ver sugestões').click()
    await expect(page.locator('.source')).toContainText('Sugestão rápida')
    await expect(page.locator('.sug')).toHaveCount(3)
    // cada sugestão é gelada, com café e com caramelo, e mostra isso
    for (const name of await page.locator('.sug strong').allTextContents()) {
      const item = byName.get(name)
      expect(item.tags.iced, name).toBeTruthy()
      expect(item.labels, name).toContain('cafe')
      expect(item.labels.some((l: string) => ['caramelo', 'doce-de-leite'].includes(l)), name).toBe(true)
    }
    await expect(page.locator('.sug').first().locator('.tagchip', { hasText: 'Caramelo' })).toBeVisible()
  })

  test('sem servidor e com restrição: nunca sugere o que a pessoa não pode', async ({ page }) => {
    await openQuiz(page, (r) => r.fulfill({ status: 500, json: { error: 'x' } }))
    await opt(page, 'Algo quente').click()
    await opt(page, 'Tanto faz').click()
    await page.getByRole('button', { name: 'Sem preferência' }).click()
    await opt(page, 'Equilibrado').click()
    await opt(page, 'Tanto faz').click()
    await chip(page, 'Leite').click()
    await page.getByText('Ver sugestões').click()
    const names = await page.locator('.sug strong').allTextContents()
    expect(names.length).toBeGreaterThan(0)
    for (const n of names) expect(hasMilk(byName.get(n)), n).toBe(false)
    await expect(page.locator('.warn')).toContainText('Confirme com a equipe')
  })

  test('Refazer volta à primeira pergunta, sem nada marcado', async ({ page }) => {
    await openQuiz(page)
    await finish(page)
    await page.getByRole('button', { name: 'Refazer' }).click()
    await expect(title(page)).toHaveText('O que você quer agora?')
    await expect(page.locator('.opt--on')).toHaveCount(0)
    await expect(dots(page)).toHaveCount(6)
  })
})

test.describe('layout em cada pergunta (celulares de 320 a 430px)', () => {
  /** Cada pergunta cabe na tela, sem rolar para o lado, com alvos de toque de 44px e o botão à vista. */
  const audit = async (page: Page, label: string) => {
    const r = await page.evaluate(() => {
      const sheet = document.querySelector('.sheet-wrap--open .sheet') as HTMLElement
      const vw = window.innerWidth
      const vh = window.innerHeight
      const targets = [...sheet.querySelectorAll('.opt, .chip, .cta, .link, .sug__main')] as HTMLElement[]
      const small = targets.filter((e) => e.getBoundingClientRect().height < 43.5 && !e.classList.contains('link')).map((e) => e.textContent?.trim().slice(0, 20))
      const outside = targets.filter((e) => e.getBoundingClientRect().right > vw + 0.5 || e.getBoundingClientRect().left < -0.5).map((e) => e.textContent?.trim().slice(0, 20))
      const cta = sheet.querySelector('.cta') as HTMLElement | null
      const last = [...sheet.querySelectorAll('.opt, .chip, .cta')].pop() as HTMLElement | undefined
      return { sheetOverflow: sheet.scrollWidth - sheet.clientWidth, small, outside, ctaBottom: cta?.getBoundingClientRect().bottom ?? 0, lastBottom: last?.getBoundingClientRect().bottom ?? 0, vh }
    })
    expect(r.sheetOverflow, `${label}: rolagem lateral`).toBeLessThanOrEqual(0)
    expect(r.small, `${label}: alvos menores que 44px`).toEqual([])
    expect(r.outside, `${label}: fora da tela`).toEqual([])
    expect(r.lastBottom, `${label}: último botão cortado`).toBeLessThanOrEqual(r.vh + 0.5)
  }

  test('caminho de bebida, em todas as perguntas', async ({ page }) => {
    await openQuiz(page)
    await audit(page, 'quer')
    await opt(page, 'Algo gelado').click()
    await audit(page, 'café')
    await opt(page, 'Sem café').click()
    await audit(page, 'sabor')
    await chip(page, 'Frutas vermelhas').click()
    await chip(page, 'Avelã e baunilha').click()
    await audit(page, 'sabor marcado')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await audit(page, 'paladar')
    await opt(page, 'Docinho').click()
    await audit(page, 'textura')
    await opt(page, 'Leve e refrescante').click()
    await audit(page, 'final')
  })

  test('caminho de comida e de tanto faz', async ({ page }) => {
    await openQuiz(page)
    await opt(page, 'Algo para comer').click()
    await audit(page, 'doce ou salgado')
    await opt(page, 'Doce').click()
    await audit(page, 'sabor (comida)')
    await page.getByRole('button', { name: 'Sem preferência' }).click()
    await audit(page, 'momento')
    await opt(page, 'Café da manhã').click()
    await audit(page, 'final (comida)')
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Voltar' }).click()
    await opt(page, 'Tanto faz').click()
    await audit(page, 'momento (tanto faz)')
  })

  test('resultado com 3 sugestões, etiquetas e botões de adicionar', async ({ page }) => {
    await openQuiz(page, (r) => r.fulfill({ status: 500, json: { error: 'x' } }))
    await opt(page, 'Algo gelado').click()
    await opt(page, 'Com café').click()
    await chip(page, 'Chocolate').click()
    await chip(page, 'Caramelo').click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await opt(page, 'Docinho').click()
    await opt(page, 'Cremoso').click()
    await page.getByText('Nada, ver sugestões').click()
    await expect(page.locator('.sug')).toHaveCount(3)
    const r = await page.evaluate(() => {
      const sheet = document.querySelector('.sheet-wrap--open .sheet') as HTMLElement
      const vw = window.innerWidth
      return {
        overflow: sheet.scrollWidth - sheet.clientWidth,
        wide: [...sheet.querySelectorAll('.sug, .sug__txt, .tagchip')].filter((e) => e.getBoundingClientRect().right > vw + 0.5).length,
        addSmall: [...sheet.querySelectorAll('.sug__add')].filter((e) => e.getBoundingClientRect().height < 43.5 || e.getBoundingClientRect().width < 43.5).length,
      }
    })
    expect(r).toEqual({ overflow: 0, wide: 0, addSmall: 0 })
  })
})
