import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { compareArchitectureModels } from '../src/architecture-comparison.mjs'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

function frontmatter(fields) {
  return [
    '---',
    ...Object.entries(fields).map(([key, value]) => `${key}: ${value}`),
    '---',
  ].join('\n')
}

async function writeDocument(
  revisionRoot,
  relativeFilename,
  fields,
  title,
  description,
) {
  const filename = path.join(revisionRoot, relativeFilename)
  await mkdir(path.dirname(filename), { recursive: true })
  await writeFile(
    filename,
    `${frontmatter(fields)}\n\n# ${title}\n\n${description}\n`,
  )
}

async function writeRevision(repositoryRoot, revision) {
  const isPlan = revision === 'plan'
  const revisionRoot = isPlan
    ? path.join(repositoryRoot, 'groma/plans/02-live-viewer')
    : path.join(repositoryRoot, 'groma/observed')
  await mkdir(revisionRoot, { recursive: true })
  await writeFile(
    path.join(revisionRoot, 'README.md'),
    isPlan
      ? '# Revision 02 — Controlled live viewer\n\nNamed release-gate plan.\n'
      : '# Controlled observed architecture\n\nObserved release-gate snapshot.\n',
  )

  await writeDocument(
    revisionRoot,
    'people/architect.md',
    { id: 'architect', kind: 'person' },
    'Architect',
    'Reads the controlled architecture.',
  )
  await writeDocument(
    revisionRoot,
    'systems/groma/system.md',
    { id: 'groma', kind: 'system' },
    'Groma',
    'Keeps architecture as Markdown.',
  )

  const containers = [
    {
      id: 'architecture-workspace',
      title: 'Architecture workspace',
      description: 'Stores observed and named plan Markdown.',
      include: true,
    },
    {
      id: 'delivery',
      title: 'Delivery',
      description: isPlan
        ? 'Publishes the planned viewer.'
        : 'Publishes the current architecture.',
      include: true,
    },
    {
      id: 'legacy',
      title: 'Legacy',
      description: 'Exists only in observed architecture.',
      include: !isPlan,
    },
    {
      id: 'viewer',
      title: 'Viewer',
      description: 'Exists only in the named plan.',
      include: isPlan,
    },
  ]

  for (const container of containers.filter(candidate => candidate.include)) {
    const containerRoot =
      `systems/groma/containers/${container.id}`
    await writeDocument(
      revisionRoot,
      `${containerRoot}/container.md`,
      { id: container.id, kind: 'container', parent: 'groma' },
      container.title,
      container.description,
    )
    await writeDocument(
      revisionRoot,
      `${containerRoot}/components/${container.id}-component.md`,
      {
        id: `${container.id}-component`,
        kind: 'component',
        parent: container.id,
      },
      `${container.title} component`,
      `Makes ${container.title.toLowerCase()} decomposable.`,
    )
  }
}

async function createFixture() {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'groma-release-gate-'),
  )
  await Promise.all([
    writeRevision(repositoryRoot, 'observed'),
    writeRevision(repositoryRoot, 'plan'),
  ])

  const sourceRoot = path.join(repositoryRoot, 'src')
  await mkdir(sourceRoot)
  await writeFile(
    path.join(sourceRoot, 'must-not-be-read.ts'),
    'throw new Error("architecture workflow read project source")\n',
  )
  await chmod(sourceRoot, 0o000)

  return { repositoryRoot, sourceRoot }
}

function waitForViewerUrl(child, stderr) {
  return new Promise((resolve, reject) => {
    let stdout = ''
    const timeout = setTimeout(() => {
      reject(new Error(`Viewer did not start.\n${stdout}\n${stderr.value}`))
    }, 10_000)

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => {
      stdout += chunk
      const match = stdout.match(/at (http:\/\/127\.0\.0\.1:\d+\/)/)
      if (!match) return

      clearTimeout(timeout)
      resolve(match[1])
    })
    child.stderr.on('data', chunk => {
      stderr.value += chunk
    })
    child.once('exit', (code, signal) => {
      clearTimeout(timeout)
      reject(
        new Error(
          `Viewer exited before startup: code=${code} signal=${signal}\n`
            + stderr.value,
        ),
      )
    })
  })
}

async function startViewer(repositoryRoot, revision) {
  const stderr = { value: '' }
  const child = spawn(
    'bun',
    [
      'run',
      'src/viewer/server.mjs',
      '--port',
      '0',
      '--revision',
      revision,
    ],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        GROMA_TEST_REPOSITORY_ROOT: repositoryRoot,
        NODE_ENV: 'test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  const exit = once(child, 'exit')
  const url = await waitForViewerUrl(child, stderr)
  return { child, exit, stderr, url }
}

async function stopViewer(viewer) {
  viewer.child.kill('SIGTERM')
  const [code, signal] = await viewer.exit
  expect({ code, signal, stderr: viewer.stderr.value }).toEqual({
    code: 0,
    signal: null,
    stderr: '',
  })
}

async function modelPayload(page, viewerUrl) {
  const response = await page.request.get(
    new URL('/api/model', viewerUrl).href,
  )
  expect(response.ok()).toBe(true)
  return response.json()
}

function structuralSnapshot(payload) {
  return {
    focalSystemId: payload.focalSystemId,
    model: payload.model,
    observedModel: payload.observedModel,
    comparison: compareArchitectureModels(
      payload.observedModel,
      payload.model,
    ),
  }
}

test('verifies the complete Markdown-to-view release gate', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000)
  const { repositoryRoot, sourceRoot } = await createFixture()
  const browserMessages = []
  let viewer

  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') {
      browserMessages.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', error => {
    browserMessages.push(`pageerror: ${error.message}`)
  })

  try {
    viewer = await startViewer(repositoryRoot, 'observed')
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.goto(viewer.url)
    await expect(page).toHaveTitle('Groma · Architecture viewer')
    await expect(page.locator('.status-page')).toHaveCount(0)
    await expect(page.getByTestId('view-context')).toBeVisible()
    await expect(page.getByTestId('revision-context-title')).toHaveText(
      'Controlled observed architecture',
    )

    await page.getByRole('button', { name: 'Open Groma system' }).click()
    await expect(page.getByTestId('view-container')).toBeVisible()
    await page.getByRole('button', {
      name: /^Open Architecture workspace container/,
    }).click()
    await expect(page.getByTestId('view-component')).toBeVisible()
    await expect(
      page.getByTestId('c4-node-architecture-workspace-component'),
    ).toContainText('Architecture workspace component')
    await page.getByRole('button', { name: 'Previous level' }).click()
    await expect(page.getByTestId('view-container')).toBeVisible()
    await page.getByRole('button', { name: 'Previous level' }).click()
    await expect(page.getByTestId('view-context')).toBeVisible()
    await page.goto('about:blank')
    await stopViewer(viewer)
    viewer = undefined

    viewer = await startViewer(repositoryRoot, 'plan:02-live-viewer')
    await page.goto(viewer.url)
    await expect(page.locator('.status-page')).toHaveCount(0)
    await expect(page.getByTestId('revision-context-title')).toHaveText(
      'Revision 02 — Controlled live viewer',
    )
    await page.getByRole('button', { name: 'Open Groma system' }).click()

    const states = {
      'architecture-workspace': 'unchanged',
      delivery: 'modification',
      legacy: 'removal',
      viewer: 'addition',
    }
    for (const [elementId, status] of Object.entries(states)) {
      await expect(
        page.locator(`[data-element-id="${elementId}"]`),
      ).toHaveAttribute('data-comparison-status', status)
    }
    await expect(
      page.getByTestId('c4-node-viewer').getByText('Planned addition'),
    ).toBeVisible()
    await expect(
      page.getByTestId('c4-node-delivery').getByText('Planned modification'),
    ).toBeVisible()
    await expect(
      page.getByTestId('c4-node-legacy').getByText('Planned removal'),
    ).toBeVisible()
    await expect(
      page
        .getByTestId('c4-node-architecture-workspace')
        .locator('.comparison-badge'),
    ).toHaveCount(0)

    await page.getByRole('button', {
      name: /^Open Architecture workspace container/,
    }).click()
    await writeDocument(
      path.join(repositoryRoot, 'groma/plans/02-live-viewer'),
      'systems/groma/containers/architecture-workspace/'
        + 'components/live-gate.md',
      {
        id: 'live-gate',
        kind: 'component',
        parent: 'architecture-workspace',
      },
      'Live gate component',
      'Appears in the already-open component view.',
    )
    await expect(page.getByTestId('c4-node-live-gate')).toContainText(
      'Live gate component',
    )
    await writeDocument(
      path.join(repositoryRoot, 'groma/plans/02-live-viewer'),
      'systems/groma/containers/architecture-workspace/'
        + 'components/live-gate.md',
      {
        id: 'live-gate',
        kind: 'component',
        parent: 'architecture-workspace',
      },
      'Renamed live gate component',
      'Rebuilt from an edited Markdown document.',
    )
    await expect(page.getByTestId('c4-node-live-gate')).toContainText(
      'Renamed live gate component',
    )

    const beforeSourceChange = await modelPayload(page, viewer.url)
    await chmod(sourceRoot, 0o755)
    await writeFile(
      path.join(sourceRoot, 'must-not-be-read.ts'),
      'export const sourceChangeMustStayInvisible = true\n',
    )
    await page.waitForTimeout(500)
    const afterSourceChange = await modelPayload(page, viewer.url)
    expect(afterSourceChange.generation).toBe(beforeSourceChange.generation)
    expect(structuralSnapshot(afterSourceChange)).toEqual(
      structuralSnapshot(beforeSourceChange),
    )

    await page.screenshot({
      path: testInfo.outputPath('release-gate-live-component.png'),
      fullPage: true,
    })
    const beforeRestart = structuralSnapshot(afterSourceChange)
    await page.goto('about:blank')
    await stopViewer(viewer)
    viewer = undefined

    viewer = await startViewer(repositoryRoot, 'plan:02-live-viewer')
    const restartedPayload = await modelPayload(page, viewer.url)
    expect(structuralSnapshot(restartedPayload)).toEqual(beforeRestart)
    await page.goto(viewer.url)
    await page.getByRole('button', { name: 'Open Groma system' }).click()
    await page.getByRole('button', {
      name: /^Open Architecture workspace container/,
    }).click()
    await expect(page.getByTestId('c4-node-live-gate')).toContainText(
      'Renamed live gate component',
    )

    expect(browserMessages).toEqual([])
  } finally {
    if (viewer) {
      await page.goto('about:blank').catch(() => {})
      await stopViewer(viewer)
    }
    await chmod(sourceRoot, 0o755).catch(() => {})
    await rm(repositoryRoot, { recursive: true, force: true })
  }
})
