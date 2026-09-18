import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { HttpEndpointSegment, HttpRequestSegment, ScanObservation, ScannerPlugin } from '@groma/scanner'
import { buildPackage } from '../plugins/scanners/php/build.ts'
import { inferRelationships } from '../src/relationship-inference.ts'

async function scanFixture(): Promise<{ temporary: string; scan: ScanObservation }> {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-php-http-'))
  const root = path.join(temporary, 'project')
  const artifact = path.join(temporary, 'scanner')
  await cp(path.resolve(import.meta.dir, '../test/fixtures/php-http'), root, { recursive: true })
  const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
  expect(await git.exited).toBe(0)
  await buildPackage(artifact)
  const scanner: ScannerPlugin = (await import(path.join(artifact, 'dist/index.js'))).default
  return { temporary, scan: (await scanner.scan(root))! }
}

/** `:id` is a parameter, as the derived statement writes it. */
function endpointPath(segments: readonly HttpEndpointSegment[]): string {
  return `/${segments.map(segment => (segment.kind === 'literal' ? segment.value : `:${segment.name}`)).join('/')}`
}

/** `{}` is one computed segment and `?` text the source does not prove. */
function requestPath(segments: readonly HttpRequestSegment[]): string {
  return `/${segments.map(segment => {
    return segment.kind === 'literal' ? segment.value : segment.kind === 'dynamic' ? '{}' : '?'
  }).join('/')}`
}

function fileOf(scan: ScanObservation, operation: string): string {
  return scan.operations!.find(candidate => candidate.id === operation)!.file
}

test.concurrent('PHP routing declarations report the endpoints their handlers serve', async () => {
  const { temporary, scan } = await scanFixture()
  try {
    const endpoints = scan.httpEndpoints!.map(endpoint => (
      [endpoint.method, endpointPath(endpoint.path), fileOf(scan, endpoint.operation)]
    )).sort()
    // A computed route, a computed group or class prefix, a partly literal segment, a partly literal
    // regular expression and a route with no resolvable handler report nothing.
    expect(endpoints).toEqual([
      ['DELETE', '/internal/talks/:id', 'app/TalkController.php'],
      ['GET', '/api/health', 'routes/api.php'],
      ['GET', '/api/speakers/:id', 'app/SpeakerController.php'],
      ['GET', '/api/talks', 'app/TalkController.php'],
      ['GET', '/api/talks/:id', 'app/TalkController.php'],
      ['GET', '/shop/v1/orders', 'plugin/rest.php'],
      ['HEAD', '/api/talks/:id', 'app/TalkController.php'],
      ['PATCH', '/shop/v1/orders/:id', 'plugin/rest.php'],
      ['POST', '/admin/purge', 'app/AdminRoutes.php'],
      ['POST', '/api/speakers', 'app/SpeakerController.php'],
      ['POST', '/api/talks/:id/comments', 'app/TalkController.php'],
      ['POST', '/shop/v1/orders/:id', 'plugin/rest.php'],
      ['PUT', '/shop/v1/orders/:id', 'plugin/rest.php'],
    ])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('PHP client calls report the method and the path parts the source proves', async () => {
  const { temporary, scan } = await scanFixture()
  try {
    const requests = scan.httpRequests!.map(request => [
      request.method ?? '-',
      request.configured === true ? `configured ${requestPath(request.path)}` : requestPath(request.path),
      fileOf(scan, request.operation),
    ]).sort()
    // Only a receiver proved to hold a client sends a request, so `/api/cached` on another object and
    // route registrations report nothing. An unproven method, a host and an unresolved URL are
    // reported as the source states them.
    expect(requests).toEqual([
      ['-', '/?/log', 'plugin/client.php'],
      ['DELETE', '/shop/v1/orders/{}', 'plugin/client.php'],
      ['GET', '/?', 'plugin/client.php'],
      ['GET', '/?/api/talks', 'app/TalkClient.php'],
      ['GET', 'configured /api/talks', 'app/TalkClient.php'],
      ['GET', 'configured /api/talks/?', 'app/TalkClient.php'],
      ['GET', 'configured /api/talks/{}', 'app/TalkClient.php'],
      ['GET', 'configured /shop/v1/orders', 'plugin/client.php'],
      ['PATCH', '/shop/v1/orders/{}', 'plugin/client.php'],
      ['POST', 'configured /shop/v1/orders', 'plugin/client.php'],
      ['PUT', 'configured /shop/v1/orders/{}', 'plugin/client.php'],
    ])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('core derives rows from the PHP facts of one scan', async () => {
  const { temporary, scan } = await scanFixture()
  try {
    const owners = new Map(scan.files.map(file => [file.file, file.file]))
    const rows = inferRelationships([scan], owners).map(row => [row.source, row.target, row.description])
    // Each client file reaches the file that handles the routes it calls. The requests core cannot
    // compare, and the methods no endpoint serves, add nothing.
    expect(rows).toEqual([
      ['app/TalkClient.php', 'app/TalkController.php', 'Calls HTTP endpoints: GET /api/talks, GET /api/talks/:id'],
      ['plugin/client.php', 'plugin/rest.php',
        'Calls HTTP endpoints: GET /shop/v1/orders, PATCH /shop/v1/orders/:id, PUT /shop/v1/orders/:id'],
    ])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})
