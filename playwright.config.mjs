import { defineConfig } from '@playwright/test'

const remoteBaseUrl = process.env.APPLAYER_AUDIT_BASE_URL?.replace(/\/$/, '')
const baseURL = remoteBaseUrl || 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 2 * 60 * 60 * 1000,
  reporter: [['line']],
  use: {
    baseURL,
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: remoteBaseUrl ? undefined : {
    command: 'npm run dev',
    url: `${baseURL}/svgmap.html`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
