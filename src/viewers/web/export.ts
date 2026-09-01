import { existsSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { EMPTY_WORK_SOURCE } from '@groma/work-source'
import type { WorkSource } from '@groma/work-source'
import { backlogPlugin } from '@groma/work-source-backlog'

import { watchArchitecture } from '../../architecture-watch.ts'
import { watchScan } from '../../scanner.ts'
import { pinsOf } from '../../work/pins.ts'
import { renderPage } from './page.ts'
import { PUBLISHED_EVENT, PUBLISHED_VERSION_EVENT } from './payload.ts'
import type { PublishedReads, WebBootPayload, WebPayload } from './payload.ts'
import { bundleRenderer, loadMapRoot } from './runtime.ts'
import { readSource } from './source/read.ts'
import { readCodeStructure } from './source/structure.ts'
import { readTaskDiff } from './task-diff/read.ts'

export interface WebExportHandle {
  readonly closed: Promise<void>
  close(): void
}

function availableWorkSource(repositoryRoot: string): WorkSource {
  return existsSync(path.join(repositoryRoot, 'backlog'))
    ? backlogPlugin.create(repositoryRoot)
    : EMPTY_WORK_SOURCE
}

async function publishedTaskDiff(repositoryRoot: string, item: WebPayload['work']['items'][number], work: WebPayload['work']) {
  try {
    return { id: item.id, diff: await readTaskDiff(repositoryRoot, item, work) }
  } catch (error) {
    return { id: item.id, error: error instanceof Error ? error.message : String(error) }
  }
}

async function publishedReads(
  repositoryRoot: string,
  payload: WebPayload,
  workSource: WorkSource,
): Promise<PublishedReads> {
  const code: PublishedReads['code'] = []
  const sources: PublishedReads['sources'] = []
  for (const element of payload.world.elements) {
    if (element.kind !== 'component') continue
    const files = await readCodeStructure(
      repositoryRoot,
      payload.world,
      null,
      element.representationId,
    )
    code.push({ element: element.representationId, files: files ?? [] })
    for (const file of new Set(element.code.map(reference => reference.file))) {
      const source = await readSource(repositoryRoot, payload.world, null, element.representationId, file)
      if (source === undefined) throw new Error(`Source file not found: ${file}`)
      sources.push({
        element: element.representationId,
        file,
        source,
      })
    }
  }
  const tasks = await Promise.all(payload.work.items.map(async item => ({
    id: item.id,
    details: await workSource.readItem(item.id),
  })))
  const taskDiffs = await Promise.all(payload.work.items.map(item => {
    return publishedTaskDiff(repositoryRoot, item, payload.work)
  }))
  return { code, sources, tasks, taskDiffs }
}

async function publishedSnapshot(
  repositoryRoot: string,
  workSource: WorkSource,
  generation: number,
): Promise<WebBootPayload> {
  const [map, work] = await Promise.all([
    loadMapRoot(repositoryRoot),
    workSource.read(),
  ])
  const payload: WebPayload = {
    generation,
    ...map,
    revision: null,
    revisions: [],
    workGeneration: generation,
    work,
    pins: pinsOf(work.items, map.world, work.statuses.at(-1)),
  }
  return {
    ...payload,
    delivery: {
      kind: 'published',
      reads: await publishedReads(repositoryRoot, payload, workSource),
    },
  }
}

async function replaceFile(filename: string, contents: string): Promise<void> {
  const temporary = `${filename}.${process.pid}.tmp`
  await writeFile(temporary, contents)
  await rename(temporary, filename)
}

function snapshotScript(payload: WebBootPayload): string {
  return `globalThis.dispatchEvent(new CustomEvent(${JSON.stringify(PUBLISHED_EVENT)}, { detail: ${JSON.stringify(payload)} }));\n`
}

function versionScript(generation: number): string {
  return `globalThis.dispatchEvent(new CustomEvent(${JSON.stringify(PUBLISHED_VERSION_EVENT)}, { detail: ${generation} }));\n`
}

/** Writes the read-only Web viewer and optionally keeps its static snapshot current. */
export async function exportWebViewer(
  repositoryRoot: string,
  outputDirectory: string,
  options: { watch?: boolean; workSource?: WorkSource; onError?: (error: unknown) => void } = {},
): Promise<WebExportHandle> {
  const output = path.resolve(outputDirectory)
  const workSource = options.workSource ?? availableWorkSource(repositoryRoot)
  const renderer = await bundleRenderer()
  await mkdir(output, { recursive: true })
  await replaceFile(path.join(output, 'render.js'), renderer)

  let generation = Date.now()
  let closed = false
  let closePromise: () => void = () => {}
  const finished = new Promise<void>(resolve => {
    closePromise = resolve
  })

  async function publish(): Promise<void> {
    const snapshot = await publishedSnapshot(repositoryRoot, workSource, ++generation)
    if (closed) return
    await replaceFile(path.join(output, 'snapshot.js'), snapshotScript(snapshot))
    await replaceFile(path.join(output, 'index.html'), renderPage(snapshot))
    await replaceFile(path.join(output, 'version.js'), versionScript(snapshot.generation))
  }

  await publish()
  let chain = Promise.resolve()
  function schedule(): void {
    chain = chain.then(publish).catch(error => {
      options.onError?.(error)
    })
  }

  const sourceWatch = options.watch ? await watchScan(repositoryRoot, {
    onFold: schedule,
    onError: options.onError,
  }) : undefined
  const architectureWatch = options.watch ? watchArchitecture(repositoryRoot, { onChange: schedule }) : undefined
  const workWatch = options.watch ? workSource.watch(schedule) : undefined

  return {
    closed: finished,
    close() {
      if (closed) return
      closed = true
      sourceWatch?.close()
      architectureWatch?.close()
      workWatch?.close()
      closePromise()
    },
  }
}
