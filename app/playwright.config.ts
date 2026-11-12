import { defineConfig, devices } from '@playwright/test'

// Mobile first: o app é testado nos tamanhos de celular mais comuns.
// Todos rodam no Chromium (o navegador instalado); só o tamanho, a densidade e o toque mudam.
const phone = (d: (typeof devices)[string]) => ({ ...d, browserName: 'chromium' as const, defaultBrowserType: 'chromium' as const })

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4317', trace: 'off', reducedMotion: 'reduce' },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled', caret: 'hide' } },
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  projects: [
    { name: 'iphone-se', use: phone(devices['iPhone SE']) },
    { name: 'iphone-15', use: phone(devices['iPhone 15']) },
    { name: 'iphone-15-pro-max', use: phone(devices['iPhone 15 Pro Max']) },
    { name: 'pixel-7', use: phone(devices['Pixel 7']) },
    { name: 'galaxy-s9', use: phone(devices['Galaxy S9+']) },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4317 --strictPort',
    url: 'http://localhost:4317',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
