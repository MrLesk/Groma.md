import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'release-gate.spec.js',
  outputDir: '/tmp/groma-release-gate-playwright-results',
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    trace: 'off',
  },
})
