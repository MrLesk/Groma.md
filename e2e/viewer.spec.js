import { expect, test } from '@playwright/test'

const contextNodes = [
  'element:coding-agent',
  'element:git',
  'element:groma',
  'element:human-architect',
]
const contextEdges = [
  'relationship:0:element:coding-agent:element:groma',
  'relationship:1:element:groma:element:git',
  'relationship:2:element:human-architect:element:groma',
]
const containerNodes = [
  'boundary:groma',
  'element:architecture-workspace',
  'element:coding-agent',
  'element:git',
  'element:human-architect',
  'element:viewer',
]
const containerEdges = [
  'relationship:0:element:architecture-workspace:element:git',
  'relationship:1:element:coding-agent:element:architecture-workspace',
  'relationship:2:element:coding-agent:element:viewer',
  'relationship:3:element:human-architect:element:architecture-workspace',
  'relationship:4:element:human-architect:element:viewer',
  'relationship:5:element:viewer:element:architecture-workspace',
]
const componentNodes = [
  'boundary:groma',
  'boundary:viewer',
  'element:architecture-model',
  'element:architecture-workspace',
  'element:canvas',
  'element:coding-agent',
  'element:git',
  'element:human-architect',
  'element:markdown-reader',
  'element:markdown-watcher',
]
const componentEdges = [
  'relationship:0:boundary:viewer:element:architecture-workspace',
  'relationship:1:element:architecture-model:element:canvas',
  'relationship:2:element:architecture-workspace:element:git',
  'relationship:3:element:coding-agent:boundary:viewer',
  'relationship:4:element:coding-agent:element:architecture-workspace',
  'relationship:5:element:human-architect:boundary:viewer',
  'relationship:6:element:human-architect:element:architecture-workspace',
  'relationship:7:element:markdown-reader:element:architecture-model',
  'relationship:8:element:markdown-watcher:element:architecture-model',
  'relationship:9:element:markdown-watcher:element:architecture-workspace',
]

async function expectMembership(page, expectedNodes, expectedEdges) {
  await expect.poll(async () => {
    return page.locator('.react-flow__node').evaluateAll(nodes => {
      return nodes.map(node => node.getAttribute('data-id')).sort()
    })
  }).toEqual(expectedNodes)

  await expect.poll(async () => {
    return page.locator('.react-flow__edge').evaluateAll(edges => {
      return edges.map(edge => edge.getAttribute('data-id')).sort()
    })
  }).toEqual(expectedEdges)
}

async function exerciseThreeLevelFlow(page, testInfo, viewport) {
  await page.setViewportSize(viewport)
  await page.goto('/')

  await expect(page).toHaveTitle('Groma · Architecture viewer')
  await expect(page.getByTestId('view-context')).toBeVisible()
  await expect(page.locator('.status-page')).toHaveCount(0)
  await expectMembership(page, contextNodes, contextEdges)
  await expect(page.locator('.relationship-label')).toContainText([
    'Reads plans and records materialized architecture',
    'Versions and reviews architecture changes',
    'Authors current and planned architecture',
  ])
  await page.screenshot({
    path: testInfo.outputPath(`context-${viewport.name}.png`),
    fullPage: true,
  })

  await page.getByRole('button', { name: 'Open Groma system' }).click()
  await expect(page.getByTestId('view-container')).toBeVisible()
  await expectMembership(page, containerNodes, containerEdges)

  await page.getByRole('button', { name: 'Open Viewer container' }).click()
  await expect(page.getByTestId('view-component')).toBeVisible()
  await expectMembership(page, componentNodes, componentEdges)
  await page.screenshot({
    path: testInfo.outputPath(`components-${viewport.name}.png`),
    fullPage: true,
  })

  await page.getByRole('button', { name: 'Previous level' }).click()
  await expect(page.getByTestId('view-container')).toBeVisible()
  await expectMembership(page, containerNodes, containerEdges)
  await page.getByRole('button', { name: 'Previous level' }).click()
  await expect(page.getByTestId('view-context')).toBeVisible()
  await expectMembership(page, contextNodes, contextEdges)
}

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

  await exerciseThreeLevelFlow(
    page,
    testInfo,
    { name: 'desktop', width: 1440, height: 960 },
  )
  await exerciseThreeLevelFlow(
    page,
    testInfo,
    { name: 'mobile', width: 390, height: 844 },
  )

  const mobileViewport = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }))
  expect(mobileViewport.documentWidth).toBeLessThanOrEqual(
    mobileViewport.innerWidth,
  )
  expect(browserMessages).toEqual([])
})
