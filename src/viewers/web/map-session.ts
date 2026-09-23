import { EMPTY_WORK_SNAPSHOT } from '@groma/work-source'
import type { WorkSource } from '@groma/work-source'
import { backlogPlugin } from '@groma/work-source-backlog'

import { watchArchitecture } from '../../architecture-watch.ts'
import { writes } from '../../authoring.ts'
import type { StructuralResult } from '../../curate.ts'
import { createScannerSession } from '../../scanner/session.ts'
import { parseScannerSettingsAction, withScannerUpgrades } from '../../scanner/modules/settings.ts'
import { pinsOf } from '../../work/pins.ts'
import { ownedFiles } from '../../history/comparison.ts'
import { readComparison } from '../../history/snapshots.ts'
import { measuredSheetScene } from '../../sheet/scene.ts'
import { listGitRevisions, withGitRevision } from '../../history/revisions.ts'
import { renderPage } from './page.ts'
import type { WebMapPayload, WebPayload, WebRevision, WebWorkPayload } from './payload.ts'
import { bundleRenderer, loadMapRoot } from './runtime.ts'
import { coverThemes, generateCovers, type CoverImages } from './sharing/images.ts'
import { coverFile } from './sharing/metadata.ts'
import { readSource } from '../source/read.ts'
import { readCodeStructure } from '../source/structure.ts'
import { readTaskDiff } from '../source/diff.ts'
import type { StartupProgress } from './startup/progress.ts'

async function structureResponse(
  repositoryRoot: string,
  selected: Pick<WebPayload, 'world' | 'revision'>,
  element: string,
): Promise<Response> {
  try {
    const structure = await readCodeStructure(repositoryRoot, selected.world, selected.revision?.id ?? null, element)
    return structure === undefined
      ? new Response('Component not found', { status: 404 })
      : Response.json(structure)
  } catch (error) {
    return new Response(error instanceof Error ? error.message : String(error), { status: 500 })
  }
}

async function sourceResponse(
  repositoryRoot: string,
  selected: Pick<WebPayload, 'world' | 'revision'>,
  element: string,
  file: string | null,
): Promise<Response> {
  if (file === null) return new Response('Source selection required', { status: 400 })
  try {
    const source = await readSource(repositoryRoot, selected.world, selected.revision?.id ?? null, element, file)
    return source === undefined
      ? new Response('Source file not found', { status: 404 })
      : Response.json(source)
  } catch {
    return new Response('Source file not found', { status: 404 })
  }
}

async function loadMap(
  repositoryRoot: string,
  revisions: WebRevision[],
  revision: WebRevision | null,
  onProgress?: (progress: StartupProgress) => void | Promise<void>,
): Promise<Omit<WebMapPayload, 'generation'>> {
  const snapshot = revision === null
    ? await loadMapRoot(repositoryRoot, phase => onProgress?.({ phase }))
    : await withGitRevision(repositoryRoot, revision.id, loadMapRoot)
  return { ...snapshot, revision, revisions }
}

/** Owns the ready map, its request handlers, and its live subscriptions. */
export async function createWebMapSession(
  repositoryRoot: string,
  options: { workSource?: WorkSource; scan?: boolean; onProgress?: (progress: StartupProgress) => void | Promise<void> } = {},
): Promise<{ fetch: (request: Request) => Promise<Response>; close: () => Promise<void> }> {
  options.onProgress?.({ phase: 'preparing-viewer' })
  const renderer = await bundleRenderer()
  const workSource = options.workSource ?? backlogPlugin.create(repositoryRoot)
  let revisions: WebRevision[] = []
  let revisionRead: Promise<WebRevision[]> | undefined
  let map: WebMapPayload
  const sourceFiles = new Set<string>()
  let workState: Omit<WebWorkPayload, 'pins'> = {
    workGeneration: 0,
    work: EMPTY_WORK_SNAPSHOT,
  }
  let closed = false
  let covers: Promise<CoverImages> | undefined
  const clients = new Set<ReadableStreamDefaultController<Uint8Array>>()
  const encoder = new TextEncoder()

  function workPayload(): WebWorkPayload {
    return {
      ...workState,
      pins: pinsOf(
        workState.work.items,
        map.world,
        workState.work.statuses.at(-1),
        workState.work.defaultStatus,
      ),
    }
  }

  function payload(): WebPayload {
    return { ...map, ...workPayload() }
  }

  /** History is read once when requested; opening the current map does not need snapshots. */
  function readRevisions(): Promise<WebRevision[]> {
    revisionRead ??= listGitRevisions(repositoryRoot).then(next => {
      revisions = next
      map = { ...map, revisions }
      return revisions
    })
    return revisionRead
  }

  async function payloadAt(revisionId: string | null): Promise<WebPayload | Response> {
    if (revisionId === null) return payload()
    const revision = (await readRevisions()).find(candidate => candidate.id === revisionId)
    if (revision === undefined) return new Response('Unknown Groma revision', { status: 404 })
    try {
      const snapshot = await loadMap(repositoryRoot, revisions, revision)
      if (snapshot.project === null) throw new Error('No Groma architecture in this commit')
      return {
        generation: map.generation,
        ...snapshot,
        workGeneration: workState.workGeneration,
        work: EMPTY_WORK_SNAPSHOT,
        pins: [],
      }
    } catch (error) {
      return new Response(`Cannot open this revision: ${error instanceof Error ? error.message : String(error)}`, { status: 422 })
    }
  }

  /** The two revisions a request compares; undefined for a request about one revision. */
  async function comparedPair(url: URL): Promise<[WebRevision | null, WebRevision | null] | Response | undefined> {
    const fromId = url.searchParams.get('from')
    if (fromId === null) return undefined
    const toId = url.searchParams.get('revision')
    const history = await readRevisions()
    const from = fromId === '' ? null : history.find(item => item.id === fromId)
    const to = toId === null ? null : history.find(item => item.id === toId)
    if (from === undefined || to === undefined) return new Response('Unknown revision', { status: 404 })
    if (from?.id === to?.id) return new Response('Choose two different revisions', { status: 400 })
    return [from, to]
  }

  async function payloadFor(url: URL): Promise<WebPayload | Response> {
    const pair = await comparedPair(url)
    if (pair === undefined) return payloadAt(url.searchParams.get('revision'))
    return pair instanceof Response ? pair : comparisonAt(...pair)
  }

  /** Both revisions' architecture and the changes between them, without laying out the map. */
  async function compare(from: WebRevision | null, to: WebRevision | null) {
    const compared = await readComparison(repositoryRoot, from, to)
    for (const component of Object.values(compared.comparison.components)) {
      for (const { file } of component.files) sourceFiles.add(file)
    }
    return compared
  }

  function comparisonError(error: unknown): Response {
    return new Response(`Cannot compare these revisions: ${error instanceof Error ? error.message : String(error)}`, { status: 422 })
  }

  async function comparisonAt(from: WebRevision | null, to: WebRevision | null): Promise<WebPayload | Response> {
    try {
      const started = performance.now()
      const compared = await compare(from, to)
      const loaded = performance.now()
      const sheet = measuredSheetScene(compared.world)
      return { ...compared, revision: to, revisions, generation: map.generation, sheet: sheet.scene,
        workGeneration: workState.workGeneration, work: EMPTY_WORK_SNAPSHOT, pins: [],
        timings: { architectureLoadMilliseconds: loaded - started, ...sheet.timings, totalMilliseconds: performance.now() - started } }
    } catch (error) {
      return comparisonError(error)
    }
  }

  /** What a code or source request reads; inside a comparison that is both revisions, never a new map layout. */
  async function selectionFor(url: URL): Promise<Pick<WebPayload, 'world' | 'revision' | 'comparison'> | Response> {
    const pair = await comparedPair(url)
    if (pair === undefined) return payloadAt(url.searchParams.get('revision'))
    if (pair instanceof Response) return pair
    try {
      const { world, comparison } = await compare(...pair)
      return { world, revision: pair[1], comparison }
    } catch (error) {
      return comparisonError(error)
    }
  }

  async function sourceSelection(url: URL): Promise<Response> {
    const selected = await selectionFor(url)
    if (selected instanceof Response) return selected
    const element = url.searchParams.get('element')
    if (element === null) return new Response('Component selection required', { status: 400 })
    const file = url.searchParams.get('file')
    const change = selected.comparison?.components[element]
    if (change !== undefined) {
      const useBefore = url.pathname === '/code.json' ? change.after === undefined
        : change.files.find(item => item.file === file)?.status === 'removed'
      if (useBefore) selected.revision = selected.comparison!.from
      selected.world = { ...selected.world, elements: selected.world.elements.map(item => item.id !== element ? item
        : { ...item, code: [...(change.after?.code ?? []), ...(change.before?.code ?? [])] }) }
    }
    return url.pathname === '/code.json'
      ? structureResponse(repositoryRoot, selected, element)
      : sourceResponse(repositoryRoot, selected, element, file)
  }

  function worldEvent(): Uint8Array {
    return encoder.encode(`event: world\ndata: ${JSON.stringify(payload())}\n\n`)
  }

  function workEvent(): Uint8Array {
    return encoder.encode(`event: work\ndata: ${JSON.stringify(workPayload())}\n\n`)
  }

  function broadcast(chunk: Uint8Array): void {
    for (const client of clients) {
      try {
        client.enqueue(chunk)
      } catch {
        clients.delete(client)
      }
    }
  }

  let worldChain = Promise.resolve()
  async function reloadWorld(): Promise<void> {
    if (closed) return
    const next = await loadMap(repositoryRoot, revisions, null, options.onProgress)
    if (closed) return
    map = {
      generation: map.generation + 1,
      ...next,
    }
    for (const file of ownedFiles(map.world)) sourceFiles.add(file)
    covers = undefined
    broadcast(worldEvent())
  }

  function publishWorld(): Promise<void> {
    const run = worldChain.then(reloadWorld)
    worldChain = run.catch(() => {})
    return run
  }

  let workChain = Promise.resolve()
  function publishWork(): void {
    workChain = workChain.then(async () => {
      const work = await workSource.read().catch(() => EMPTY_WORK_SNAPSHOT)
      if (closed) return
      workState = {
        workGeneration: workState.workGeneration + 1,
        work,
      }
      broadcast(workEvent())
    })
  }

  let initialScan = true
  const scannerSession = await createScannerSession(repositoryRoot, {
    scan: options.scan,
    watchesFile: file => sourceFiles.has(file),
    onProgress: options.onProgress,
    onFold: () => initialScan ? undefined : publishWorld(),
    onSettings: settings => broadcast(encoder.encode(`event: scanners\ndata: ${JSON.stringify(settings)}\n\n`)),
  })
  await scannerSession.ready
  // Initial folds are included in this map; later folds queue behind its load.
  worldChain = loadMap(repositoryRoot, revisions, null, options.onProgress).then(next => {
    map = { generation: 1, ...next }
    for (const file of ownedFiles(map.world)) sourceFiles.add(file)
  })
  initialScan = false
  try {
    await worldChain
  } catch (error) {
    closed = true
    await scannerSession.close()
    throw error
  }
  options.onProgress?.({ phase: 'opening-map' })
  const architectureWatch = await watchArchitecture(repositoryRoot, {
    onChange: async () => { await scannerSession.reconfigure(); await publishWorld() },
  })
  const workWatch = workSource.watch(() => {
    void publishWork()
  })

  type Route = (request: Request, url: URL) => Response | Promise<Response>

  function rendererResponse(): Response {
    return new Response(renderer, {
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }

  async function worldResponse(_request: Request, url: URL): Promise<Response> {
    const selected = await payloadFor(url)
    return selected instanceof Response ? selected : Response.json(selected)
  }

  function selectedSourceResponse(_request: Request, url: URL): Promise<Response> {
    return sourceSelection(url)
  }

  async function taskDiffResponse(_request: Request, url: URL): Promise<Response> {
    const taskId = url.searchParams.get('task')
    const item = workState.work.items.find(candidate => candidate.id === taskId)
    if (item === undefined) return new Response('Task not found', { status: 404 })
    try {
      return Response.json(await readTaskDiff(repositoryRoot, item, workState.work))
    } catch (error) {
      return new Response(error instanceof Error ? error.message : String(error), { status: 404 })
    }
  }

  async function taskResponse(_request: Request, url: URL): Promise<Response> {
    const taskId = url.searchParams.get('task')
    const item = workState.work.items.find(candidate => candidate.id === taskId)
    if (item === undefined) return new Response('Task not found', { status: 404 })
    try {
      return Response.json(await workSource.readItem(item.id))
    } catch (error) {
      return new Response(error instanceof Error ? error.message : String(error), { status: 404 })
    }
  }

  /** Publish the world, then return the touched id and any structural facts; failures return the core sentence and 400. */
  async function writeResponse<Input>(
    request: Request,
    write: (repositoryRoot: string, input: Input) => Promise<string | StructuralResult>,
  ): Promise<Response> {
    try {
      const input = await request.json() as Input
      const run = worldChain.then(async () => {
        const result = await write(repositoryRoot, input)
        await reloadWorld()
        return Response.json(typeof result === 'string' ? { id: result } : result)
      })
      worldChain = run.then(() => {}, () => {})
      return await run
    } catch (error) {
      return new Response(error instanceof Error ? error.message : String(error), { status: 400 })
    }
  }

  function eventsResponse(): Response {
    let controller: ReadableStreamDefaultController<Uint8Array>
    const stream = new ReadableStream<Uint8Array>({
      start(next) {
        controller = next
        clients.add(next)
        next.enqueue(worldEvent())
      },
      cancel() {
        clients.delete(controller)
      },
    })
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  async function pageResponse(url: URL): Promise<Response> {
    const selected = await payloadFor(url)
    if (selected instanceof Response) return selected
    return new Response(renderPage({ ...selected, delivery: { kind: 'live' } }, url), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }

  const routes = new Map<string, Route>([
    ['/scanner-settings', async (_request, url) => {
      const settings = await scannerSession.refresh()
      return Response.json(url.searchParams.has('updates') ? await withScannerUpgrades(settings) : settings)
    }],
    ['/render.js', rendererResponse],
    ['/revisions.json', async () => Response.json(await readRevisions())],
    ['/world.json', worldResponse],
    ['/code.json', selectedSourceResponse],
    ['/source.json', selectedSourceResponse],
    ['/task.json', taskResponse],
    ['/task-diff.json', taskDiffResponse],
    ['/events', eventsResponse],
  ])

  for (const theme of coverThemes) routes.set(`/${coverFile(theme)}`, async () => {
    covers ??= generateCovers(map)
    return new Response((await covers)[theme], { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } })
  })

  /** The shared writes at the path of their verb; each posts the input the CLI builds from its flags. */
  const writeRoutes = new Map<string, (request: Request) => Promise<Response>>([
    ['/scanner-settings', async request => {
      try { await scannerSession.change(parseScannerSettingsAction(await request.json())); return Response.json(scannerSession.state) }
      catch (error) { return new Response(error instanceof Error ? error.message : String(error), { status: 400 }) }
    }],
    ['/draft', request => writeResponse(request, writes.draft)],
    ['/add', request => writeResponse(request, writes.add)],
    ['/edit', request => writeResponse(request, writes.edit)],
    ['/remove', request => writeResponse(request, writes.remove)],
    ['/accept', request => writeResponse(request, writes.accept)],
  ])

  async function responseFor(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const write = request.method === 'POST' ? writeRoutes.get(url.pathname) : undefined
    if (write !== undefined) return write(request)
    const route = routes.get(url.pathname)
    return route === undefined ? pageResponse(url) : route(request, url)
  }

  publishWork()

  return {
    fetch: responseFor,
    async close() {
      closed = true
      for (const client of clients) {
        try {
          client.close()
        } catch {
          // already closed
        }
      }
      clients.clear()
      await Promise.all([
        workWatch.close(),
        scannerSession?.close(),
        architectureWatch.close(),
        worldChain,
        workChain,
        revisionRead,
        covers,
      ])
    },
  }
}
