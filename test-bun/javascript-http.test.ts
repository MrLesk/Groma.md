import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { HttpEndpointSegment, HttpRequestSegment, ScanObservation, ScannerPlugin } from '@groma/scanner'
import { buildPackage } from '../plugins/scanners/javascript/build.ts'
import { inferRelationships } from '../src/relationship-inference.ts'

async function scanFixture(): Promise<{ temporary: string; scan: ScanObservation }> {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-javascript-http-'))
  const root = path.join(temporary, 'project')
  const artifact = path.join(temporary, 'scanner')
  await cp(path.resolve(import.meta.dir, '../test/fixtures/javascript-http'), root, { recursive: true })
  const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
  expect(await git.exited).toBe(0)
  await buildPackage(artifact)
  const scanner: ScannerPlugin = (await import(path.join(artifact, 'dist/index.js'))).default
  return { temporary, scan: (await scanner.scan(root))! }
}

/** `:id` is a parameter and `*` a catch-all, as the derived statement writes them. */
function endpointPath(segments: readonly HttpEndpointSegment[]): string {
  return `/${segments.map(segment => {
    if (segment.kind === 'literal') return segment.value
    return segment.kind === 'catch-all' ? '*' : `:${segment.name}`
  }).join('/')}`
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

test.concurrent('JavaScript routers report the endpoints their handlers serve, with every mounted prefix', async () => {
  const { temporary, scan } = await scanFixture()
  try {
    const endpoints = scan.httpEndpoints!.map(endpoint => (
      [endpoint.method, endpointPath(endpoint.path), fileOf(scan, endpoint.operation)]
    )).sort()
    // Middleware, a static mount, a computed route or prefix, a regular expression, a catch-all that is
    // not last, a computed method, a route object a spread fills and a key that is not a method report
    // nothing, and a router this file never mounts states no path at all. A Koa router adds its own
    // prefix, a nested router adds its mount, and a route name never becomes a path segment.
    expect(endpoints).toEqual([
      ['*', '/health', 'server/express.mjs'],
      ['*', '/status', 'server/serve.js'],
      ['GET', '/api/talks', 'server/hono.mjs'],
      ['GET', '/files', 'server/serve.js'],
      ['GET', '/mixed', 'server/serve.js'],
      ['GET', '/multi', 'server/fastify.js'],
      ['GET', '/orders/:id', 'server/router.cjs'],
      ['GET', '/rooms', 'server/koa.js'],
      ['GET', '/rooms/details/:id', 'server/koa.js'],
      ['GET', '/rooms/files/*', 'server/koa.js'],
      ['GET', '/rooms/named/:id', 'server/koa.js'],
      ['GET', '/talks/:id', 'server/express.mjs'],
      ['GET', '/votes/:id', 'server/fastify.js'],
      ['POST', '/files', 'server/serve.js'],
      ['POST', '/multi', 'server/fastify.js'],
      ['POST', '/rooms', 'server/koa.js'],
      ['POST', '/submissions', 'server/fastify.js'],
      ['POST', '/talks', 'server/express.mjs'],
    ])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('an endpoint names the handler the route states, and its registrar when the handler is elsewhere', async () => {
  const { temporary, scan } = await scanFixture()
  try {
    const named = (method: string, route: string) => {
      const endpoint = scan.httpEndpoints!.find(candidate => candidate.method === method && endpointPath(candidate.path) === route)!
      return scan.operations!.find(operation => operation.id === endpoint.operation)!.name
    }
    expect(named('POST', '/submissions')).toBe('submit')
    expect(named('GET', '/orders/:id')).toBe('readOrder')
    expect(named('GET', '/files')).toBe('list')
    expect(named('POST', '/rooms')).toBe('store')
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('JavaScript client calls report the method and the path parts the source proves', async () => {
  const { temporary, scan } = await scanFixture()
  try {
    const requests = scan.httpRequests!.map(request => [
      request.method ?? '-',
      request.configured === true ? `configured ${requestPath(request.path)}` : requestPath(request.path),
      fileOf(scan, request.operation),
    ]).sort()
    // A reassignable instance or router, another object's `get`, a `$` this file declares, a URL
    // passed to another function, `$.ajax` settings the scanner cannot read and a local function
    // named `fetch` send nothing. A host, an unresolved URL, a base a loop variable computes, a partly computed
    // segment and a computed method are reported as the source states them. A variable this file never
    // assigns again and a property of an object only this file holds are literal; an exported object,
    // which another file can change, a script's top-level names, which are globals, and a reassigned
    // variable are not.
    expect(requests).toEqual([
      ['-', '/api/rooms', 'client/jquery.js'],
      ['-', '/status', 'client/fetch.mjs'],
      ['DELETE', '/status', 'client/axios.mjs'],
      ['DELETE', '/status', 'client/jquery.js'],
      ['GET', '/?', 'client/fetch.mjs'],
      ['GET', '/?', 'client/globals.js'],
      ['GET', '/?', 'client/jquery.js'],
      ['GET', '/?', 'client/values.mjs'],
      ['GET', '/?/rooms', 'client/fetch.mjs'],
      ['GET', '/?/talks', 'client/fetch.mjs'],
      ['GET', '/?/talks', 'client/globals.js'],
      ['GET', '/?/talks', 'client/values.mjs'],
      ['GET', '/api/default', 'client/jquery.js'],
      ['GET', '/api/talks', 'client/fetch.mjs'],
      ['GET', '/api/talks', 'client/values.mjs'],
      ['GET', '/api/talks', 'client/values.mjs'],
      ['GET', '/api/talks/?', 'client/fetch.mjs'],
      ['GET', '/files', 'client/jquery.js'],
      ['GET', '/missing', 'client/axios.mjs'],
      ['GET', '/scripts/app.js', 'client/jquery.js'],
      ['GET', '/talks/{}', 'client/fetch.mjs'],
      ['GET', '/talks/{}', 'client/jquery.js'],
      ['GET', 'configured /files', 'client/axios.mjs'],
      ['GET', 'configured /votes/{}', 'client/fetch.mjs'],
      ['POST', '/api/talks', 'client/jquery.js'],
      ['POST', '/submissions', 'client/axios.mjs'],
      ['POST', '/submissions', 'client/jquery.js'],
    ])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('core derives rows from the JavaScript facts of one scan', async () => {
  const { temporary, scan } = await scanFixture()
  try {
    const owners = new Map(scan.files.map(file => [file.file, file.file]))
    const rows = inferRelationships([scan], owners).map(row => [row.source, row.target, row.description]).sort()
    // Each client file reaches the file that serves the routes it calls, including through a configured
    // base, a dynamic segment and one leading segment only the client states. The requests core cannot
    // compare add nothing.
    expect(rows).toEqual([
      ['client/axios.mjs', 'server/fastify.js', 'Calls HTTP endpoint: POST /submissions'],
      ['client/axios.mjs', 'server/serve.js', 'Calls HTTP endpoints: DELETE /status, GET /files'],
      ['client/fetch.mjs', 'server/express.mjs', 'Calls HTTP endpoint: GET /talks/:id'],
      ['client/fetch.mjs', 'server/fastify.js', 'Calls HTTP endpoint: GET /votes/:id'],
      ['client/fetch.mjs', 'server/hono.mjs', 'Calls HTTP endpoint: GET /api/talks'],
      ['client/jquery.js', 'server/express.mjs', 'Calls HTTP endpoints: GET /talks/:id, POST /talks'],
      ['client/jquery.js', 'server/fastify.js', 'Calls HTTP endpoint: POST /submissions'],
      ['client/jquery.js', 'server/serve.js', 'Calls HTTP endpoints: DELETE /status, GET /files'],
      ['client/values.mjs', 'server/hono.mjs', 'Calls HTTP endpoint: GET /api/talks'],
    ])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})
