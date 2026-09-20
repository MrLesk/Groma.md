/** Startup belongs to the web host; scanner and map operations only report their work. */
export const startupPhases = {
  'creating-project': { label: 'Creating project', milestone: 0 },
  'finding-scanners': { label: 'Finding scanners', milestone: 1 },
  'installing-scanners': { label: 'Installing scanners', milestone: 1 },
  'preparing-viewer': { label: 'Preparing viewer', milestone: 2 },
  'loading-architecture': { label: 'Loading architecture', milestone: 2 },
  'preparing-map': { label: 'Preparing map', milestone: 2 },
  'preparing-scanners': { label: 'Preparing scanners', milestone: 2 },
  scanning: { label: 'Scanning code', milestone: 2 },
  'updating-architecture': { label: 'Updating architecture', milestone: 2 },
  'opening-map': { label: 'Opening map', milestone: 3 },
} as const

export type StartupPhase = keyof typeof startupPhases

export function startupUpdate(phase: StartupPhase) {
  return { phase, ...startupPhases[phase] }
}

/** Sends the current phase immediately, then actual phase changes until the page leaves. */
export function createStartupProgress() {
  let phase: StartupPhase | undefined
  const clients = new Set<ReadableStreamDefaultController<Uint8Array>>()
  const encoder = new TextEncoder()
  const event = (next: StartupPhase) => encoder.encode(`data: ${JSON.stringify(startupUpdate(next))}\n\n`)

  return {
    get phase() { return phase },
    clear() { phase = undefined },
    report(next: StartupPhase) {
      phase = next
      for (const client of clients) client.enqueue(event(next))
    },
    response(): Response {
      let client: ReadableStreamDefaultController<Uint8Array>
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          client = controller
          clients.add(client)
          if (phase !== undefined) client.enqueue(event(phase))
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
