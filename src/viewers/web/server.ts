import { loadArchitectureViewModel } from '../../core.ts'
import { renderPage } from './page.ts'

const port = 4747

/** Starts the map server and returns its URL. */
export function startWebViewer(repositoryRoot: string): string {
  const server = Bun.serve({
    port,
    fetch: async () => {
      // Reload on every request so a browser refresh picks up architecture edits.
      const viewModel = await loadArchitectureViewModel(repositoryRoot)
      return new Response(renderPage(viewModel.world), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    },
  })
  return `http://localhost:${server.port}`
}
