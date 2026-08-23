import { watchArchitecture } from '../../architecture-watch.ts'
import { createBacklogPlugin } from '../../backlog-plugin.ts'
import type { WorkSource } from '../../backlog-plugin.ts'
import { loadArchitectureViewModel } from '../../core.ts'
import { watchScan } from '../../scanner.ts'
import { sheetScene } from '../../sheet/scene.ts'
import { pinsOf } from '../../work-pins.ts'
import { renderPage } from './page.ts'
import type { WebPayload } from './payload.ts'

const defaultPort = 4747

async function bundleRenderer(): Promise<string> {
  const build = await Bun.build({
    entrypoints: [new URL('./render.ts', import.meta.url).pathname],
    target: 'browser',
  })
  return build.outputs[0]!.text()
}

/** The world with its sheet, the active tasks and their pins; a work source that cannot be read counts as no work, as the terminal viewer treats it. */
async function loadSheet(repositoryRoot: string, workSource: WorkSource): Promise<Omit<WebPayload, 'generation'>> {
  const [{ world }, work] = await Promise.all([
    loadArchitectureViewModel(repositoryRoot),
    workSource.read().catch(() => []),
  ])
  return { world, sheet: sheetScene(world), work, pins: pinsOf(work, world) }
}

/** Starts the map server and returns its URL. */
export async function startWebViewer(
  repositoryRoot: string,
  options: { port?: number; workSource?: WorkSource } = {},
): Promise<{ url: string; close: () => void }> {
  const renderer = await bundleRenderer()
  const workSource = options.workSource ?? createBacklogPlugin(repositoryRoot)
  /** Counts published worlds; a browser ignores anything older than what it applied. */
  let generation = 1
  let payload: WebPayload = { generation, ...(await loadSheet(repositoryRoot, workSource)) }
  const clients = new Set<ReadableStreamDefaultController<Uint8Array>>()
  const encoder = new TextEncoder()

  function worldEvent(): Uint8Array {
    return encoder.encode(`event: world\ndata: ${JSON.stringify(payload)}\n\n`)
  }

  async function publishWorld(): Promise<void> {
    const next = await loadSheet(repositoryRoot, workSource)
    generation += 1
    payload = { generation, ...next }
    const chunk = worldEvent()
    for (const client of clients) {
      try {
        client.enqueue(chunk)
      } catch {
        clients.delete(client)
      }
    }
  }

  const sourceWatch = watchScan(repositoryRoot, {
    onFold: publishWorld,
  })
  const architectureWatch = watchArchitecture(repositoryRoot, {
    onChange: publishWorld,
  })
  const workWatch = workSource.watch(() => {
    void publishWorld()
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
        return Response.json(payload)
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
      // Reload on every request so a browser refresh picks up architecture edits.
      payload = { generation, ...(await loadSheet(repositoryRoot, workSource)) }
      return new Response(renderPage(payload), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      })
    },
  })

  return {
    url: `http://localhost:${server.port}`,
    close() {
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
