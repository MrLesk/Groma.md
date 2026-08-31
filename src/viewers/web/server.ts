import { watchArchitecture } from '../../architecture-watch.ts'
import { loadArchitecture } from '../../architecture-reader.ts'
import { listGitRevisions, withGitGromaRevision, withGitRevision } from '../../history/git.ts'
import { createBacklogPlugin, EMPTY_WORK_SNAPSHOT } from '../../work/backlog.ts'
import type { WorkSource } from '../../work/backlog.ts'
import { annotateArchitecture } from '../../core.ts'
import { saveProjectProfile } from '../../project-profile.ts'
import { watchScan } from '../../scanner.ts'
import { pinsOf } from '../../work/pins.ts'
import { renderPage } from './page.ts'
import type { WebMapPayload, WebPayload, WebRevision, WebWorkPayload } from './payload.ts'
import { bundleRenderer, loadMapRoot } from './runtime.ts'
import { readSource } from './source/read.ts'
import { readCodeStructure } from './source/structure.ts'
import { readTaskDiff } from './task-diff/read.ts'

const defaultPort = 4747

async function structureResponse(
  repositoryRoot: string,
  selected: WebPayload,
  element: string,
): Promise<Response> {
  try {
    const structure = await readCodeStructure(repositoryRoot, selected.world, selected.revision, element)
    return structure === undefined
      ? new Response('Component not found', { status: 404 })
      : Response.json(structure)
  } catch (error) {
    return new Response(error instanceof Error ? error.message : String(error), { status: 500 })
  }
}

async function sourceResponse(
  repositoryRoot: string,
  selected: WebPayload,
  element: string,
  file: string | null,
): Promise<Response> {
  if (file === null) return new Response('Source selection required', { status: 400 })
  try {
    const source = await readSource(repositoryRoot, selected.world, selected.revision, element, file)
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
): Promise<Omit<WebMapPayload, 'generation'>> {
  const snapshot = revision === null
    ? await loadMapRoot(repositoryRoot)
    : await withGitRevision(repositoryRoot, revision.id, loadMapRoot)
  return { ...snapshot, revision, revisions }
}

async function revisionHistory(repositoryRoot: string): Promise<WebRevision[]> {
  return Promise.all((await listGitRevisions(repositoryRoot)).map(async revision => ({
    ...revision,
    compatible: await withGitGromaRevision(repositoryRoot, revision.id, async snapshotRoot => {
      try {
        annotateArchitecture(await loadArchitecture(snapshotRoot))
        return true
      } catch {
        return false
      }
    }),
  })))
}

/** Starts the map server and returns its URL. */
export async function startWebViewer(
  repositoryRoot: string,
  options: { port?: number; workSource?: WorkSource } = {},
): Promise<{ url: string; close: () => void }> {
  const renderer = await bundleRenderer()
  const workSource = options.workSource ?? createBacklogPlugin(repositoryRoot)
  const revisions = await revisionHistory(repositoryRoot)
  let map: WebMapPayload = {
    generation: 1,
    ...(await loadMap(repositoryRoot, revisions, null)),
  }
  let workState: Omit<WebWorkPayload, 'pins'> = {
    workGeneration: 0,
    work: EMPTY_WORK_SNAPSHOT,
  }
  let closed = false
  const clients = new Set<ReadableStreamDefaultController<Uint8Array>>()
  const encoder = new TextEncoder()

  function workPayload(): WebWorkPayload {
    return {
      ...workState,
      pins: pinsOf(workState.work.items, map.world, workState.work.statuses.at(-1)),
    }
  }

  function payload(): WebPayload {
    return { ...map, ...workPayload() }
  }

  async function payloadAt(revisionId: string | null): Promise<WebPayload | Response> {
    if (revisionId === null) return payload()
    const revision = revisions.find(candidate => candidate.id === revisionId)
    if (revision === undefined) return new Response('Unknown Groma revision', { status: 404 })
    if (!revision.compatible) return new Response('Unsupported Groma revision', { status: 422 })
    return {
      generation: map.generation,
      ...(await loadMap(repositoryRoot, revisions, revision)),
      workGeneration: workState.workGeneration,
      work: EMPTY_WORK_SNAPSHOT,
      pins: [],
    }
  }

  async function sourceSelection(url: URL): Promise<Response> {
    const selected = await payloadAt(url.searchParams.get('revision'))
    if (selected instanceof Response) return selected
    const element = url.searchParams.get('element')
    if (element === null) return new Response('Component selection required', { status: 400 })
    return url.pathname === '/code.json'
      ? structureResponse(repositoryRoot, selected, element)
      : sourceResponse(repositoryRoot, selected, element, url.searchParams.get('file'))
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

  async function publishWorld(): Promise<void> {
    const next = await loadMap(repositoryRoot, revisions, null)
    if (closed) return
    map = {
      generation: map.generation + 1,
      ...next,
    }
    broadcast(worldEvent())
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

  const sourceWatch = await watchScan(repositoryRoot, {
    onFold: publishWorld,
  })
  const architectureWatch = watchArchitecture(repositoryRoot, {
    onChange: publishWorld,
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
    const selected = await payloadAt(url.searchParams.get('revision'))
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

  async function projectResponse(request: Request): Promise<Response> {
    try {
      const profile = await saveProjectProfile(repositoryRoot, await request.json())
      map = { ...map, generation: map.generation + 1, project: profile }
      broadcast(worldEvent())
      return Response.json(profile)
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
    const selected = await payloadAt(url.searchParams.get('revision'))
    if (selected instanceof Response) return selected
    return new Response(renderPage({ ...selected, delivery: { kind: 'live' } }), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }

  const routes = new Map<string, Route>([
    ['/render.js', rendererResponse],
    ['/world.json', worldResponse],
    ['/code.json', selectedSourceResponse],
    ['/source.json', selectedSourceResponse],
    ['/task.json', taskResponse],
    ['/task-diff.json', taskDiffResponse],
    ['/events', eventsResponse],
  ])

  async function responseFor(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/project' && request.method === 'PUT') return projectResponse(request)
    const route = routes.get(url.pathname)
    return route === undefined ? pageResponse(url) : route(request, url)
  }

  const server = Bun.serve({
    port: options.port ?? defaultPort,
    // The event stream stays open while nothing changes; Bun's default closes it after ten idle seconds.
    idleTimeout: 0,
    fetch: responseFor,
  })
  publishWork()

  return {
    url: `http://localhost:${server.port}`,
    close() {
      closed = true
      sourceWatch.close()
      architectureWatch.close()
      workWatch.close()
      for (const client of clients) {
        try {
          client.close()
        } catch {
          // already closed
        }
      }
      clients.clear()
      server.stop(true)
    },
  }
}
