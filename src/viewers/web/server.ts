import { watchArchitecture } from '../../architecture-watch.ts'
import { loadArchitecture } from '../../architecture-reader.ts'
import { listGitRevisions, withGitGromaRevision, withGitRevision } from '../../history/git.ts'
import { createBacklogPlugin, EMPTY_WORK_SNAPSHOT } from '../../work/backlog.ts'
import type { WorkSource } from '../../work/backlog.ts'
import { annotateArchitecture, loadAnnotatedArchitecture } from '../../core.ts'
import { loadProjectProfile, saveProjectProfile } from '../../project-profile.ts'
import { watchScan } from '../../scanner.ts'
import { sheetScene } from '../../sheet/scene.ts'
import { pinsOf } from '../../work/pins.ts'
import { renderPage } from './page.ts'
import type { WebMapPayload, WebPayload, WebRevision, WebWorkPayload } from './payload.ts'
import { readSource } from './source/read.ts'
import { readTaskDiff } from './task-diff/read.ts'

const defaultPort = 4747

async function bundleRenderer(): Promise<string> {
  const build = await Bun.build({
    entrypoints: [new URL('./render.ts', import.meta.url).pathname],
    target: 'browser',
  })
  return build.outputs[0]!.text()
}

/** Loads the architecture map without consulting optional work plugins. */
async function loadMapRoot(repositoryRoot: string): Promise<Pick<WebMapPayload, 'project' | 'world' | 'sheet'>> {
  const [{ elements, relationships }, project] = await Promise.all([
    loadAnnotatedArchitecture(repositoryRoot),
    loadProjectProfile(repositoryRoot),
  ])
  const world = { elements, relationships }
  return { project: project ?? null, world, sheet: sheetScene(world) }
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

  const sourceWatch = watchScan(repositoryRoot, {
    onFold: publishWorld,
  })
  const architectureWatch = watchArchitecture(repositoryRoot, {
    onChange: publishWorld,
  })
  const workWatch = workSource.watch(() => {
    void publishWork()
  })

  const server = Bun.serve({
    port: options.port ?? defaultPort,
    // The event stream stays open while nothing changes; Bun's default closes it after ten idle seconds.
    idleTimeout: 0,
    fetch: async request => {
      const url = new URL(request.url)
      const { pathname } = url
      if (pathname === '/render.js') {
        return new Response(renderer, {
          headers: {
            'Content-Type': 'text/javascript; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        })
      }
      if (pathname === '/world.json') {
        const selected = await payloadAt(url.searchParams.get('revision'))
        return selected instanceof Response ? selected : Response.json(selected)
      }
      if (pathname === '/source.json') {
        const selected = await payloadAt(url.searchParams.get('revision'))
        if (selected instanceof Response) return selected
        const element = url.searchParams.get('element')
        const file = url.searchParams.get('file')
        if (element === null || file === null) return new Response('Source selection required', { status: 400 })
        try {
          const source = await readSource(repositoryRoot, selected.world, selected.revision, element, file)
          return source === undefined
            ? new Response('Source file not found', { status: 404 })
            : Response.json(source)
        } catch {
          return new Response('Source file not found', { status: 404 })
        }
      }
      if (pathname === '/task-diff.json') {
        const taskId = url.searchParams.get('task')
        const item = workState.work.items.find(candidate => candidate.id === taskId)
        if (item === undefined) return new Response('Task not found', { status: 404 })
        try {
          return Response.json(await readTaskDiff(repositoryRoot, item, workState.work))
        } catch (error) {
          return new Response(error instanceof Error ? error.message : String(error), { status: 404 })
        }
      }
      if (pathname === '/project' && request.method === 'PUT') {
        try {
          const profile = await saveProjectProfile(repositoryRoot, await request.json())
          map = { ...map, generation: map.generation + 1, project: profile }
          broadcast(worldEvent())
          return Response.json(profile)
        } catch (error) {
          return new Response(error instanceof Error ? error.message : String(error), { status: 400 })
        }
      }
      if (pathname === '/events') {
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
      const selected = await payloadAt(url.searchParams.get('revision'))
      if (selected instanceof Response) return selected
      return new Response(renderPage(selected), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      })
    },
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
