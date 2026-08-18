import { watchArchitecture } from '../../architecture-watch.ts'
import { loadArchitectureViewModel } from '../../core.ts'
import { semanticView } from '../../semantic-view.ts'
import { watchScan } from '../../scanner.ts'
import { campusSvg } from './campus-svg.ts'
import { renderPage } from './page.ts'

const defaultPort = 4747

async function bundleRenderer(): Promise<string> {
  const build = await Bun.build({
    entrypoints: [new URL('./render.ts', import.meta.url).pathname],
    target: 'browser',
  })
  return build.outputs[0]!.text()
}

/** Starts the map server and returns its URL. */
export async function startWebViewer(
  repositoryRoot: string,
  options: { port?: number } = {},
): Promise<{ url: string; close: () => void }> {
  const renderer = await bundleRenderer()
  let viewModel = await loadArchitectureViewModel(repositoryRoot)
  let generation = 1
  const clients = new Set<ReadableStreamDefaultController<Uint8Array>>()
  const encoder = new TextEncoder()

  function worldEvent(): Uint8Array {
    return encoder.encode(
      `event: world\ndata: ${JSON.stringify({ generation, world: viewModel.world })}\n\n`,
    )
  }

  async function publishWorld(): Promise<void> {
    viewModel = await loadArchitectureViewModel(repositoryRoot)
    generation += 1
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

  const server = Bun.serve({
    port: options.port ?? defaultPort,
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
        return Response.json({ generation, world: viewModel.world })
      }
      if (pathname === '/context.svg') {
        viewModel = await loadArchitectureViewModel(repositoryRoot)
        return new Response(
          campusSvg(semanticView(viewModel.world, { level: 'context' })),
          {
            headers: {
              'Content-Type': 'image/svg+xml; charset=utf-8',
              'Cache-Control': 'no-store',
            },
          },
        )
      }
      if (pathname === '/containers.svg') {
        viewModel = await loadArchitectureViewModel(repositoryRoot)
        const wanted = new URL(request.url).searchParams.get('focus')
        const focus = viewModel.world.elements.find(element =>
          wanted
            ? element.id === wanted || element.representationId === wanted
            : element.kind === 'system' && !element.external,
        )
        return new Response(
          campusSvg(semanticView(viewModel.world, {
            level: 'containers',
            focusId: focus?.representationId,
          })),
          {
            headers: {
              'Content-Type': 'image/svg+xml; charset=utf-8',
              'Cache-Control': 'no-store',
            },
          },
        )
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
      viewModel = await loadArchitectureViewModel(repositoryRoot)
      return new Response(renderPage(viewModel.world, generation), {
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
