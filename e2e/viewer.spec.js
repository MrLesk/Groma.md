import { expect, test } from '@playwright/test'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

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
  'element:scanner',
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
  'element:scanner',
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

async function expectAccessibleRelationships(page, expectedCount) {
  const accessibleNames = await page
    .locator('.react-flow__edge[role="group"]')
    .evaluateAll(edges => edges.map(edge => edge.getAttribute('aria-label')))
  const visibleLabels = await page.locator('.relationship-label').evaluateAll(
    labels => labels.map(label => {
      return [...label.querySelectorAll('span')].map(line => line.textContent)
    }),
  )

  expect(accessibleNames).toHaveLength(expectedCount)
  expect(visibleLabels).toHaveLength(expectedCount)
  for (const [index, accessibleName] of accessibleNames.entries()) {
    expect(accessibleName).toMatch(/^Relationship from .+ to .+: .+$/)
    for (const visibleLabel of visibleLabels[index]) {
      expect(accessibleName).toContain(visibleLabel)
    }
  }
}

async function expectReadableNode(page, elementId, minimumWidth) {
  const geometry = await page.getByTestId(`c4-node-${elementId}`).evaluate(node => {
    const nodeBox = node.getBoundingClientRect()
    const titleBox = node.querySelector('strong').getBoundingClientRect()

    return {
      nodeWidth: nodeBox.width,
      titleHeight: titleBox.height,
    }
  })

  expect(geometry.nodeWidth).toBeGreaterThanOrEqual(minimumWidth)
  expect(geometry.titleHeight).toBeGreaterThanOrEqual(9)
}

async function expectComparisonStates(page, statesByElementId) {
  for (const [elementId, comparisonStatus] of Object.entries(statesByElementId)) {
    await expect(
      page.locator(`[data-element-id="${elementId}"]`),
    ).toHaveAttribute('data-comparison-status', comparisonStatus)
  }
}

async function expectNoOverlap(page, testIds) {
  const overlaps = await page.evaluate(ids => {
    const boxes = ids.map(id => {
      const element = document.querySelector(`[data-testid="${id}"]`)
      const rectangle = element.getBoundingClientRect()
      return {
        id,
        left: rectangle.left,
        right: rectangle.right,
        top: rectangle.top,
        bottom: rectangle.bottom,
      }
    })
    const collisions = []

    for (const [index, box] of boxes.entries()) {
      for (const peer of boxes.slice(index + 1)) {
        const separated = box.right <= peer.left
          || peer.right <= box.left
          || box.bottom <= peer.top
          || peer.bottom <= box.top
        if (!separated) {
          collisions.push(`${box.id}:${peer.id}`)
        }
      }
    }
    return collisions
  }, testIds)

  expect(overlaps).toEqual([])
}

async function computedContrastRatio(page, foregroundSelector, backgroundSelector) {
  return page.evaluate(({ foregroundSelector, backgroundSelector }) => {
    function channels(color) {
      return color.match(/[\d.]+/g).slice(0, 3).map(Number)
    }
    function luminance(color) {
      const [red, green, blue] = channels(color).map(channel => {
        const normalized = channel / 255
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue
    }

    const foreground = getComputedStyle(
      document.querySelector(foregroundSelector),
    ).color
    const background = getComputedStyle(
      document.querySelector(backgroundSelector),
    ).backgroundColor
    const values = [luminance(foreground), luminance(background)]
      .sort((left, right) => right - left)
    return (values[0] + 0.05) / (values[1] + 0.05)
  }, { foregroundSelector, backgroundSelector })
}

async function exerciseThreeLevelFlow(page, testInfo, viewport) {
  await page.setViewportSize(viewport)
  await page.goto('/')

  await expect(page).toHaveTitle('Groma · Architecture viewer')
  await expect(page.getByTestId('view-context')).toBeVisible()
  await expect(page.locator('.status-page')).toHaveCount(0)
  await expect(
    page.getByRole('list', { name: 'Comparison key' }),
  ).toBeVisible()
  await expectMembership(page, contextNodes, contextEdges)
  await expectComparisonStates(page, {
    'coding-agent': 'modification',
    git: 'unchanged',
    groma: 'modification',
    'human-architect': 'modification',
  })
  await expect(
    page.getByTestId('c4-node-groma').getByText('Planned modification'),
  ).toBeVisible()
  await expect(
    page.getByTestId('c4-node-git').locator('.comparison-badge'),
  ).toHaveCount(0)
  await expect(page.locator('.relationship-label')).toContainText([
    'Reads plans and records materialized architecture',
    'Versions and reviews architecture changes',
    'Authors current and planned architecture',
  ])
  await expect(
    page.locator('.react-flow__edge[role="group"]'),
  ).toHaveCount(contextEdges.length)
  await expectAccessibleRelationships(page, contextEdges.length)
  await expect(
    page.locator('.react-flow__edge[role="group"]').first(),
  ).toHaveAttribute(
    'aria-label',
    'Relationship from Coding agent to Groma: '
      + 'Unchanged · Reads plans and records materialized architecture · Markdown and Git; '
      + 'Planned addition · Inspects architecture during implementation · Local web interface',
  )
  if (viewport.name === 'mobile') {
    await expectReadableNode(page, 'groma', 145)
  }
  await page.screenshot({
    path: testInfo.outputPath(`context-${viewport.name}.png`),
    fullPage: true,
  })

  await page.getByRole('button', { name: 'Open Groma system' }).click()
  await expect(page.getByTestId('view-container')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Container view' }),
  ).toBeFocused()
  await expectMembership(page, containerNodes, containerEdges)
  await expectComparisonStates(page, {
    'architecture-workspace': 'unchanged',
    groma: 'modification',
    scanner: 'removal',
    viewer: 'addition',
  })
  await expect(
    page.getByTestId('c4-node-viewer').getByText('Planned addition'),
  ).toBeVisible()
  await expect(
    page
      .getByTestId('c4-node-architecture-workspace')
      .locator('.comparison-badge'),
  ).toHaveCount(0)
  await expectAccessibleRelationships(page, containerEdges.length)

  await page.getByRole('button', { name: 'Open Viewer container' }).click()
  await expect(page.getByTestId('view-component')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Component view' }),
  ).toBeFocused()
  await expectMembership(page, componentNodes, componentEdges)
  await expectComparisonStates(page, {
    'architecture-model': 'addition',
    'architecture-workspace': 'unchanged',
    canvas: 'addition',
    groma: 'modification',
    'markdown-reader': 'addition',
    'markdown-watcher': 'addition',
    scanner: 'removal',
    viewer: 'addition',
  })
  await expectAccessibleRelationships(page, componentEdges.length)
  if (viewport.name === 'mobile') {
    await expectReadableNode(page, 'architecture-model', 100)
  }
  await page.screenshot({
    path: testInfo.outputPath(`components-${viewport.name}.png`),
    fullPage: true,
  })

  await page.getByRole('button', { name: 'Previous level' }).click()
  await expect(page.getByTestId('view-container')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Container view' }),
  ).toBeFocused()
  await expectMembership(page, containerNodes, containerEdges)
  await page.getByRole('button', { name: 'Previous level' }).click()
  await expect(page.getByTestId('view-context')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'System context' }),
  ).toBeFocused()
  await expectMembership(page, contextNodes, contextEdges)
}

test('reloads architecture Markdown while preserving the open viewer process', async ({
  page,
}) => {
  const fixtureRoot = path.join(
    os.tmpdir(),
    'groma-live-reload-browser-4180',
  )
  const planRoot = path.join(
    fixtureRoot,
    'groma',
    'plans',
    '02-live-viewer',
  )
  const planComponent = path.join(
    planRoot,
    'systems/groma/containers/viewer/components/live-sample.md',
  )
  const invalidDocument = path.join(planRoot, 'people/invalid.md')
  const planReadme = path.join(planRoot, 'README.md')
  const outsideGroma = path.join(fixtureRoot, 'outside.md')
  const originalPlanReadme = await readFile(planReadme, 'utf8')

  try {
    await page.goto('http://127.0.0.1:4180')
    await expect(page.getByTestId('revision-context-title')).toHaveText(
      'Revision 02 — Live viewer',
    )
    await page.getByRole('button', { name: 'Open Groma system' }).click()
    await page.getByRole('button', { name: 'Open Viewer container' }).click()
    await expect(page.getByTestId('view-component')).toBeVisible()
    await page.evaluate(() => {
      window.__gromaLiveReloadSentinel = 'same-page'
    })

    await writeFile(
      planComponent,
      [
        '---',
        'id: live-sample',
        'kind: component',
        'parent: viewer',
        '---',
        '',
        '# Live sample',
        '',
        'Appears without restarting.',
        '',
      ].join('\n'),
    )
    await expect(page.getByTestId('c4-node-live-sample')).toBeVisible()

    await writeFile(
      planComponent,
      [
        '---',
        'id: live-sample',
        'kind: component',
        'parent: viewer',
        '---',
        '',
        '# Renamed live sample',
        '',
        'Changes after a complete rebuild.',
        '',
      ].join('\n'),
    )
    await expect(page.getByTestId('c4-node-live-sample')).toContainText(
      'Renamed live sample',
    )
    await rm(planComponent)
    await expect(page.getByTestId('c4-node-live-sample')).toHaveCount(0)

    await writeFile(
      planReadme,
      '# Reloaded revision title\n\nReloaded revision description.\n',
    )
    await expect(page.getByTestId('revision-context-title')).toHaveText(
      'Reloaded revision title',
    )
    await expect(page.getByTestId('revision-context-description')).toHaveText(
      'Reloaded revision description.',
    )
    await expect(
      page.locator('[data-element-id="Reloaded revision title"]'),
    ).toHaveCount(0)

    const generationAfterArchitectureChanges = (
      await (await page.request.get('http://127.0.0.1:4180/api/model')).json()
    ).generation
    await writeFile(outsideGroma, '# Outside Groma\n')
    await page.waitForTimeout(500)
    const generationAfterOutsideChange = (
      await (await page.request.get('http://127.0.0.1:4180/api/model')).json()
    ).generation
    expect(generationAfterOutsideChange).toBe(generationAfterArchitectureChanges)

    await mkdir(path.dirname(invalidDocument), { recursive: true })
    await writeFile(
      invalidDocument,
      '---\nid: [invalid\n---\n\n# Invalid while editing\n',
    )
    await expect(page.getByRole('status')).toContainText(
      'Keeping the last valid architecture',
    )
    await rm(invalidDocument)
    await expect(page.getByRole('status')).toHaveCount(0)
    await expect(page.getByTestId('view-component')).toBeVisible()

    expect(
      await page.evaluate(() => window.__gromaLiveReloadSentinel),
    ).toBe('same-page')
  } finally {
    await rm(planComponent, { force: true })
    await rm(invalidDocument, { force: true })
    await rm(outsideGroma, { force: true })
    await writeFile(planReadme, originalPlanReadme)
    await expect.poll(async () => {
      const response = await page.request.get(
        'http://127.0.0.1:4180/api/model',
      )
      const finalPayload = await response.json()
      return {
        reloadError: finalPayload.reloadError,
        title: finalPayload.revisionContext.title,
      }
    }).toEqual({
      reloadError: null,
      title: 'Revision 02 — Live viewer',
    })
  }
})

test('never replaces a newer model with an older delayed generation', async ({
  page,
}) => {
  const planReadme = path.join(
    os.tmpdir(),
    'groma-live-reload-browser-4180',
    'groma/plans/02-live-viewer/README.md',
  )
  const originalPlanReadme = await readFile(planReadme, 'utf8')
  let delayNextModel = false
  let releaseDelayedResponse = () => {}
  let delayedResponseStartedResolve
  let delayedResponseFinishedResolve
  const delayedResponseStarted = new Promise(resolve => {
    delayedResponseStartedResolve = resolve
  })
  const delayedResponseFinished = new Promise(resolve => {
    delayedResponseFinishedResolve = resolve
  })
  const releaseDelayed = new Promise(resolve => {
    releaseDelayedResponse = resolve
  })

  await page.goto('http://127.0.0.1:4180')
  await expect(page.getByTestId('revision-context-title')).toHaveText(
    'Revision 02 — Live viewer',
  )
  await page.route('**/api/model', async route => {
    const response = await route.fetch()
    const body = await response.body()

    if (delayNextModel) {
      delayNextModel = false
      delayedResponseStartedResolve()
      await releaseDelayed
      await route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body,
      })
      delayedResponseFinishedResolve()
      return
    }

    await route.fulfill({
      status: response.status(),
      headers: response.headers(),
      body,
    })
  })

  try {
    delayNextModel = true
    await writeFile(
      planReadme,
      '# Delayed older revision\n\nThis response must not win.\n',
    )
    await delayedResponseStarted

    await writeFile(
      planReadme,
      '# Newest revision\n\nThis response must remain visible.\n',
    )
    await expect(page.getByTestId('revision-context-title')).toHaveText(
      'Newest revision',
    )

    releaseDelayedResponse()
    await delayedResponseFinished
    await page.waitForTimeout(100)
    await expect(page.getByTestId('revision-context-title')).toHaveText(
      'Newest revision',
    )
  } finally {
    releaseDelayedResponse()
    await writeFile(planReadme, originalPlanReadme)
    await expect.poll(async () => {
      const response = await page.request.get(
        'http://127.0.0.1:4180/api/model',
      )
      return (await response.json()).revisionContext.title
    }).toBe('Revision 02 — Live viewer')
  }
})

test('replays an invalid-edit status to late and reconnected clients', async ({
  page,
}) => {
  const invalidDocument = path.join(
    os.tmpdir(),
    'groma-live-reload-browser-4180',
    'groma/plans/02-live-viewer/people/reconnect-invalid.md',
  )

  try {
    await writeFile(
      invalidDocument,
      '---\nid: [invalid\n---\n\n# Invalid before connecting\n',
    )
    await expect.poll(async () => {
      const response = await page.request.get(
        'http://127.0.0.1:4180/api/model',
      )
      return (await response.json()).reloadError
    }).toContain('reconnect-invalid.md')

    const eventController = new AbortController()
    const eventResponse = await fetch('http://127.0.0.1:4180/api/events', {
      signal: eventController.signal,
    })
    const eventReader = eventResponse.body.getReader()
    const firstEvent = await eventReader.read()
    eventController.abort()
    expect(new TextDecoder().decode(firstEvent.value)).toContain(
      'reconnect-invalid.md',
    )

    await page.goto('http://127.0.0.1:4180')
    await expect(page.getByRole('status')).toContainText(
      'Keeping the last valid architecture',
    )
    await page.reload()
    await expect(page.getByRole('status')).toContainText(
      'reconnect-invalid.md',
    )

    await rm(invalidDocument)
    await expect(page.getByRole('status')).toHaveCount(0)
  } finally {
    await rm(invalidDocument, { force: true })
  }
})

test('ignores extensionless and non-Markdown files inside watched roots', async ({
  page,
}) => {
  const planRoot = path.join(
    os.tmpdir(),
    'groma-live-reload-browser-4180',
    'groma/plans/02-live-viewer',
  )
  const extensionless = path.join(planRoot, 'watcher-probe')
  const nonMarkdown = path.join(planRoot, 'watcher-probe.txt')
  const initialPayload = await (
    await page.request.get('http://127.0.0.1:4180/api/model')
  ).json()

  try {
    await writeFile(extensionless, 'not architecture\n')
    await writeFile(nonMarkdown, 'not architecture\n')
    await page.waitForTimeout(500)

    const afterNonMarkdown = await (
      await page.request.get('http://127.0.0.1:4180/api/model')
    ).json()
    expect(afterNonMarkdown.generation).toBe(initialPayload.generation)
  } finally {
    await rm(extensionless, { force: true })
    await rm(nonMarkdown, { force: true })
  }
})

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

test('switches directly between component-bearing sibling containers in Plan 03', async ({
  page,
}) => {
  const browserErrors = []
  page.on('console', message => {
    if (message.type() === 'error') {
      browserErrors.push(message.text())
    }
  })
  page.on('pageerror', error => {
    browserErrors.push(error.message)
  })

  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('http://127.0.0.1:4178')
  await page.getByRole('button', { name: 'Open Groma system' }).click()
  await page.getByRole('button', { name: 'Open Viewer container' }).click()
  await expect(page.getByTestId('c4-boundary-viewer')).toBeVisible()

  await page.getByRole('button', { name: 'Open Scanner container' }).click()
  await expect(page.getByTestId('view-component')).toBeVisible()
  await expect(page.getByTestId('c4-boundary-scanner')).toBeVisible()
  await expect(page.getByTestId('c4-node-source-watcher')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Component view' }),
  ).toBeFocused()

  await page.getByRole('button', { name: 'Open Viewer container' }).click()
  await expect(page.getByTestId('c4-boundary-viewer')).toBeVisible()
  await expect(page.getByTestId('c4-node-markdown-reader')).toBeVisible()
  expect(browserErrors).toEqual([])
})

test('keeps the comparison containment union distinct and selectable', async ({
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
  await page.goto('http://127.0.0.1:4179')
  const relationshipEdges = page.locator('.react-flow__edge[role="group"]')
  await expect(relationshipEdges).not.toHaveCount(0)
  const relationshipNames = await relationshipEdges
    .evaluateAll(edges => edges.map(edge => edge.getAttribute('aria-label')))
  expect(relationshipNames.join('\n')).toContain(
    'Observed · Studies current Groma · HTTP',
  )
  expect(relationshipNames.join('\n')).toContain(
    'Planned modification · Studies planned Groma · Events',
  )
  expect(relationshipNames.join('\n')).toContain(
    'Planned removal · Sends current signal · Events',
  )
  expect(relationshipNames.join('\n')).toContain(
    'Planned addition · Sends planned signal · Events',
  )
  await page.getByRole('button', { name: 'Open Groma system' }).click()
  await expect(page.getByTestId('view-container')).toBeVisible()

  const containers = [
    ['added-container', 'Added container', 'addition'],
    ['modified-container', 'Modified container', 'modification'],
    ['moved-in-container', 'Moved in container', 'modification'],
    ['moved-out-container', 'Moved out container', 'modification'],
    ['removed-container', 'Removed container', 'removal'],
    ['stable-container', 'Stable container', 'unchanged'],
  ]
  await expectComparisonStates(
    page,
    Object.fromEntries(
      containers.map(([elementId, , status]) => [elementId, status]),
    ),
  )
  await expectNoOverlap(
    page,
    containers.map(([elementId]) => `c4-node-${elementId}`),
  )
  const accessibleContainerNames = [
    'Open Added container container. Planned addition.',
    'Open Modified container container. Planned modification.',
    'Open Moved in container container. '
      + 'Planned modification. Moved from Other system to Groma.',
    'Open Moved out container container. '
      + 'Planned modification. Moved from Groma to Other system.',
    'Open Removed container container. Planned removal.',
    'Open Stable container container. Unchanged.',
  ]
  for (const accessibleName of accessibleContainerNames) {
    await expect(
      page.getByRole('button', { name: accessibleName }),
    ).toBeVisible()
  }
  await expect(
    page
      .getByTestId('c4-node-moved-out-container')
      .getByText('Moved from Groma to Other system'),
  ).toBeVisible()
  const comparisonBadgeElements = {
    addition: 'added-container',
    modification: 'modified-container',
    removal: 'removed-container',
  }
  for (const [status, elementId] of Object.entries(comparisonBadgeElements)) {
    const badgeSelector =
      `[data-testid="c4-node-${elementId}"] .comparison-badge`
    const contrast = await computedContrastRatio(
      page,
      badgeSelector,
      badgeSelector,
    )
    expect(
      contrast,
      `${status} badge contrast must retain a safety margin above 4.5:1`,
    ).toBeGreaterThanOrEqual(4.75)
  }
  await page.screenshot({
    path: testInfo.outputPath('comparison-containers.png'),
    fullPage: true,
  })

  for (const [elementId, name] of containers) {
    await page.getByRole('button', {
      name: new RegExp(`^Open ${name} container`),
    }).click()
    await expect(page.getByTestId(`c4-boundary-${elementId}`)).toBeVisible()
    await expect(page.getByTestId('view-component')).toBeVisible()
    if (elementId === 'stable-container' || elementId === 'modified-container') {
      await expect(page.getByTestId('c4-node-travelling-worker')).toBeVisible()
      await expect(
        page
          .getByTestId('c4-node-travelling-worker')
          .getByText('Moved from Stable container to Modified container'),
      ).toBeVisible()
    }
    await page.getByRole('button', { name: 'Previous level' }).click()
    await expect(page.getByTestId('view-container')).toBeVisible()
  }

  expect(browserMessages).toEqual([])
})
