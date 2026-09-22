import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { HttpEndpointSegment, HttpRequestSegment, ScanObservation, ScannerPlugin } from '@groma/scanner'
import { buildPackage } from '../plugins/scanners/javascript/build.ts'
import { inferRelationships } from '../src/relationship-inference.ts'
import javascript from '../plugins/scanners/javascript/src/index.ts'

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

/**
 * Each endpoint as `application@position method path owner`, ordered by application and position; an
 * endpoint of a router that states no order has no `application@position`.
 */
function endpointTable(scan: ScanObservation): string[] {
  const operations = new Map(scan.operations!.map(operation => [operation.id, operation]))
  const rows = scan.httpEndpoints!.map(endpoint => {
    const operation = operations.get(endpoint.operation)!
    return {
      application: endpoint.order?.application ?? '',
      position: endpoint.order?.position ?? -1,
      line: `${endpoint.order === undefined ? '' : `${endpoint.order.application}@${endpoint.order.position} `}`
        + `${endpoint.method} ${endpointPath(endpoint.path)} ${operation.file}#${operation.name}`,
    }
  })
  rows.sort((left, right) => left.application.localeCompare(right.application) || left.position - right.position
    || left.line.localeCompare(right.line))
  return rows.map(row => row.line)
}

test.concurrent('JavaScript routers report the endpoints their handlers serve, in the order they are tried', async () => {
  const { temporary, scan } = await scanFixture()
  try {
    // Package middleware, a computed method on Fastify, a route object a spread fills, a value the scan
    // cannot prove to be a handler, a key that is not a method, a router this file never mounts, a route
    // registered on a Hono or Koa child after its parent copied the child's routes, and a router whose
    // framework name a parameter shadows or whose name the file replaces report nothing. A Koa router
    // adds its own prefix, a nested router adds its mount, and a route name never becomes a path
    // segment. In a router that takes the first registered match, a static mount, a partly computed
    // route, a regular expression, a catch-all that is not last, a mount under a computed prefix, a
    // router with a computed prefix or from another file, a route a child may or may not have when its
    // parent copied it, and a registrar handed to other code or exported occupy their place as any
    // remainder below the path they state, `:**!`.
    expect(endpointTable(scan)).toEqual([
      // Fastify and Bun.serve prefer the most specific route, so their endpoints, and a Fastify plugin's
      // block below its prefix, carry no order.
      '* /plugins/:**! server/fastify.js#(anonymous)',
      '* /status server/serve.js#ready',
      'GET /files server/serve.js#list',
      'GET /mixed server/serve.js#list',
      'GET /multi server/fastify.js#both',
      'GET /votes/:id server/fastify.js#read',
      'POST /files server/serve.js#store',
      'POST /multi server/fastify.js#both',
      'POST /submissions server/fastify.js#submit',
      // An application is its file and the variable that holds it, so a router `b` cannot follow blocks
      // only `b`.
      'server/dual.js#a@0 GET /dual/items server/dual.js#dualItems',
      'server/dual.js#b@0 * /:**! server/dual.js#(anonymous)',
      // An exported application may gain any route in the files that import it, after all of its own,
      // wherever the export is written.
      'server/exported.mjs#app@0 GET /exported/items server/exported.mjs#(anonymous)',
      'server/exported.mjs#app@1 * /:**! server/exported.mjs#(anonymous)',
      // A handler next to a recognized router is middleware, wherever it comes from.
      'server/express.mjs#app@0 * /static/:**! server/express.mjs#(anonymous)',
      'server/express.mjs#app@1 GET /talks/:id server/express.mjs#(anonymous)',
      'server/express.mjs#app@2 POST /talks server/express.mjs#(anonymous)',
      'server/express.mjs#app@3 * /health server/express.mjs#(anonymous)',
      'server/express.mjs#app@4 GET /reports/:**! server/express.mjs#(anonymous)',
      'server/express.mjs#app@5 GET /downloads/:**! server/express.mjs#(anonymous)',
      'server/express.mjs#app@6 GET /admin/users server/express.mjs#(anonymous)',
      // A handler before a router, from the application's own module or a package, leaves the call
      // without a path.
      'server/guarded.js#app@0 GET /guarded/items server/guarded.js#guardedItems',
      'server/guarded.js#app@1 GET /open/items server/guarded.js#openItems',
      'server/hono.mjs#app@0 GET /api/talks server/hono.mjs#(anonymous)',
      'server/hono.mjs#app@1 GET /lazy/items/:**! server/hono.mjs#addLazy',
      'server/hono.mjs#app@2 * /:**! server/hono.mjs#(anonymous)',
      'server/koa-api.js#app@0 * /:**! server/koa-api.js#(anonymous)',
      // A router's routes take its mount's place, a nested router's take theirs inside it, and a router
      // handed on blocks from there on; `del` is `delete`, a redirect answers every method at its source,
      // and a redirect from a route name answers at a path the scan cannot read.
      'server/koa.js#app@0 GET /rooms server/koa.js#list',
      'server/koa.js#app@1 POST /rooms server/koa.js#store',
      'server/koa.js#app@2 GET /rooms/named/:id server/koa.js#read',
      'server/koa.js#app@3 GET /rooms/files/:*+ server/koa.js#list',
      'server/koa.js#app@4 GET /rooms/files/:**! server/koa.js#list',
      'server/koa.js#app@5 GET /rooms/details/:id server/koa.js#read',
      'server/koa.js#app@6 * /rooms/shifting/:**! server/koa.js#(anonymous)',
      'server/koa.js#app@7 * /rooms/:**! server/koa.js#(anonymous)',
      'server/koa.js#app@8 DELETE /rooms/:id server/koa.js#store',
      'server/koa.js#app@9 * /rooms/old server/koa.js#(anonymous)',
      'server/koa.js#app@10 * /rooms/:**! server/koa.js#(anonymous)',
      'server/router.cjs#app@0 GET /orders/:id server/router.cjs#readOrder',
      'server/router.cjs#app@1 * /:**! server/router.cjs#(anonymous)',
      'server/router.cjs#app@2 GET /:**! server/router.cjs#(anonymous)',
      'server/router.cjs#app@3 * /:**! server/router.cjs#(anonymous)',
      // Mounts inside a function run in an unknown order, so every router they list shares one position.
      'server/setup.js#app@0 GET /left/first server/setup.js#one',
      'server/setup.js#app@0 GET /left/second server/setup.js#two',
      'server/setup.js#app@0 GET /right/fourth server/setup.js#four',
      'server/setup.js#app@0 GET /right/third server/setup.js#three',
      // A router from another file, mounted without a path, may serve any path from its place on.
      'server/site.js#site@0 * /:**! server/site.js#(anonymous)',
      'server/site.js#site@1 GET /pages/:name server/site.js#page',
      'server/spa.js#app@0 * /:**! server/spa.js#(anonymous)',
      'server/spa.js#app@1 GET /:*+ server/spa.js#spa',
    ])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('separate local applications with the same variable name keep separate route order', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-javascript-apps-'))
  try {
    await writeFile(path.join(root, 'apps.js'), `import express from 'express'
function first() { const app = express(); app.get('/first', () => {}) }
function second() { const app = express(); app.get('/second', () => {}) }
`)
    expect(await Bun.spawn(['git', 'init', '--quiet', root]).exited).toBe(0)
    const endpoints = (await javascript.scan(root))!.httpEndpoints!.filter(endpoint => endpoint.method === 'GET')
    expect(endpoints).toHaveLength(2)
    expect(new Set(endpoints.map(endpoint => endpoint.order?.application)).size).toBe(2)
    expect(endpoints.map(endpoint => endpoint.order?.position)).toEqual([0, 0])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a named undici fetch import reports the request it sends', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-javascript-undici-'))
  try {
    await writeFile(path.join(root, 'client.mjs'), "import { fetch as send } from 'undici'\nexport function load() { return send('/items', { method: 'POST' }) }\n")
    expect(await Bun.spawn(['git', 'init', '--quiet', root]).exited).toBe(0)
    const requests = (await javascript.scan(root))!.httpRequests!
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({ method: 'POST', path: [{ kind: 'literal', value: 'items' }] })
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('axios form helpers report their HTTP methods and paths', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-javascript-axios-form-'))
  try {
    await writeFile(path.join(root, 'client.mjs'), `import client from 'axios'
client.postForm('/first', {})
client.putForm('/second', {})
client.patchForm('/third', {})
`)
    expect(await Bun.spawn(['git', 'init', '--quiet', root]).exited).toBe(0)
    const requests = (await javascript.scan(root))!.httpRequests!
    expect(requests.map(request => [request.method, request.path.map(segment => segment.kind === 'literal' ? segment.value : '?')]))
      .toEqual([['POST', ['first']], ['PUT', ['second']], ['PATCH', ['third']]])
  } finally { await rm(root, { recursive: true, force: true }) }
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
      // Another file may assign a field this file assigns.
      ['GET', '/?/talks', 'client/fields.mjs'],
      ['GET', '/?/talks', 'client/globals.js'],
      ['GET', '/?/talks', 'client/options.mjs'],
      ['GET', '/?/talks', 'client/shadowing.mjs'],
      ['GET', '/?/talks', 'client/values.mjs'],
      ['GET', '/api/default', 'client/jquery.js'],
      ['GET', '/api/talks', 'client/fetch.mjs'],
      ['GET', '/api/talks', 'client/values.mjs'],
      ['GET', '/api/talks', 'client/values.mjs'],
      ['GET', '/api/talks/?', 'client/fetch.mjs'],
      ['GET', '/dual/items', 'client/fetch.mjs'],
      ['GET', '/files', 'client/jquery.js'],
      ['GET', '/missing', 'client/axios.mjs'],
      ['GET', '/scripts/app.js', 'client/jquery.js'],
      ['GET', '/talks/{}', 'client/fetch.mjs'],
      ['GET', '/talks/{}', 'client/jquery.js'],
      ['GET', 'configured /files', 'client/axios.mjs'],
      // The one assignment to a required client's defaults sets its base.
      ['GET', 'configured /required', 'client/commonjs.js'],
      // A field the file never assigns is the client's own base setting.
      ['GET', 'configured /talks', 'client/fields.mjs'],
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
      // A router another application of the same file cannot follow blocks only that application.
      ['client/fetch.mjs', 'server/dual.js', 'Calls HTTP endpoint: GET /dual/items'],
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
