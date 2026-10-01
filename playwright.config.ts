import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser', workers: 1, timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:3001', browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL,
    screenshot: 'only-on-failure',
    launchOptions: {
      args: process.env.PLAYWRIGHT_SOFTWARE_RENDERING === '1'
        ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
        : [],
    },
  },
  webServer: [
    { command: 'node apps/match/dist/index.js', url: 'http://127.0.0.1:2569/health', env: { MATCH_PORT: '2569', WEB_ORIGIN: 'http://127.0.0.1:3001' }, reuseExistingServer: false, timeout: 15000 },
    { command: 'node apps/web/.output/server/index.mjs', url: 'http://127.0.0.1:3001', env: { HOST: '127.0.0.1', PORT: '3001', NUXT_PUBLIC_MATCH_URL: 'ws://127.0.0.1:2569' }, reuseExistingServer: false, timeout: 15000 },
  ],
})
