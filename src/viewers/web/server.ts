import { loadArchitectureViewModel } from '../../core.ts'
import { renderPage } from './page.ts'

const port = 4747

async function bundleRenderer(): Promise<string> {
  const build = await Bun.build({
    entrypoints: [new URL('./render.ts', import.meta.url).pathname],
    target: 'browser',
  })
  return build.outputs[0]!.text()
}

/** Starts the map server and returns its URL. */
export async function startWebViewer(repositoryRoot: string): Promise<string> {
  const renderer = await bundleRenderer()
  const server = Bun.serve({
    port,
    fetch: async request => {
      if (new URL(request.url).pathname === '/render.js') {
        return new Response(renderer, {
          headers: { 'Content-Type': 'text/javascript; charset=utf-8' },
        })
      }
      // Reload on every request so a browser refresh picks up architecture edits.
      const viewModel = await loadArchitectureViewModel(repositoryRoot)
      return new Response(renderPage(viewModel.world), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    },
  })
  return `http://localhost:${server.port}`
}
