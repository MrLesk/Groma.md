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

/** `?`, `*` and `+` mark an optional parameter and a catch-all; `!` marks a constrained segment. */
function endpointPath(segments: readonly HttpEndpointSegment[]): string {
  return `/${segments.map(segment => {
    if (segment.kind === 'literal') return segment.value
    const constrained = segment.constrained ? '!' : ''
    if (segment.kind === 'parameter') return `:${segment.name}${segment.optional ? '?' : ''}${constrained}`
    return `:${segment.name}${segment.optional ? '*' : '+'}${constrained}`
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
    // Package middleware, a computed method on Fastify, a route object a spread fills, a value the scan
    // cannot prove to be a handler, a key that is not a method, a router this file never mounts, a route
    // registered on a Hono or Koa child after its parent copied the child's routes, and a router whose
    // framework name a parameter shadows or whose name the file replaces report nothing. A Koa router
    // adds its own prefix, a nested router adds its mount, and a route name never becomes a path
    // segment. In a router that takes the first registered match, a static mount, a partly computed
    // route, a regular expression, a catch-all that is not last, a mount under a computed prefix, a
    // router with a computed prefix or from another file, a route a child may or may not have when its
    // parent copied it, and a registrar handed to other code or exported occupy their place as any
    // remainder below the path they state, `:**!`; so does a Fastify plugin, without a place.
    expect(endpoints).toEqual([
      ['*', '/:**!', 'server/exported.mjs'],
      ['*', '/:**!', 'server/hono.mjs'],
      ['*', '/:**!', 'server/koa-api.js'],
      ['*', '/:**!', 'server/router.cjs'],
      ['*', '/:**!', 'server/router.cjs'],
      ['*', '/:**!', 'server/site.js'],
      ['*', '/:**!', 'server/spa.js'],
      ['*', '/health', 'server/express.mjs'],
      ['*', '/plugins/:**!', 'server/fastify.js'],
      ['*', '/rooms/:**!', 'server/koa.js'],
      ['*', '/rooms/:**!', 'server/koa.js'],
      ['*', '/rooms/old', 'server/koa.js'],
      ['*', '/rooms/shifting/:**!', 'server/koa.js'],
      ['*', '/static/:**!', 'server/express.mjs'],
      ['*', '/status', 'server/serve.js'],
      ['DELETE', '/rooms/:id', 'server/koa.js'],
      ['GET', '/:**!', 'server/router.cjs'],
      ['GET', '/:*+', 'server/spa.js'],
      ['GET', '/admin/users', 'server/express.mjs'],
      ['GET', '/api/talks', 'server/hono.mjs'],
      ['GET', '/downloads/:**!', 'server/express.mjs'],
      ['GET', '/exported/items', 'server/exported.mjs'],
      ['GET', '/files', 'server/serve.js'],
      ['GET', '/lazy/items/:**!', 'server/hono.mjs'],
      ['GET', '/mixed', 'server/serve.js'],
      ['GET', '/multi', 'server/fastify.js'],
      ['GET', '/orders/:id', 'server/router.cjs'],
      ['GET', '/pages/:name', 'server/site.js'],
      ['GET', '/reports/:**!', 'server/express.mjs'],
      ['GET', '/rooms', 'server/koa.js'],
      ['GET', '/rooms/details/:id', 'server/koa.js'],
      ['GET', '/rooms/files/:**!', 'server/koa.js'],
      ['GET', '/rooms/files/:*+', 'server/koa.js'],
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

test.concurrent('Express, Hono and Koa routers report the order their routes are tried in', async () => {
  const { temporary, scan } = await scanFixture()
  try {
    const ordered = scan.httpEndpoints!.flatMap(endpoint => endpoint.order === undefined ? [] : [
      `${endpoint.order.application}@${endpoint.order.position} ${endpoint.method} ${endpointPath(endpoint.path)}`,
    ]).sort()
    expect(ordered).toEqual([
      // An exported application may gain any route in the files that import it, after all of its own,
      // wherever the export is written.
      'server/exported.mjs@0 GET /exported/items',
      'server/exported.mjs@1 * /:**!',
      'server/express.mjs@0 * /static/:**!',
      'server/express.mjs@1 GET /talks/:id',
      'server/express.mjs@2 POST /talks',
      'server/express.mjs@3 * /health',
      'server/express.mjs@4 GET /reports/:**!',
      'server/express.mjs@5 GET /downloads/:**!',
      // A handler next to a recognized router is middleware, wherever it comes from.
      'server/express.mjs@6 GET /admin/users',
      'server/hono.mjs@0 GET /api/talks',
      'server/hono.mjs@1 GET /lazy/items/:**!',
      'server/hono.mjs@2 * /:**!',
      'server/koa-api.js@0 * /:**!',
      // A router's routes take its mount's place, a nested router's take theirs inside it, and a router
      // handed on blocks from there on.
      'server/koa.js@0 GET /rooms',
      'server/koa.js@1 POST /rooms',
      // A redirect from a route name answers at a path the scan cannot read.
      'server/koa.js@10 * /rooms/:**!',
      'server/koa.js@2 GET /rooms/named/:id',
      'server/koa.js@3 GET /rooms/files/:*+',
      'server/koa.js@4 GET /rooms/files/:**!',
      'server/koa.js@5 GET /rooms/details/:id',
      'server/koa.js@6 * /rooms/shifting/:**!',
      'server/koa.js@7 * /rooms/:**!',
      'server/koa.js@8 DELETE /rooms/:id',
      'server/koa.js@9 * /rooms/old',
      'server/router.cjs@0 GET /orders/:id',
      'server/router.cjs@1 * /:**!',
      'server/router.cjs@2 GET /:**!',
      'server/router.cjs@3 * /:**!',
      // A router from another file, mounted without a path, may serve any path from its place on.
      'server/site.js@0 * /:**!',
      'server/site.js@1 GET /pages/:name',
      'server/spa.js@0 * /:**!',
      'server/spa.js@1 GET /:*+',
    ])
    // Fastify and Bun.serve prefer the most specific route, so their endpoints, and a Fastify plugin's
    // block, carry no order.
    const unordered = scan.httpEndpoints!.filter(endpoint => /server\/(fastify|serve)\.js$/.test(fileOf(scan, endpoint.operation)))
    expect(unordered.length).toBeGreaterThan(0)
    expect(unordered.some(endpoint => endpoint.order !== undefined)).toBe(false)
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
    // A reassignable instance, another object's `get`, a `$` this file declares, a URL passed to another
    // function, a local function named `fetch`, and a name that shadows an import send nothing. A host,
    // an unresolved URL, a base a loop variable computes, a partly computed segment and a computed
    // method are reported as the source states them. A variable this file never assigns again and a
    // property of an object only this file holds are literal; an exported object, which another file
    // can change, a script's top-level names, which are globals, a reassigned variable or property, and
    // a request's own host are not. A `fetch` input that is not URL text may be a Request with its own
    // method, and settings the scan cannot read state no method.
    expect(requests).toEqual([
      ['-', '/?', 'client/fetch.mjs'],
      ['-', '/?', 'client/globals.js'],
      ['-', '/?', 'client/jquery.js'],
      ['-', '/?', 'client/options.mjs'],
      ['-', '/?', 'client/values.mjs'],
      // An option name the scan cannot read could be the method.
      ['-', '/api/computed', 'client/options.mjs'],
      ['-', '/api/rooms', 'client/jquery.js'],
      ['-', '/api/rooms', 'client/jquery.js'],
      ['-', '/status', 'client/fetch.mjs'],
      ['DELETE', '/api/twice', 'client/options.mjs'],
      ['DELETE', '/status', 'client/axios.mjs'],
      ['DELETE', '/status', 'client/jquery.js'],
      ['GET', '/?', 'client/jquery.js'],
      ['GET', '/?/api/talks', 'client/options.mjs'],
      ['GET', '/?/rooms', 'client/fetch.mjs'],
      ['GET', '/?/talks', 'client/fetch.mjs'],
      ['GET', '/?/talks', 'client/globals.js'],
      ['GET', '/?/talks', 'client/options.mjs'],
      ['GET', '/?/talks', 'client/shadowing.mjs'],
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
      // The one assignment to a required client's defaults sets its base.
      ['GET', 'configured /required', 'client/commonjs.js'],
      ['GET', 'configured /votes/{}', 'client/fetch.mjs'],
      // jQuery prefers `method` to its older `type`.
      ['PATCH', '/api/method', 'client/jquery.js'],
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
