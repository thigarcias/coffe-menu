import { test, expect } from '@playwright/test'

test('a área da cafeteria exige login e trata credenciais inválidas', async ({ page }) => {
  await page.route('**/auth/v1/token?grant_type=password', (route) => route.fulfill({
    status: 400,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
  }))
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Entre na sua conta' })).toBeVisible()
  await page.getByLabel('E-mail').fill('teste@example.com')
  await page.getByLabel('Senha').fill('senha-incorreta')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toContainText('Não foi possível entrar')
  await expect(page.getByRole('heading', { name: 'Painel', exact: true })).toHaveCount(0)
})

test('a conta autenticada mantém a sessão ao recarregar e pode sair', async ({ page }) => {
  const email = 'cafeteria@example.com'
  await page.route('**/auth/v1/token?grant_type=password', async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ email, password: 'senha-de-teste' })
    await route.fulfill({
      json: {
        access_token: 'access-token-de-teste',
        refresh_token: 'refresh-token-de-teste',
        token_type: 'bearer',
        expires_in: 3600,
        user: { id: 'owner-test', email, aud: 'authenticated', app_metadata: { coffe_admin: true }, user_metadata: {} },
      },
    })
  })
  await page.route('**/auth/v1/logout?scope=local', (route) => route.fulfill({ status: 204 }))

  await page.goto('/admin')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill('senha-de-teste')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Painel', exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Painel', exact: true })).toBeVisible()
  const logout = page.waitForResponse('**/auth/v1/logout?scope=local')
  await page.getByRole('button', { name: 'Sair' }).click()
  expect((await logout).status()).toBe(204)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Entre na sua conta' })).toBeVisible()
})

test('o chat do painel exige autenticação no servidor', async ({ request }) => {
  const response = await request.post('/api/admin-chat', { data: { prompt: 'Resumo das vendas' } })
  expect(response.status()).toBe(401)
})
