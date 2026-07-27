import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  outputDir: '/tmp/groma-playwright-results',
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4177',
    trace: 'off',
  },
  webServer: [
    {
      command: 'npm run viewer -- --port 4177',
      url: 'http://127.0.0.1:4177/api/model',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command:
        'npm run viewer -- --port 4178 --revision plan:03-code-observation',
      url: 'http://127.0.0.1:4178/api/model',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'bun run e2e/comparison-fixture-server.mjs --port 4179',
      url: 'http://127.0.0.1:4179/api/model',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'bun run e2e/live-reload-fixture-server.mjs --port 4180',
      url: 'http://127.0.0.1:4180/api/model',
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
})
