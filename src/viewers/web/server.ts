import { watchArchitecture } from '../../architecture-watch.ts'
import { createBacklogPlugin, EMPTY_WORK_SNAPSHOT } from '../../work/backlog.ts'
import type { WorkSource } from '../../work/backlog.ts'
import { loadAnnotatedArchitecture } from '../../core.ts'
import { watchScan } from '../../scanner.ts'
import { sheetScene } from '../../sheet/scene.ts'
import { pinsOf } from '../../work/pins.ts'
import { renderPage } from './page.ts'
import type { WebMapPayload, WebPayload, WebWorkPayload } from './payload.ts'

const defaultPort = 4747

async function bundleRenderer(): Promise<string> {
  const build = await Bun.build({
    entrypoints: [new URL('./render.ts', import.meta.url).pathname],
    target: 'browser',
  })
  return build.outputs[0]!.text()
}

/** Loads the architecture map without consulting optional work plugins. */
async function loadMap(repositoryRoot: string): Promise<Omit<WebMapPayload, 'generation'>> {
  const { elements, relationships } = await loadAnnotatedArchitecture(repositoryRoot)
  const world = { elements, relationships }
  return { world, sheet: sheetScene(world) }
}

/** Starts the map server and returns its URL. */
export async function startWebViewer(
  repositoryRoot: string,
  options: { port?: number; workSource?: WorkSource } = {},
): Promise<{ url: string; close: () => void }> {
  const renderer = await bundleRenderer()
  const workSource = options.workSource ?? createBacklogPlugin(repositoryRoot)
  let map: WebMapPayload = {
    generation: 1,
    ...(await loadMap(repositoryRoot)),
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
    const next = await loadMap(repositoryRoot)
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
      const { pathname } = new URL(request.url)
      if (pathname === '/render.js') {
        return new Response(renderer, {
          headers: {
            'Content-Type': 'text/javascript; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        })
      }
      if (pathname === '/world.json') {
        return Response.json(payload())
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
      return new Response(renderPage(payload()), {
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
