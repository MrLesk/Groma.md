import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import {
  access,
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { finished } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

import { compareArchitectureModels } from '../src/architecture-comparison.mjs'
import { projectArchitectureView } from '../src/viewer/projection.mjs'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const gracefulStopTimeoutMs = 3_000
const forcedStopTimeoutMs = 3_000
const stdioCloseTimeoutMs = 1_000

function frontmatter(fields) {
  return [
    '---',
    ...Object.entries(fields).map(([key, value]) => `${key}: ${value}`),
    '---',
  ].join('\n')
}

function relationshipTable(rows) {
  if (rows.length === 0) return ''

  return [
    '',
    '## Relationships',
    '',
    '| Target | Description | Technology |',
    '| --- | --- | --- |',
    ...rows.map(row => {
      return `| [${row.target}](${row.href}) | ${row.description} | ${row.technology} |`
    }),
    '',
  ].join('\n')
}

async function writeDocument(
  revisionRoot,
  relativeFilename,
  fields,
  title,
  description,
  relationships = [],
) {
  const filename = path.join(revisionRoot, relativeFilename)
  await mkdir(path.dirname(filename), { recursive: true })
  await writeFile(
    filename,
    `${frontmatter(fields)}\n\n# ${title}\n\n${description}\n`
      + relationshipTable(relationships),
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
    [
      {
        target: 'Groma',
        href: '../systems/groma/system.md',
        description: isPlan
          ? 'Reviews planned Groma'
          : 'Reviews current Groma',
        technology: isPlan ? 'Browser' : 'Markdown',
      },
      {
        target: 'Architecture workspace',
        href:
          '../systems/groma/containers/architecture-workspace/container.md',
        description: 'Reads architecture revisions',
        technology: 'Markdown',
      },
    ],
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

async function createFixture(options = {}) {
  const { afterRootCreated } = options
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'groma-release-gate-'),
  )
  const sourceRoot = path.join(repositoryRoot, 'src')

  try {
    await afterRootCreated?.(repositoryRoot)
    await Promise.all([
      writeRevision(repositoryRoot, 'observed'),
      writeRevision(repositoryRoot, 'plan'),
    ])

    await mkdir(sourceRoot)
    await writeFile(
      path.join(sourceRoot, 'must-not-be-read.ts'),
      'throw new Error("architecture workflow read project source")\n',
    )
    await chmod(sourceRoot, 0o000)

    return { repositoryRoot, sourceRoot }
  } catch (error) {
    await chmod(sourceRoot, 0o755).catch(() => {})
    await rm(repositoryRoot, { recursive: true, force: true })
    throw error
  }
}

class ProcessTimeoutError extends Error {
  constructor(label, timeoutMs) {
    super(`${label} did not complete within ${timeoutMs}ms`)
    this.name = 'ProcessTimeoutError'
  }
}

function within(promise, timeoutMs, label) {
  let timer
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      reject(new ProcessTimeoutError(label, timeoutMs))
    }, timeoutMs)
  })

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer)
  })
}

function trackProcess(child, stderr) {
  return {
    child,
    exit: once(child, 'exit'),
    stderr,
    stdio: Promise.allSettled([
      finished(child.stdout),
      finished(child.stderr),
    ]),
  }
}

async function closeProcessStdio(viewer, timeoutMs) {
  try {
    await within(viewer.stdio, timeoutMs, 'process stdio closure')
  } catch (error) {
    if (!(error instanceof ProcessTimeoutError)) throw error

    viewer.child.stdout.destroy()
    viewer.child.stderr.destroy()
    await within(viewer.stdio, timeoutMs, 'forced process stdio closure')
  }
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
        GROMA_TEST_IO_AUDIT: '1',
        NODE_ENV: 'test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  const viewer = trackProcess(child, stderr)
  try {
    const url = await waitForViewerUrl(child, stderr)
    return { ...viewer, url }
  } catch (error) {
    child.kill('SIGKILL')
    await within(
      viewer.exit,
      forcedStopTimeoutMs,
      'viewer startup SIGKILL',
    ).catch(() => {})
    await closeProcessStdio(viewer, stdioCloseTimeoutMs).catch(() => {})
    throw error
  }
}

async function startSourceRefreshProcess(repositoryRoot) {
  const stderr = { value: '' }
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => {
      return name !== 'FORCE_COLOR' && name !== 'NO_COLOR'
    }),
  )
  const child = spawn(
    process.execPath,
    [
      'src/source-refresh-process.mjs',
      '--repository',
      repositoryRoot,
    ],
    {
      cwd: projectRoot,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  const refresh = trackProcess(child, stderr)
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', chunk => {
    stderr.value += chunk
  })
  child.stdout.setEncoding('utf8')

  try {
    await within(new Promise((resolve, reject) => {
      let stdout = ''
      child.stdout.on('data', chunk => {
        stdout += chunk
        if (stdout.includes('Source refresh watching')) resolve()
      })
      child.once('exit', (code, signal) => {
        reject(new Error(
          `Source refresh exited before startup: code=${code} signal=${signal}`
            + `\n${stderr.value}`,
        ))
      })
    }), 10_000, 'source refresh startup')
    return refresh
  } catch (error) {
    child.kill('SIGKILL')
    await within(refresh.exit, forcedStopTimeoutMs, 'source refresh SIGKILL')
      .catch(() => {})
    await closeProcessStdio(refresh, stdioCloseTimeoutMs).catch(() => {})
    throw error
  }
}

async function createSourceRefreshFixture() {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'groma-source-refresh-gate-'),
  )
  const sourceFixtureRoot = path.join(
    projectRoot,
    'fixtures',
    'source-observation',
    'supported',
  )

  try {
    await Promise.all([
      cp(
        path.join(sourceFixtureRoot, 'package.json'),
        path.join(repositoryRoot, 'package.json'),
      ),
      cp(
        path.join(sourceFixtureRoot, 'src'),
        path.join(repositoryRoot, 'src'),
        { recursive: true },
      ),
      cp(
        path.join(projectRoot, 'groma'),
        path.join(repositoryRoot, 'groma'),
        { recursive: true },
      ),
    ])
    return repositoryRoot
  } catch (error) {
    await rm(repositoryRoot, { recursive: true, force: true })
    throw error
  }
}

async function stopViewer(viewer, options = {}) {
  const {
    expectedShutdown = 'graceful',
    termTimeoutMs = gracefulStopTimeoutMs,
    killTimeoutMs = forcedStopTimeoutMs,
    stdioTimeoutMs = stdioCloseTimeoutMs,
  } = options
  const expectedResult = expectedShutdown === 'graceful'
    ? { code: 0, escalated: false, signal: null }
    : expectedShutdown === 'forced'
      ? { code: null, escalated: true, signal: 'SIGKILL' }
      : null
  if (!expectedResult) {
    throw new TypeError(
      'expectedShutdown must be "graceful" or "forced"',
    )
  }
  let escalated = false
  let exitResult

  try {
    viewer.child.kill('SIGTERM')
    try {
      exitResult = await within(
        viewer.exit,
        termTimeoutMs,
        'viewer SIGTERM',
      )
    } catch (error) {
      if (!(error instanceof ProcessTimeoutError)) throw error

      escalated = true
      viewer.child.kill('SIGKILL')
      exitResult = await within(
        viewer.exit,
        killTimeoutMs,
        'viewer SIGKILL',
      )
    }
  } finally {
    await closeProcessStdio(viewer, stdioTimeoutMs)
  }

  const [code, signal] = exitResult
  const result = { code, escalated, signal }
  expect(result).toEqual(expectedResult)
  expect(viewer.stderr.value).toBe('')

  return result
}

async function modelPayload(page, viewerUrl) {
  const response = await page.request.get(
    new URL('/api/model', viewerUrl).href,
  )
  expect(response.ok()).toBe(true)
  return response.json()
}

function structuralSnapshot(payload) {
  const projectionOptions = {
    observedModel: payload.observedModel,
  }
  const focusPaths = {
    context: [],
    container: [payload.focalSystemId],
    component: [payload.focalSystemId, 'architecture-workspace'],
  }

  return {
    focalSystemId: payload.focalSystemId,
    model: payload.model,
    observedModel: payload.observedModel,
    comparison: compareArchitectureModels(
      payload.observedModel,
      payload.model,
    ),
    projections: Object.fromEntries(
      Object.entries(focusPaths).map(([name, focusPath]) => {
        return [
          name,
          projectArchitectureView(
            payload.model,
            payload.focalSystemId,
            focusPath,
            projectionOptions,
          ),
        ]
      }),
    ),
  }
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listFiles(entryPath))
    } else if (entry.isFile()) {
      files.push(entryPath)
    }
  }
  return files.sort()
}

test('keeps the Revision 02 viewer isolated from source observation', async () => {
  const sourceRoot = path.join(projectRoot, 'src')
  const sourceFiles = await listFiles(sourceRoot)
  const scannerPaths = sourceFiles
    .map(filename => path.relative(sourceRoot, filename))
    .filter(filename => /scanner/i.test(filename))
  const scannerSymbols = []
  const filesystemReaders = []
  const viewerObserverReferences = []

  for (const filename of sourceFiles.filter(candidate => {
    return /\.(?:js|jsx|mjs)$/.test(candidate)
  })) {
    const source = await readFile(filename, 'utf8')
    const relativeFilename = path.relative(sourceRoot, filename)
    if (
      relativeFilename.startsWith(`viewer${path.sep}`)
      && /source-(?:observer|refresh)|markdown-emitter|observeTypeScriptSource|emitObservedComponents|UnsupportedSourceShapeError/
        .test(source)
    ) {
      viewerObserverReferences.push(relativeFilename)
    }
    if (
      /source[-_\s]?scanner|project[-_\s]?scanner|scanProjectSource|scanSourceTree/i
        .test(source)
    ) {
      scannerSymbols.push(relativeFilename)
    }
    if (
      /from ['"]node:fs(?:\/promises)?['"]|Bun\.(?:file|Glob)\b/
        .test(source)
    ) {
      filesystemReaders.push(relativeFilename)
    }
  }

  expect(scannerPaths).toEqual([])
  expect(scannerSymbols).toEqual([])
  expect(viewerObserverReferences).toEqual([])
  expect(filesystemReaders.sort()).toEqual([
    'architecture-reader.mjs',
    'markdown-emitter.mjs',
    'source-observer.mjs',
    'source-refresh.mjs',
    path.join('viewer', 'markdown-watcher.mjs'),
  ])
})

test('refreshes one open source-blind viewer through observed Markdown', async ({
  page,
}) => {
  test.setTimeout(30_000)
  const repositoryRoot = await createSourceRefreshFixture()
  let refresh
  let viewer

  try {
    refresh = await startSourceRefreshProcess(repositoryRoot)
    viewer = await startViewer(repositoryRoot, 'observed')
    await page.goto(viewer.url)
    await expect(page.locator('.status-page')).toHaveCount(0)
    const documentSentinel = `source-refresh-${Date.now()}-${process.pid}`
    await page.evaluate(sentinel => {
      window.__gromaSourceRefreshDocumentSentinel = sentinel
    }, documentSentinel)
    const before = await modelPayload(page, viewer.url)

    const sourceWatcherFilename = path.join(
      repositoryRoot,
      'src',
      'components',
      'source-watcher.ts',
    )
    const source = await readFile(sourceWatcherFilename, 'utf8')
    await writeFile(
      sourceWatcherFilename,
      source.replace(
        'Requests a complete observation after supported source changes.',
        'Requests one settled complete observation after source changes.',
      ),
    )
    const generatedWatcherFilename = path.join(
      repositoryRoot,
      'groma',
      'observed',
      'systems',
      'groma',
      'containers',
      'scanner',
      'components',
      'source-watcher.md',
    )
    await expect.poll(async () => {
      return readFile(generatedWatcherFilename, 'utf8').catch(() => '')
    }).toContain('Requests one settled complete observation')
    await expect.poll(async () => {
      return (await modelPayload(page, viewer.url)).generation
    }).toBeGreaterThan(before.generation)

    expect(
      await page.evaluate(() => {
        return window.__gromaSourceRefreshDocumentSentinel
      }),
    ).toBe(documentSentinel)
    await page.getByRole('button', { name: 'Open Groma system' }).click()
    await page.getByRole('button', {
      name: /^Open Scanner container/,
    }).click()
    await expect(page.getByTestId('c4-node-source-watcher')).toContainText(
      'Requests one settled complete observation after source changes.',
    )

    const after = await modelPayload(page, viewer.url)
    expect(
      [...new Set(
        after.testIoAudit
          .filter(entry => entry.operation === 'watch')
          .map(entry => entry.path),
      )].sort(),
    ).toEqual(['groma/observed', 'groma/plans'])
    expect(
      after.testIoAudit.filter(entry => {
        return !/^groma\/(?:observed|plans)(?:\/|$)/.test(entry.path)
      }),
    ).toEqual([])
  } finally {
    await page.goto('about:blank').catch(() => {})
    if (viewer !== undefined) await stopViewer(viewer)
    if (refresh !== undefined) await stopViewer(refresh)
    await rm(repositoryRoot, { recursive: true, force: true })
  }
})

test('removes a partial fixture when setup fails', async () => {
  let partialRoot
  let setupError

  try {
    await createFixture({
      afterRootCreated(repositoryRoot) {
        partialRoot = repositoryRoot
        throw new Error('forced fixture setup failure')
      },
    })
  } catch (error) {
    setupError = error
  }

  expect(setupError?.message).toBe('forced fixture setup failure')
  const accessResult = await access(partialRoot).then(
    () => 'exists',
    error => error.code,
  )
  expect(accessResult).toBe('ENOENT')
})

test('escalates a stalled viewer and closes its stdio', async () => {
  const stderr = { value: '' }
  const child = spawn(
    process.execPath,
    [
      '-e',
      [
        "process.on('SIGTERM', () => {})",
        "process.stdout.write('ready\\n')",
        'setInterval(() => {}, 1_000)',
      ].join(';'),
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', chunk => {
    stderr.value += chunk
  })
  const ready = new Promise(resolve => {
    child.stdout.on('data', chunk => {
      if (chunk.includes('ready')) resolve()
    })
  })
  const stalledViewer = trackProcess(child, stderr)
  let stopped = false
  let result

  try {
    await within(ready, 1_000, 'stalled viewer startup')
    result = await stopViewer(stalledViewer, {
      expectedShutdown: 'forced',
      termTimeoutMs: 50,
      killTimeoutMs: 1_000,
      stdioTimeoutMs: 1_000,
    })
    stopped = true
  } finally {
    if (!stopped) {
      child.kill('SIGKILL')
      await within(
        stalledViewer.exit,
        1_000,
        'stalled viewer probe cleanup',
      ).catch(() => {})
      await closeProcessStdio(stalledViewer, 1_000).catch(() => {})
    }
  }

  expect(result).toEqual({
    code: null,
    escalated: true,
    signal: 'SIGKILL',
  })
  const processState = (() => {
    try {
      process.kill(child.pid, 0)
      return 'running'
    } catch (error) {
      return error.code
    }
  })()
  expect(processState).toBe('ESRCH')
})

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
    const firstViewerPid = viewer.child.pid
    expect(firstViewerPid).toBeGreaterThan(0)
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
    const observedShutdown = await stopViewer(viewer)
    expect(observedShutdown).toEqual({
      code: 0,
      escalated: false,
      signal: null,
    })
    viewer = undefined

    viewer = await startViewer(repositoryRoot, 'plan:02-live-viewer')
    expect(viewer.child.pid).toBeGreaterThan(0)
    expect(viewer.child.pid).not.toBe(firstViewerPid)
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
    const liveDocumentSentinel =
      `release-gate-document-${Date.now()}-${process.pid}`
    await page.evaluate(sentinel => {
      window.__gromaReleaseGateDocumentSentinel = sentinel
    }, liveDocumentSentinel)
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
    expect(
      await page.evaluate(() => window.__gromaReleaseGateDocumentSentinel),
    ).toBe(liveDocumentSentinel)
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
    expect(
      await page.evaluate(() => window.__gromaReleaseGateDocumentSentinel),
    ).toBe(liveDocumentSentinel)

    const beforeSourceChange = await modelPayload(page, viewer.url)
    await chmod(sourceRoot, 0o755)
    await writeFile(
      path.join(sourceRoot, 'must-not-be-read.ts'),
      'export const sourceChangeMustStayInvisible = true\n',
    )
    await writeFile(
      path.join(
        repositoryRoot,
        'groma/plans/02-live-viewer/README.md',
      ),
      [
        '# Revision 02 — Controlled live viewer',
        '',
        'Named release-gate plan.',
        '',
        '<!-- source-silence generation fence -->',
        '',
      ].join('\n'),
    )
    await expect.poll(async () => {
      return (await modelPayload(page, viewer.url)).generation
    }).toBeGreaterThan(beforeSourceChange.generation)
    const afterSourceFence = await modelPayload(page, viewer.url)
    expect(structuralSnapshot(afterSourceFence)).toEqual(
      structuralSnapshot(beforeSourceChange),
    )
    expect(afterSourceFence.testIoAudit).not.toHaveLength(0)
    expect(
      [...new Set(
        afterSourceFence.testIoAudit
          .filter(entry => entry.operation === 'watch')
          .map(entry => entry.path),
      )].sort(),
    ).toEqual(['groma/observed', 'groma/plans'])
    expect(
      afterSourceFence.testIoAudit.filter(entry => {
        return !/^groma\/(?:observed|plans)(?:\/|$)/.test(entry.path)
      }),
    ).toEqual([])
    expect(
      [...new Set(
        afterSourceFence.testIoAudit.map(entry => entry.operation),
      )].sort(),
    ).toEqual(['read-directory', 'read-file', 'watch'])

    await page.screenshot({
      path: testInfo.outputPath('release-gate-live-component.png'),
      fullPage: true,
    })
    const beforeRestart = structuralSnapshot(afterSourceFence)
    expect(beforeRestart.projections.context.level).toBe('context')
    expect(beforeRestart.projections.container.level).toBe('container')
    expect(beforeRestart.projections.component.level).toBe('component')
    for (const projection of Object.values(beforeRestart.projections)) {
      expect(projection.edges).not.toHaveLength(0)
      expect(
        projection.edges.flatMap(edge => {
          return edge.data.comparisonStatuses ?? []
        }),
      ).toContain('modification')
    }
    expect(
      beforeRestart.projections.container.nodes.find(node => {
        return node.data.elementId === 'viewer'
      }).data.comparisonStatus,
    ).toBe('addition')
    expect(
      beforeRestart.projections.component.nodes.find(node => {
        return node.data.elementId === 'live-gate'
      }).data.comparisonStatus,
    ).toBe('addition')
    const beforeRestartPid = viewer.child.pid
    expect(beforeRestartPid).toBeGreaterThan(0)
    await page.goto('about:blank')
    const preRestartShutdown = await stopViewer(viewer)
    expect(preRestartShutdown).toEqual({
      code: 0,
      escalated: false,
      signal: null,
    })
    viewer = undefined

    viewer = await startViewer(repositoryRoot, 'plan:02-live-viewer')
    const restartedPid = viewer.child.pid
    expect(restartedPid).toBeGreaterThan(0)
    expect(restartedPid).not.toBe(beforeRestartPid)
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
    try {
      if (viewer) {
        await page.goto('about:blank').catch(() => {})
        await stopViewer(viewer)
      }
    } finally {
      await chmod(sourceRoot, 0o755).catch(() => {})
      await rm(repositoryRoot, { recursive: true, force: true })
    }
  }
})
