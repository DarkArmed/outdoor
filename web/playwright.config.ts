import { defineConfig, devices } from '@playwright/test'

// 端口可用环境变量覆盖：本机 8015 落在 Windows 保留段（7967–8066）时换个口
const backendPort = process.env.E2E_BACKEND_PORT ?? '8015'
const frontendPort = process.env.E2E_FRONTEND_PORT ?? '5175'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${frontendPort}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: [{
    command: 'python ../backend/tests/e2e_server.py',
    url: `http://127.0.0.1:${backendPort}/openapi.json`,
    reuseExistingServer: false,
  }, {
    env: { VITE_API_PROXY_TARGET: `http://127.0.0.1:${backendPort}` },
    command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort} --strictPort`,
    url: `http://127.0.0.1:${frontendPort}`,
    reuseExistingServer: false,
  }],
})
