import path from 'node:path'
import type { WorkSource } from '@groma/work-source'

import { initializeGroma, gromaInitialization } from '../../initialize.ts'
import { loadProjectProfile } from '../../project-profile.ts'
import { scanRepository } from '../../scanner.ts'
import { createWebMapSession } from './map-session.ts'
import { renderSetupPage } from './startup/page.ts'

type MapSession = Awaited<ReturnType<typeof createWebMapSession>>

/** One local server owns setup and the ready map; the map starts only after initialization. */
export async function startWebViewer(
  repositoryRoot: string,
  options: { port?: number; workSource?: WorkSource; scan?: boolean } = {},
): Promise<{ url: string; close: () => Promise<void> }> {
  const initial = gromaInitialization(repositoryRoot)
  let projectName = (await loadProjectProfile(repositoryRoot))?.title ?? path.basename(repositoryRoot)
  let map: MapSession | undefined
  let error: string | undefined

  async function openMap(scan: boolean): Promise<void> {
    if (scan) await scanRepository(repositoryRoot)
    map = await createWebMapSession(repositoryRoot, options)
  }

  function failed(cause: unknown): void {
    error = cause instanceof Error ? cause.message : String(cause)
  }

  function setupResponse(status = error === undefined ? 200 : 500): Response {
    return new Response(renderSetupPage({
      projectName,
      ...gromaInitialization(repositoryRoot),
      error,
    }), {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  async function initialize(request: Request): Promise<Response> {
    try {
      const input = await request.formData()
      projectName = String(input.get('projectName') ?? '')
      await initializeGroma(repositoryRoot, {
        projectName,
        directory: String(input.get('directory') ?? ''),
      })
      await openMap(true)
      return new Response(null, { status: 303, headers: { Location: '/' } })
    } catch (cause) {
      failed(cause)
      return setupResponse(400)
    }
  }

  const server = Bun.serve({
    port: options.port ?? 4747,
    // The map's live event stream must stay open between changes.
    idleTimeout: 0,
    fetch(request) {
      if (map !== undefined) return map.fetch(request)
      if (request.method === 'POST' && new URL(request.url).pathname === '/initialize') {
        return initialize(request)
      }
      return setupResponse()
    },
  })

  if (initial.initialized) {
    try {
      await openMap(options.scan === true)
    } catch (cause) {
      failed(cause)
    }
  }

  return {
    url: `http://localhost:${server.port}`,
    async close() {
      await server.stop(true)
      await map?.close()
    },
  }
}
