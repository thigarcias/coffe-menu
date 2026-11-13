import { test as base } from '@playwright/test'

export const test = base.extend<{ adminSession: void }>({
  adminSession: [async ({ context }, use) => {
    await context.addInitScript(() => {
      localStorage.setItem('cm.admin.session', JSON.stringify({
        access_token: 'access-token-de-teste',
        refresh_token: 'refresh-token-de-teste',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'admin-test', app_metadata: { coffe_admin: true } },
      }))
    })
    await use()
  }, { auto: true }],
})
