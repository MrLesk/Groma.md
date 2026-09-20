import type { ScannerProgress } from '../../../scanner/session.ts'
import { scannerName } from '../scanners/name.ts'

/** Startup belongs to the web host; scanner and map operations only report their work. */
export const startupPhases = {
  'creating-project': { label: 'Creating project', milestone: 0 },
  'finding-scanners': { label: 'Finding scanners', milestone: 1 },
  'installing-scanners': { label: 'Installing scanners', milestone: 1 },
  'preparing-viewer': { label: 'Preparing viewer', milestone: 2 },
  'loading-architecture': { label: 'Loading architecture', milestone: 2 },
  'preparing-map': { label: 'Preparing map', milestone: 2 },
  'preparing-scanners': { label: 'Preparing scanners', milestone: 2 },
  scanning: { label: 'Scanning', milestone: 2 },
  'updating-architecture': { label: 'Updating architecture', milestone: 2 },
  'opening-map': { label: 'Opening map', milestone: 3 },
} as const

export type StartupPhase = keyof typeof startupPhases
export type StartupProgress = ScannerProgress | { phase: Exclude<StartupPhase, ScannerProgress['phase']> }

export function startupUpdate(progress: StartupProgress) {
  return {
    ...progress,
    ...startupPhases[progress.phase],
    scannerNames: progress.phase === 'scanning' ? progress.scanners.map(scannerName) : [],
  }
}

/** Sends the current work immediately, then actual changes until the page leaves. */
export function createStartupProgress() {
  let current: StartupProgress | undefined
  const clients = new Set<ReadableStreamDefaultController<Uint8Array>>()
  const encoder = new TextEncoder()
  const event = (next: StartupProgress) => encoder.encode(`data: ${JSON.stringify(startupUpdate(next))}\n\n`)

  return {
    get current() { return current },
    clear() { current = undefined },
    report(next: StartupProgress) {
      current = next
      for (const client of clients) client.enqueue(event(next))
    },
    response(): Response {
      let client: ReadableStreamDefaultController<Uint8Array>
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          client = controller
          clients.add(client)
          if (current !== undefined) client.enqueue(event(current))
        },
        cancel() { clients.delete(client) },
      })
      return new Response(stream, { headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      } })
    },
    close() {
      for (const client of clients) client.close()
      clients.clear()
    },
  }
}
