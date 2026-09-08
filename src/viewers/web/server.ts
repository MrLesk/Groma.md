import path from 'node:path'
import type { WorkSource } from '@groma/work-source'

import {
  initializeRepository,
  type RepositoryInitDependencies,
} from '../../init-command.ts'
import { gromaInitialization } from '../../initialize.ts'
import { loadProjectProfile } from '../../project-profile.ts'
import { scanRepository } from '../../scanner.ts'
import { discoverScanners, type ScannerDiscovery } from '../../scanner/modules/discovery.ts'
import { installSelectedScanners } from '../../scanner/modules/setup.ts'
import { checkScannerReadiness, requireScannerReadiness } from '../../scanner/modules/readiness.ts'
import { createWebMapSession } from './map-session.ts'
import { renderSetupPage } from './startup/page.ts'

type MapSession = Awaited<ReturnType<typeof createWebMapSession>>

/** One local server owns setup and the ready map; the map starts only after initialization. */
export async function startWebViewer(
  repositoryRoot: string,
  options: {
    port?: number
    workSource?: WorkSource
    scan?: boolean
    onListening?: (url: string) => void
    initDependencies?: Partial<RepositoryInitDependencies>
  } = {},
): Promise<{ url: string; close: () => Promise<void> }> {
  const initial = gromaInitialization(repositoryRoot)
  let projectName = (await loadProjectProfile(repositoryRoot))?.title ?? path.basename(repositoryRoot)
  let proposal: ScannerDiscovery | undefined
  let map: MapSession | undefined
  let error: string | undefined
  let preparing = Promise.resolve()

  function openMap(scan: boolean): Promise<void> {
    error = undefined
    preparing = (async () => {
      if (scan) await scanRepository(repositoryRoot)
      map = await createWebMapSession(repositoryRoot, options)
    })().catch(failed)
    return preparing
  }

  function failed(cause: unknown): void {
    error = cause instanceof Error ? cause.message : String(cause)
  }

  function setupResponse(status = error === undefined ? 200 : 500): Response {
    return new Response(renderSetupPage({
      projectName,
      ...gromaInitialization(repositoryRoot),
      error,
      proposal,
    }), {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  async function initialize(request: Request): Promise<Response> {
    try {
      const input = await request.formData()
      projectName = String(input.get('projectName') ?? '')
      await initializeRepository(repositoryRoot, {
        projectName,
        directory: String(input.get('directory') ?? ''),
      }, options.initDependencies)
      proposal = await discoverScanners(repositoryRoot)
      error = undefined
      return new Response(null, { status: 303, headers: { Location: '/' } })
    } catch (cause) {
      failed(cause)
      return setupResponse(400)
    }
  }

  async function selectScanners(request: Request): Promise<Response> {
    if (proposal === undefined) return new Response('No scanner proposal to review.', { status: 400 })
    try {
      const input = await request.formData()
      await installSelectedScanners(repositoryRoot, proposal, input.getAll('scanner').map(String))
      proposal = await discoverScanners(repositoryRoot)
      requireScannerReadiness(await checkScannerReadiness(repositoryRoot))
      await openMap(true)
      if (error !== undefined) return setupResponse(400)
      proposal = undefined
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
    async fetch(request) {
      if (request.method === 'GET' && new URL(request.url).pathname === '/ready') {
        await preparing
        return new Response(null, { status: error === undefined ? 204 : 500 })
      }
      if (map !== undefined) return map.fetch(request)
      if (request.method === 'POST' && new URL(request.url).pathname === '/scanners') {
        return selectScanners(request)
      }
      if (request.method === 'POST' && new URL(request.url).pathname === '/initialize') {
        return initialize(request)
      }
      return setupResponse()
    },
  })

  const url = `http://localhost:${server.port}`
  options.onListening?.(url)
  if (initial.initialized) await openMap(options.scan === true)

  return {
    url,
    async close() {
      await server.stop(true)
      // A map still being prepared would otherwise finish after this close and leave its watchers running.
      await preparing
      await map?.close()
    },
  }
}
