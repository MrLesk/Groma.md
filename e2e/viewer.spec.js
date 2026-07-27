import { expect, test } from '@playwright/test'

test('navigates three C4 levels and returns on desktop and mobile', async ({
  page,
}, testInfo) => {
  const browserMessages = []
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') {
      browserMessages.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', error => {
    browserMessages.push(`pageerror: ${error.message}`)
  })

  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')

  await expect(page).toHaveTitle('Groma · Architecture viewer')
  await expect(page.getByTestId('view-context')).toBeVisible()
  await expect(page.locator('.status-page')).toHaveCount(0)
  await expect(page.locator('[data-testid^="c4-node-"]')).toHaveCount(4)
  await expect(page.getByTestId('c4-node-coding-agent')).toBeVisible()
  await expect(page.getByTestId('c4-node-human-architect')).toBeVisible()
  await expect(page.getByTestId('c4-node-groma')).toBeVisible()
  await expect(page.getByTestId('c4-node-git')).toBeVisible()
  await expect(page.locator('.relationship-label')).toContainText([
    'Reads plans and records materialized architecture',
    'Versions and reviews architecture changes',
    'Authors current and planned architecture',
  ])
  await page.screenshot({
    path: testInfo.outputPath('context-desktop.png'),
    fullPage: true,
  })

  await page.getByRole('button', { name: 'Open Groma system' }).click()
  await expect(page.getByTestId('view-container')).toBeVisible()
  await expect(page.getByTestId('c4-boundary-groma')).toBeVisible()
  await expect(page.getByTestId('c4-node-architecture-workspace')).toBeVisible()
  await expect(page.getByTestId('c4-node-viewer')).toBeVisible()
  await expect(page.getByTestId('c4-node-git')).toBeVisible()

  await page.getByRole('button', { name: 'Open Viewer container' }).click()
  await expect(page.getByTestId('view-component')).toBeVisible()
  await expect(page.getByTestId('c4-boundary-viewer')).toBeVisible()
  await expect(page.getByTestId('c4-node-architecture-workspace')).toBeVisible()
  await expect(page.getByTestId('c4-node-git')).toBeVisible()
  await expect(page.getByTestId('c4-node-architecture-model')).toBeVisible()
  await expect(page.getByTestId('c4-node-canvas')).toBeVisible()
  await expect(page.getByTestId('c4-node-markdown-reader')).toBeVisible()
  await expect(page.getByTestId('c4-node-markdown-watcher')).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('components-desktop.png'),
    fullPage: true,
  })

  await page.getByRole('button', { name: 'Previous level' }).click()
  await expect(page.getByTestId('view-container')).toBeVisible()
  await page.getByRole('button', { name: 'Previous level' }).click()
  await expect(page.getByTestId('view-context')).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(page.getByTestId('view-context')).toBeVisible()
  const viewport = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }))
  expect(viewport.documentWidth).toBeLessThanOrEqual(viewport.innerWidth)
  await page.screenshot({
    path: testInfo.outputPath('context-mobile.png'),
    fullPage: true,
  })

  expect(browserMessages).toEqual([])
})
