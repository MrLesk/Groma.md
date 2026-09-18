import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { HttpEndpointSegment, HttpRequestSegment, ScanObservation, ScannerPlugin } from '@groma/scanner'
import { buildPackage } from '../plugins/scanners/php/build.ts'
import { inferRelationships } from '../src/relationship-inference.ts'

async function scanFixture(fixture = 'php-http'): Promise<{ temporary: string; scan: ScanObservation }> {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-php-http-'))
  const root = path.join(temporary, 'project')
  const artifact = path.join(temporary, 'scanner')
  await cp(path.resolve(import.meta.dir, '../test/fixtures', fixture), root, { recursive: true })
  const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
  expect(await git.exited).toBe(0)
  await buildPackage(artifact)
  const scanner: ScannerPlugin = (await import(path.join(artifact, 'dist/index.js'))).default
  return { temporary, scan: (await scanner.scan(root))! }
}

/** `:id` is a parameter and `:path*` an optional catch-all, as the derived statement writes them; `~` marks a constrained one. */
function endpointPath(segments: readonly HttpEndpointSegment[]): string {
  return `/${segments.map(segment => {
    if (segment.kind === 'literal') return segment.value
    const suffix = segment.kind === 'catch-all' ? (segment.optional ? '*' : '+') : segment.optional ? '?' : ''
    return `:${segment.name}${suffix}${segment.constrained ? '~' : ''}`
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

test.concurrent('PHP routing declarations report the endpoints their handlers serve', async () => {
  const { temporary, scan } = await scanFixture()
  try {
    const endpoints = scan.httpEndpoints!.map(endpoint => (
      [endpoint.method, endpointPath(endpoint.path), fileOf(scan, endpoint.operation), endpoint.order]
    )).sort()
    const order = (application: string) => ({ application, position: 0 })
    // Routes on receivers not proved to be routers report nothing. Pattern-restricted and partly literal
    // segments are constrained, and so are Laravel parameters a global pattern restricts. A Laravel
    // routes file that another file loads, through `withRouting`, a group or a `require`, serves its
    // routes under every prefix and pattern on the way, and under an unresolved prefix they are blockers;
    // a `require` in a file nothing loads adds nothing. A typed Slim application serves at the root
    // when the project sets no base path.
    // A Laravel string handler names a method of its controller group, never a function. An invokable
    // Symfony class's own attribute routes `__invoke`. A route entry the scanner sees but cannot resolve,
    // such as a computed route, prefix or group, a host-bound group, an unknown handler or a redirect, is
    // a blocker: its literal prefix and a constrained optional catch-all, named after the code that
    // registers it. Every endpoint's order is unknown: a Laravel project's routes all belong to its
    // `bootstrap/app.php`, and any other route to the file that declares it.
    expect(endpoints).toEqual([
      ['*', '/old/talks/:path*~', 'routes/web.php', order('bootstrap/app.php')],
      ['*', '/shop/v1/health/:path*~', 'plugin/rest.php', order('plugin/rest.php')],
      ['DELETE', '/admin/talks/:id~', 'app/TalkController.php', order('bootstrap/app.php')],
      ['DELETE', '/internal/talks/:id~', 'app/TalkController.php', order('bootstrap/app.php')],
      ['GET', '/api/archive/:path*~', 'routes/web.php', order('bootstrap/app.php')],
      ['GET', '/api/archive/latest', 'app/TalkController.php', order('bootstrap/app.php')],
      ['GET', '/api/health', 'routes/web.php', order('bootstrap/app.php')],
      ['GET', '/api/sessions', 'app/TalkController.php', order('bootstrap/app.php')],
      ['GET', '/api/sessions/:talk~', 'app/TalkController.php', order('bootstrap/app.php')],
      ['GET', '/api/speakers/:id~', 'app/SpeakerController.php', order('app/SpeakerController.php')],
      ['GET', '/api/speakers/:id~/:size~', 'app/SpeakerController.php', order('app/SpeakerController.php')],
      ['GET', '/api/talks', 'app/TalkController.php', order('bootstrap/app.php')],
      ['GET', '/api/talks/:id~', 'app/TalkController.php', order('bootstrap/app.php')],
      ['GET', '/api/v1/speakers', 'app/TalkController.php', order('bootstrap/app.php')],
      ['GET', '/beta/:path*~', 'routes/web.php', order('bootstrap/app.php')],
      ['GET', '/docs/:path*', 'routes/web.php', order('bootstrap/app.php')],
      ['GET', '/drafts/:path*~', 'app/SpeakerController.php', order('app/SpeakerController.php')],
      ['GET', '/featured', 'app/TalkController.php', order('bootstrap/app.php')],
      ['GET', '/hosted/:path*~', 'routes/web.php', order('bootstrap/app.php')],
      ['GET', '/latest/:path*~', 'routes/web.php', order('bootstrap/app.php')],
      ['GET', '/legacy/talks/:path*~', 'routes/web.php', order('bootstrap/app.php')],
      ['GET', '/login', 'app/TalkController.php', order('bootstrap/app.php')],
      ['GET', '/panel/:path*~', 'routes/web.php', order('bootstrap/app.php')],
      ['GET', '/partners/:path*~', 'routes/partners.php', order('bootstrap/app.php')],
      ['GET', '/ratings/:id', 'app/SpeakerController.php', order('app/SpeakerController.php')],
      ['GET', '/reports/:name', 'routes/web.php', order('bootstrap/app.php')],
      ['GET', '/reports/daily', 'routes/web.php', order('bootstrap/app.php')],
      ['GET', '/reviews/:id', 'app/SpeakerController.php', order('app/SpeakerController.php')],
      ['GET', '/shop/v1/orders', 'plugin/rest.php', order('plugin/rest.php')],
      ['GET', '/shop/v1/orders/:id~/:index~', 'plugin/rest.php', order('plugin/rest.php')],
      ['GET', '/status', 'app/AdminRoutes.php', order('app/AdminRoutes.php')],
      ['GET', '/tenant/:path*~', 'routes/web.php', order('bootstrap/app.php')],
      ['GET', '/v2/talks', 'app/TalkController.php', order('bootstrap/app.php')],
      ['HEAD', '/api/talks/:id~', 'app/TalkController.php', order('bootstrap/app.php')],
      ['PATCH', '/shop/v1/orders/:id~', 'plugin/rest.php', order('plugin/rest.php')],
      ['POST', '/admin/purge', 'app/AdminRoutes.php', order('app/AdminRoutes.php')],
      ['POST', '/api/speakers', 'app/SpeakerController.php', order('app/SpeakerController.php')],
      ['POST', '/api/talks/:id/comments', 'app/TalkController.php', order('bootstrap/app.php')],
      ['POST', '/beta/:path*~', 'app/AdminRoutes.php', order('app/AdminRoutes.php')],
      ['POST', '/shop/v1/orders/:id~', 'plugin/rest.php', order('plugin/rest.php')],
      ['PUT', '/shop/v1/orders/:id~', 'plugin/rest.php', order('plugin/rest.php')],
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
    // Only a receiver proved to hold a client sends a request: a typed property or a typed parameter the
    // method does not reassign, never another method's parameter, a reassigned one, a client constructed
    // with its own base, `/api/cached` on another object or a route registration. cURL calls that
    // configure two handles or set a method the scanner cannot read report nothing. An unproven method,
    // a host, a base followed by text that continues its segment, another class's constant and an
    // unresolved URL are reported as the source states them. A request in top-level code belongs to it.
    expect(requests).toEqual([
      ['-', '/?/log', 'plugin/client.php'],
      ['DELETE', '/shop/v1/orders/{}', 'plugin/client.php'],
      ['GET', '/?', 'app/TalkClient.php'],
      ['GET', '/?', 'plugin/client.php'],
      ['GET', '/?', 'plugin/client.php'],
      ['GET', '/?/api/talks', 'app/TalkClient.php'],
      ['GET', '/?/shop/v1/orders', 'plugin/client.php'],
      ['GET', '/shop/v1/orders', 'plugin/client.php'],
      ['GET', 'configured /api/archive/latest', 'app/TalkClient.php'],
      ['GET', 'configured /api/sessions', 'app/TalkClient.php'],
      ['GET', 'configured /api/speakers/featured', 'app/TalkClient.php'],
      ['GET', 'configured /api/talks', 'app/TalkClient.php'],
      ['GET', 'configured /api/talks/?', 'app/TalkClient.php'],
      ['GET', 'configured /api/talks/{}', 'app/TalkClient.php'],
      ['GET', 'configured /reports/daily', 'app/TalkClient.php'],
      ['GET', 'configured /shop/v1/orders', 'plugin/client.php'],
      ['GET', 'configured /shop/v1/orders/latest', 'plugin/client.php'],
      ['PATCH', '/shop/v1/orders/{}', 'plugin/client.php'],
      ['POST', '/shop/v1/orders/{}', 'plugin/client.php'],
      ['POST', 'configured /shop/v1/orders', 'plugin/client.php'],
      ['PUT', 'configured /shop/v1/orders/{}', 'plugin/client.php'],
    ])
    // Top-level code is an operation only in files where a request or a blocker names it.
    const modules = scan.operations!.filter(operation => operation.name === '(module)').map(operation => operation.file).sort()
    expect(modules).toEqual(['plugin/client.php', 'routes/partners.php', 'routes/web.php'])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('core derives rows from the PHP facts of one scan', async () => {
  const { temporary, scan } = await scanFixture()
  try {
    const owners = new Map(scan.files.map(file => [file.file, file.file]))
    const rows = inferRelationships([scan], owners).map(row => [row.source, row.target, row.description])
    // Each client file reaches the file that handles the routes it calls. The requests core cannot
    // compare, and the methods no endpoint serves, add nothing. A literal reaches a constrained
    // parameter only possibly, so `/api/speakers/featured` adds no row; `/reports/daily` adds none
    // because the file registers two routes it reaches in an unknown order; and `/api/archive/latest`
    // adds none because a blocker in another file could capture it.
    expect(rows).toEqual([
      ['app/TalkClient.php', 'app/TalkController.php', 'Calls HTTP endpoints: GET /api/sessions, GET /api/talks, GET /api/talks/:id'],
      ['plugin/client.php', 'plugin/rest.php',
        'Calls HTTP endpoints: GET /shop/v1/orders, PATCH /shop/v1/orders/:id, POST /shop/v1/orders/:id, PUT /shop/v1/orders/:id'],
    ])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('a Laravel global pattern whose parameter name is unreadable constrains every Laravel route parameter', async () => {
  const { temporary, scan } = await scanFixture('php-http-patterns')
  try {
    const endpoints = scan.httpEndpoints!.map(endpoint => [endpoint.method, endpointPath(endpoint.path)]).sort()
    // A route's own pattern still decides its parameter, and files that disagree on a name's pattern
    // leave it unreadable, as does a route pattern whose parameter name the scanner cannot read.
    expect(endpoints).toEqual([['GET', '/downloads/:file*~'], ['GET', '/files/:path*'], ['GET', '/posts/:slug*~'], ['GET', '/talks/:id~']])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('routes on a receiver whose prefix is not proved, or in a file nothing loads, are blockers', async () => {
  const { temporary, scan } = await scanFixture('php-http-routers')
  try {
    const endpoints = scan.httpEndpoints!.map(endpoint => [endpoint.method, endpointPath(endpoint.path), fileOf(scan, endpoint.operation)]).sort()
    // A Slim group object outside the group whose closure receives it, a closure passed to `group` on an
    // unproved receiver, a Laravel routes file that no loader reaches, and a `base_path` load with two
    // candidate files state no prefix. A Slim application a closure imports keeps its root, while one
    // the code may replace, or a closure reassigns or imports by reference, proves nothing; a local
    // application of another function leaves the file's own one proved, and a closure sees it only
    // through an import; one base path prefixes routes and two leave the prefix unresolved; and a typed
    // application serves under an unresolved prefix when the project sets several base paths.
    // Routes files that load each other in a cycle also serve under an unknown prefix.
    expect(endpoints).toEqual([
      ['*', '/shop/:path*~', 'packages/shop/Provider.php'],
      ['GET', '/:path*~', 'loop.php'],
      ['GET', '/:path*~', 'packages/shop/routes/shop.php'],
      ['GET', '/:path*~', 'routes/shop.php'],
      ['GET', '/:path*~', 'slim.php'],
      ['GET', '/:path*~', 'slim.php'],
      ['GET', '/:path*~', 'slim.php'],
      ['GET', '/:path*~', 'unloaded.php'],
      ['GET', '/:path*~', 'web.php'],
      ['GET', '/:path*~', 'web.php'],
      ['GET', '/:path*~', 'web.php'],
      ['GET', '/admin/users', 'slim.php'],
      ['GET', '/api/talks', 'slim.php'],
      ['GET', '/constructed', 'slim.php'],
      ['GET', '/loop/ring', 'loop.php'],
      ['GET', '/status', 'slim.php'],
      ['GET', '/sub/based', 'slim.php'],
      ['GET', '/talks', 'web.php'],
    ])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('a typed Slim application serves under the project base path, and a Laravel package under its manifest', async () => {
  const { temporary, scan } = await scanFixture('php-http-projects')
  try {
    const endpoints = scan.httpEndpoints!.map(endpoint => [endpoint.method, endpointPath(endpoint.path), endpoint.order!.application]).sort()
    // The one `setBasePath` call prefixes every route a typed application registers. A Laravel project
    // without `bootstrap/app.php` shares the application of its nearest `composer.json`.
    expect(endpoints).toEqual([
      ['GET', '/myapp/api/sessions', 'slim/app/routes.php'],
      ['GET', '/myapp/talks', 'slim/app/routes.php'],
      ['GET', '/shop/cart', 'package/composer.json'],
    ])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})
