import { mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { EMPTY_WORK_SNAPSHOT } from '@groma/work-source'
import { watchArchitecture } from '../../architecture-watch.ts'
import { compareArchitecture, ownedFiles, type SourceTexts } from '../../history/comparison.ts'
import { olderFirst, readGitRevision, type GitRevision } from '../../history/revisions.ts'
import { atRevision, readSourceTexts } from '../../history/snapshots.ts'
import { measuredSheetScene } from '../../sheet/scene.ts'
import { readSnapshotCodeStructure } from '../source/structure.ts'
import { renderPage } from './page.ts'
import { PUBLISHED_EVENT, PUBLISHED_VERSION_EVENT } from './payload.ts'
import type { PublishedView, WebBootPayload } from './payload.ts'
import { bundleRenderer, loadMapRoot } from './runtime.ts'
import { coverThemes, generateCovers } from './sharing/images.ts'
import { coverFile } from './sharing/metadata.ts'

export interface WebExportHandle {
  readonly closed: Promise<void>
  close(): Promise<void>
}

export interface WebExportOptions {
  url?: string
  revision?: string
  from?: string
  watch?: boolean
  onError?: (error: unknown) => void
}

function emptyWork(generation: number) {
  return { workGeneration: generation, work: EMPTY_WORK_SNAPSHOT, pins: [] }
}

async function snapshotView(repositoryRoot: string, root: string, revision: GitRevision | null, revisions: GitRevision[],
  generation: number, map: Awaited<ReturnType<typeof loadMapRoot>>, files: string[]): Promise<PublishedView> {
  if (map.project === null) throw new Error('No Groma architecture in this snapshot')
  const code: PublishedView['reads']['code'] = []
  for (const element of map.world.elements) {
    if (element.kind !== 'component') continue
    code.push({ element: element.representationId,
      files: await readSnapshotCodeStructure(repositoryRoot, root, map.world, element.representationId) ?? [] })
  }
  const texts = await readSourceTexts(root, files)
  return {
    payload: { generation, ...map, revision, revisions, ...emptyWork(generation) },
    reads: { code, sources: Object.entries(texts).flatMap(([file, source]) => source === undefined ? [] : [{ file, source: { source } }]) },
  }
}

function sourceTexts(view: PublishedView): SourceTexts {
  return Object.fromEntries(view.reads.sources.map(item => [item.file, item.source.source]))
}

function comparisonView(before: PublishedView, after: PublishedView): PublishedView {
  const started = performance.now()
  const compared = compareArchitecture(before.payload.world, after.payload.world, sourceTexts(before), sourceTexts(after))
  const sheet = measuredSheetScene(compared.world)
  // Changed files use comparison hunks; ordinary source reads use B, or A for removed files.
  const sources = new Map([...before.reads.sources, ...after.reads.sources].map(item => [item.file, item]))
  return {
    payload: { ...after.payload, world: compared.world, sheet: sheet.scene,
      comparison: { from: before.payload.revision, components: compared.components, relationships: compared.relationships },
      timings: { architectureLoadMilliseconds: 0, ...sheet.timings, totalMilliseconds: performance.now() - started } },
    reads: { code: [], sources: [...sources.values()] },
  }
}

/** Materialize existing viewer reads while the requested roots are available; no Git reaches the browser. */
async function publishedSnapshot(root: string, revisions: GitRevision[], generation: number): Promise<WebBootPayload> {
  const to = revisions.at(-1) ?? null
  const from = revisions.length === 2 ? revisions[0]! : undefined
  return atRevision(root, to, async afterRoot => {
    const afterMap = await loadMapRoot(afterRoot)
    if (from === undefined) {
      const view = await snapshotView(root, afterRoot, to, revisions, generation, afterMap, ownedFiles(afterMap.world))
      return { ...view.payload, delivery: { kind: 'published', views: [view] } }
    }
    return atRevision(root, from, async beforeRoot => {
      const beforeMap = await loadMapRoot(beforeRoot)
      const files = [...new Set([...ownedFiles(beforeMap.world), ...ownedFiles(afterMap.world)])]
      // The time machine lists the commits newest first, as it does live.
      const history = [...revisions].reverse()
      const [before, after] = await Promise.all([
        snapshotView(root, beforeRoot, from, history, generation, beforeMap, files),
        snapshotView(root, afterRoot, to, history, generation, afterMap, files),
      ])
      // One comparison, from the older commit to the newer; closing it opens either commit on its own.
      const comparison = comparisonView(before, after)
      return { ...comparison.payload, delivery: { kind: 'published', views: [before, after, comparison] } }
    })
  })
}

async function exportRevisions(root: string, options: WebExportOptions): Promise<GitRevision[]> {
  if (options.from !== undefined && options.revision === undefined) throw new Error('--from requires --revision; comparison exports need two commits')
  if (options.revision === undefined) return []
  const to = await readGitRevision(root, options.revision)
  if (options.from === undefined) return [to]
  const from = await readGitRevision(root, options.from)
  if (from.id === to.id) throw new Error('Choose two different commits')
  // A comparison always runs from the older commit to the newer one, whichever order the options name.
  return olderFirst(root, from, to)
}

async function replaceFile(filename: string, contents: string | Uint8Array): Promise<void> {
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

/** Writes the normal viewer as one static snapshot or two commits with comparison views. */
export async function exportWebViewer(
  repositoryRoot: string,
  outputDirectory: string,
  options: WebExportOptions = {},
): Promise<WebExportHandle> {
  const revisions = await exportRevisions(repositoryRoot, options)
  const url = options.url === undefined ? undefined : new URL(options.url)
  if (url !== undefined && !url.pathname.endsWith('/')) url.pathname += '/'
  const output = path.resolve(outputDirectory)
  const renderer = await bundleRenderer()
  await mkdir(output, { recursive: true })
  await replaceFile(path.join(output, 'render.js'), renderer)

  let generation = Date.now()
  let closed = false
  let closePromise: () => void = () => {}
  const finished = new Promise<void>(resolve => { closePromise = resolve })

  async function publish(): Promise<void> {
    const snapshot = await publishedSnapshot(repositoryRoot, revisions, ++generation)
    if (closed) return
    const covers = await generateCovers(snapshot)
    for (const theme of coverThemes) await replaceFile(path.join(output, coverFile(theme)), covers[theme])
    await replaceFile(path.join(output, 'snapshot.js'), snapshotScript(snapshot))
    await replaceFile(path.join(output, 'index.html'), renderPage(snapshot, url))
    await replaceFile(path.join(output, 'version.js'), versionScript(snapshot.generation))
  }

  await publish()
  let chain = Promise.resolve()
  function schedule(): void {
    chain = chain.then(publish).catch(error => { options.onError?.(error) })
  }
  const watch = options.watch && revisions.length === 0
    ? await watchArchitecture(repositoryRoot, { onChange: schedule }) : undefined
  return {
    closed: finished,
    async close() {
      if (closed) return
      closed = true
      await Promise.all([watch?.close(), chain])
      closePromise()
    },
  }
}
