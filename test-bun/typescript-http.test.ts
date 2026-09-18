import { expect, test } from 'bun:test'
import { cp, mkdtemp, readdir, rename, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { HttpEndpointSegment, HttpRequestSegment, ScanObservation } from '@groma/scanner'

import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'

async function scanFixture(fixture = 'typescript-http'): Promise<{ scan: ScanObservation; clean: () => Promise<void> }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-ts-http-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures', fixture), root, { recursive: true })
  // The fixture ships framework imports this repository does not install, so its sources stay unbuilt.
  for (const name of await readdir(root, { recursive: true })) {
    if (name.endsWith('.fixture')) await rename(path.join(root, name), path.join(root, name.slice(0, -'.fixture'.length)))
  }
  for (const command of [['git', 'init', '--quiet'], ['git', 'add', '-A']]) {
    const child = Bun.spawn(command, { cwd: root, stdout: 'ignore', stderr: 'pipe' })
    expect(await child.exited, await new Response(child.stderr).text()).toBe(0)
  }
  const scan = await scanTypeScriptSource(root)
  expect(scan).toBeDefined()
  return { scan: scan!, clean: () => rm(root, { recursive: true, force: true }) }
}

/** `?`, `*` and `+` mark an optional parameter and a catch-all; `!` marks a constrained segment. */
function endpointLabel(segment: HttpEndpointSegment): string {
  if (segment.kind === 'literal') return segment.value
  const constrained = segment.constrained ? '!' : ''
  if (segment.kind === 'parameter') return `:${segment.name}${segment.optional ? '?' : ''}${constrained}`
  return `:${segment.name}${segment.optional ? '*' : '+'}${constrained}`
}

function requestLabel(segment: HttpRequestSegment): string {
  if (segment.kind === 'literal') return segment.value
  return segment.kind === 'dynamic' ? '{}' : '?'
}

function owner(scan: ScanObservation, id: string): string {
  const operation = scan.operations?.find(entry => entry.id === id)
  if (operation === undefined) throw new Error(`fact names an undeclared operation: ${id}`)
  return `${operation.file}#${operation.name}`
}

test.concurrent('every supported framework reports its served endpoints with the prefixes its source declares', async () => {
  const { scan, clean } = await scanFixture()
  try {
    const endpoints = (scan.httpEndpoints ?? []).map(endpoint => {
      return `${endpoint.method} /${endpoint.path.map(endpointLabel).join('/')} ${owner(scan, endpoint.operation)}`
    })
    // Nothing from a spread route value, a router never mounted or mounted on an unrecognized host, a
    // registrar a function receives, one the file assigns again, a clone of one, or a route registered
    // on a Hono child after its parent copied the child's routes. A route builder whose
    // handlers are not read, a mount of what the scan cannot see or under a computed prefix, a route with
    // a computed path, a registrar handed to other code and a registration member the scan does not read
    // occupy their place in the order as any remainder below their path, `:**!`. A pattern parameter and
    // text mixed with a placeholder accept only some segments, `:id!`.
    expect(endpoints.sort()).toEqual([
      '* /:**! hono-server.ts#(anonymous)',
      '* /:**! hosted-app.ts#(anonymous)',
      '* /:**! legacy-server.ts#(anonymous)',
      '* /:**! ordered-server.ts#(anonymous)',
      '* /:**! shared-routes.ts#(anonymous)',
      '* /:**! unsupported.ts#(anonymous)',
      '* /api/:**! hono-server.ts#(anonymous)',
      // Hono's trailing wildcard also matches the path without it.
      '* /legacy/:** hono-server.ts#forward',
      // A Fastify plugin the scan does not read may serve anything below its prefix, without an order.
      '* /plugins/:**! fastify-server.ts#(anonymous)',
      '* /reports/:**! ordered-server.ts#(anonymous)',
      '* /static/:**! ordered-server.ts#(anonymous)',
      '* /uploads/:*+ bun-server.ts#serveUpload',
      'GET /:**! unsupported.ts#(anonymous)',
      'GET /:*+ ordered-server.ts#fallback',
      'GET /about ordered-server.ts#showAbout',
      'GET /admin/log ordered-server.ts#showLog',
      // A router mounted next to middleware from the application's own module.
      'GET /admin/users admin-router.ts#listUsers',
      'GET /admin/users/:id! ordered-server.ts#showTalkUser',
      'GET /admin/users/:id! ordered-server.ts#showUser',
      'GET /api/rooms/:id bun-server.ts#showRoom',
      'GET /api/talks/:id talks-router.ts#showTalk',
      'GET /files/:id! unsupported.ts#handle',
      'GET /first shared-routes.ts#first',
      'GET /first two-apps.ts#first',
      'GET /health express-server.ts#(anonymous)',
      'GET /jobs/:id fastify-server.ts#runJob',
      'GET /late two-apps.ts#first',
      'GET /one hosted-routes.ts#one',
      // A chain through an Express settings call registers on the application.
      'GET /rooms legacy-server.ts#listRooms',
      'GET /second shared-routes.ts#second',
      'GET /second two-apps.ts#second',
      // An optional group of one parameter is an optional parameter.
      'GET /sessions/:id? express-server.ts#(anonymous)',
      'GET /speakers/:id nest-controller.ts#find',
      'GET /status fastify-server.ts#(anonymous)',
      'GET /talks legacy-server.ts#listTalks',
      'GET /two hosted-routes.ts#two',
      'GET /v1/rooms/:room? hono-server.ts#listRooms',
      'GET /v2/rooms/:room? hono-server.ts#listRooms',
      'POST /about ordered-server.ts#saveAbout',
      'POST /api/talks talks-router.ts#createTalk',
      'POST /jobs/:id fastify-server.ts#runJob',
      'POST /speakers nest-controller.ts#create',
      'PURGE /cache/:**! hono-server.ts#(anonymous)',
      'PUT /api/rooms/:id bun-server.ts#updateRoom',
    ])
  } finally { await clean() }
})

test.concurrent('fetch and axios requests keep every proven part and mark the rest unknown', async () => {
  const { scan, clean } = await scanFixture()
  try {
    const requests = (scan.httpRequests ?? []).map(request => {
      const url = `${request.configured ? '<base>' : ''}/${request.path.map(requestLabel).join('/')}`
      return `${request.method ?? '(unknown)'} ${url} ${owner(scan, request.operation)}`
    })
    // Nothing from a reassignable axios instance, a named axios import such as isAxiosError, or a name
    // that shadows the axios import.
    expect(requests.sort()).toEqual([
      '(unknown) /? client.ts#loadComputed',
      // A changed property is no longer its literal, and an input that is not a URL may carry a method.
      '(unknown) /? values.ts#changed',
      '(unknown) /? values.ts#requested',
      '(unknown) /api/speakers axios-client.ts#sendSpeaker',
      '(unknown) /api/talks client.ts#sendChosen',
      // An option name the scanner cannot read could be the method.
      '(unknown) /api/talks values.ts#computedKey',
      'DELETE <base>/speakers/{} axios-client.ts#removeSpeaker',
      // A request's own baseURL replaces the client's, and a host is never path text.
      'GET /?/api/talks values.ts#requestBase',
      'GET /?/talks client.ts#loadExternal',
      // Text that continues a configured value, and literal pieces that state a host, are unknown.
      'GET /?/talks values.ts#continued',
      'GET /?/talks values.ts#joinedHost',
      // An instance configured by a call has an unknown base.
      'GET /?/talks values.ts#readBase',
      // A CommonJS `require` of axios is the client too.
      'GET /api/required values.ts#viaRequire',
      'GET /api/speakers axios-client.ts#listSpeakers',
      'GET /api/talks client.ts#loadPage',
      'GET /api/talks client.ts#loadTalks',
      // The last of two properties with one name is the value the object holds.
      'GET /api/talks values.ts#duplicated',
      // A variable the program never assigns again holds its initializer.
      'GET /api/talks values.ts#fromRoot',
      'GET /api/talks/? client.ts#loadPartial',
      'GET /api/talks/{} client.ts#loadTalk',
      'GET <base>/talks client.ts#loadConfigured',
      // A global the program only declares, `declare global`, is configuration.
      'GET <base>/talks values.ts#ambientRoot',
      // A field read through `this` holds the client's own base, which is configuration.
      'GET <base>/talks/latest values.ts#latest',
      'PATCH /api/speakers/{} axios-client.ts#patchSpeaker',
      'POST /api/talks client.ts#createTalk',
      // One assignment to an instance's defaults sets its method.
      'POST /api/talks values.ts#tunedCall',
      'POST <base>/speakers axios-client.ts#saveSpeaker',
    ])
  } finally { await clean() }
})

test.concurrent('routers that take the first registered match report the order of their routes', async () => {
  const { scan, clean } = await scanFixture()
  try {
    const ordered = (scan.httpEndpoints ?? []).flatMap(endpoint => endpoint.order === undefined ? [] : [
      `${endpoint.order.application}@${endpoint.order.position} ${endpoint.method} /${endpoint.path.map(endpointLabel).join('/')}`,
    ])
    expect(ordered.sort()).toEqual([
      // A mounted router's routes take the mount's place, in the order its own file registers them. A file
      // that imports the application and hands it on runs after them, and serving it registers nothing.
      'express-server.ts@0 GET /api/talks/:id',
      'express-server.ts@1 POST /api/talks',
      'express-server.ts@2 GET /health',
      'express-server.ts@3 GET /sessions/:id?',
      'express-server.ts@4 GET /admin/users',
      'hono-server.ts@0 GET /v1/rooms/:room?',
      'hono-server.ts@1 GET /v2/rooms/:room?',
      'hono-server.ts@2 * /legacy/:**',
      // `on`, `basePath` and middleware under `*` block what they may serve, a trailing wildcard included.
      'hono-server.ts@3 PURGE /cache/:**!',
      'hono-server.ts@4 * /api/:**!',
      'hono-server.ts@5 * /:**!',
      // A hand-off in the file that creates the application, before routes another file registers, or
      // inside any statement but a top-level one, runs at a place the scan cannot order.
      'hosted-app.ts@0 * /:**!',
      'hosted-app.ts@0 GET /one',
      'hosted-app.ts@0 GET /two',
      'legacy-server.ts@0 * /:**!',
      'legacy-server.ts@0 GET /rooms',
      'legacy-server.ts@0 GET /talks',
      // NestJS behind Express registers its routes in an order the scan does not follow, so they share one.
      'nest-main.ts@0 GET /speakers/:id',
      'nest-main.ts@0 POST /speakers',
      // Routers one call mounts are tried in the order it lists them, whether or not their own order is known.
      'ordered-server.ts@0 GET /admin/users/:id!',
      'ordered-server.ts@1 GET /admin/users/:id!',
      'ordered-server.ts@2 GET /admin/log',
      'ordered-server.ts@3 * /static/:**!',
      'ordered-server.ts@4 * /reports/:**!',
      // Chained registrations run in the order they are written.
      'ordered-server.ts@5 GET /about',
      'ordered-server.ts@6 POST /about',
      // The application handed to other code may gain any route there.
      'ordered-server.ts@7 * /:**!',
      'ordered-server.ts@8 GET /:*+',
      // A hand-off in a file that registers on an application takes its place there.
      'shared-app.ts@0 GET /first',
      'shared-app.ts@1 * /:**!',
      'shared-app.ts@2 GET /second',
      // An order unknown for one of an application's registrars leaves every route there unordered. A
      // variable the program never assigns again holds its registrar, `let` included.
      'two-apps.ts@0 GET /first',
      'two-apps.ts@0 GET /late',
      'two-apps.ts@0 GET /second',
      'unsupported.ts@0 GET /:**!',
      'unsupported.ts@1 GET /files/:id!',
      'unsupported.ts@2 * /:**!',
    ])
    // Fastify and Bun.serve prefer the most specific route, so their endpoints carry no order.
    const unordered = (scan.httpEndpoints ?? []).filter(endpoint => /^(fastify|bun)-server/.test(owner(scan, endpoint.operation)))
    expect(unordered.length).toBeGreaterThan(0)
    expect(unordered.some(endpoint => endpoint.order !== undefined)).toBe(false)
  } finally { await clean() }
})

test.concurrent('an assignment to the axios defaults in another file sets the base of every request', async () => {
  const { scan, clean } = await scanFixture('typescript-axios-defaults')
  try {
    const requests = (scan.httpRequests ?? []).map(request => (
      `${request.method} ${request.configured ? '<base>' : ''}/${request.path.map(requestLabel).join('/')}`
    ))
    expect(requests).toEqual(['GET <base>/talks'])
  } finally { await clean() }
})

/** Each request as `operation method path`, with a configured base and a computed segment marked. */
function requestsIn(scan: ScanObservation, file: string): string[] {
  const operations = new Map(scan.operations?.map(operation => [operation.id, operation]))
  return (scan.httpRequests ?? []).flatMap(request => {
    const operation = operations.get(request.operation)!
    if (operation.file !== file) return []
    const url = `${request.configured ? 'configured:' : ''}/${request.path.map(segment => (
      segment.kind === 'literal' ? segment.value : `<${segment.kind}>`
    )).join('/')}`
    return [`${operation.name} ${request.method ?? 'no-method'} ${url}`]
  }).sort()
}

test.concurrent('values fold as the framework scanners fold them, whatever changes an object or a client', async () => {
  const { scan, clean } = await scanFixture('react-http')
  try {
    // A property nothing changes holds its literal. An alias, a function the object is handed to, one of
    // its methods or accessors, another file, or a module object holding it can change it: a namespace
    // import, a re-exported namespace, or a dynamic import's result. A Request carries its own method, a
    // value a call returns and a literal host are unknown, and `isAxiosError` and `post` are no clients.
    expect(requestsIn(scan, 'uncertain.tsx')).toEqual([
      'continued GET /<unknown>/talks',
      'joinedHost GET /<unknown>/talks',
      'reassignedProperty no-method /<unknown>',
      'requested no-method /<unknown>',
      'returned GET /<unknown>/talks',
      'routed GET /api/talks',
      'typedParameter no-method /<unknown>',
      'viaAccessor no-method /<unknown>',
      'viaAlias no-method /<unknown>',
      'viaArgument no-method /<unknown>',
      'viaDynamicImport no-method /<unknown>',
      'viaHandedImport no-method /<unknown>',
      'viaMethod no-method /<unknown>',
      'viaNamespace no-method /<unknown>',
      'viaOtherFile no-method /<unknown>',
      'viaReexport no-method /<unknown>',
    ])
    // A `fetch` the program declares, or imports from its own module or a package other than
    // `node-fetch`, is that function.
    expect(['shadow.tsx', 'wrapped.tsx', 'required.tsx'].flatMap(file => requestsIn(scan, file))).toEqual([])
  } finally { await clean() }
})

test.concurrent('an axios client is configured by what the program sets on its defaults', async () => {
  const { scan, clean } = await scanFixture('react-client-defaults')
  try {
    expect(requestsIn(scan, 'defaults.tsx')).toEqual([
      // The one assignment to the default client's baseURL, in another file, reads configuration.
      'defaultCall GET configured:/talks',
      // An instance copies the default client's base when it is created, which the scan cannot order.
      'inheritedCall PUT /<unknown>/talks',
      // A change to defaults other than one assignment hides the base.
      'mergedCall GET /<unknown>/talks',
      'postingCall GET /api/talks',
      // One assignment in another file sets an instance's base.
      'sharedCall GET /<unknown>/talks',
      'statedCall GET /api/talks',
      // Two assignments to one setting leave it unknown.
      'twiceCall GET /<unknown>/talks',
    ])
  } finally { await clean() }
})
