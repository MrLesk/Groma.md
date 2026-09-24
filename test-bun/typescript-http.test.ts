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

/**
 * Each endpoint as `application@position method path owner`, ordered by application and position; an
 * endpoint of a router that states no order has no `application@position`.
 */
function endpointTable(scan: ScanObservation): string[] {
  const rows = (scan.httpEndpoints ?? []).map(endpoint => ({
    application: endpoint.order?.application ?? '',
    position: endpoint.order?.position ?? -1,
    line: `${endpoint.order === undefined ? '' : `${endpoint.order.application}@${endpoint.order.position} `}`
      + `${endpoint.method} /${endpoint.path.map(endpointLabel).join('/')} ${owner(scan, endpoint.operation)}`,
  }))
  rows.sort((left, right) => left.application.localeCompare(right.application) || left.position - right.position
    || left.line.localeCompare(right.line))
  return rows.map(row => row.line)
}

test.concurrent('every supported framework reports its served endpoints in the order its router tries them', async () => {
  const { scan, clean } = await scanFixture()
  try {
    // Nothing from a spread route value, a router never mounted or mounted on an unrecognized host, a
    // registrar a function receives, one the file assigns again, a clone of one, or a route registered
    // on a Hono child after its parent copied the child's routes. A route builder whose handlers are not
    // read, a mount of what the scan cannot see or under a computed prefix, a route with a computed path,
    // a registrar handed to other code and a registration member the scan does not read occupy their
    // place in the order as any remainder below their path, `:**!`. A pattern parameter and text mixed
    // with a placeholder accept only some segments, `:id!`.
    expect(endpointTable(scan)).toEqual([
      // Fastify and Bun.serve prefer the most specific route, so their endpoints, and a Fastify plugin's
      // block below its prefix, carry no order.
      '* /plugins/:**! fastify-server.ts#(anonymous)',
      '* /uploads/:*+ bun-server.ts#serveUpload',
      'GET /api/rooms/:id bun-server.ts#showRoom',
      'GET /jobs/:id fastify-server.ts#runJob',
      'GET /status fastify-server.ts#(anonymous)',
      'POST /jobs/:id fastify-server.ts#runJob',
      'PUT /api/rooms/:id bun-server.ts#updateRoom',
      // An application is its file and the variable that holds it. A mounted router's routes take the
      // mount's place, in the order its own file registers them, and a function from the application's
      // own module is middleware: alone, under a path, or beside a router. A file that imports the
      // application and hands it on runs after them, and serving it registers nothing. An optional group
      // of one parameter is an optional parameter.
      'express-server.ts#app@0 GET /api/talks/:id talks-router.ts#showTalk',
      'express-server.ts#app@1 POST /api/talks talks-router.ts#createTalk',
      'express-server.ts#app@2 GET /health express-server.ts#(anonymous)',
      'express-server.ts#app@3 GET /sessions/:id? express-server.ts#(anonymous)',
      'express-server.ts#app@4 GET /admin/users admin-router.ts#listUsers',
      // Hono's trailing wildcard also matches the path without it; `on` and `basePath` block what they may
      // serve, while `use` only adds middleware, whatever its handler, so it takes no place.
      'hono-server.ts#site@0 GET /v1/rooms/:room? hono-server.ts#listRooms',
      'hono-server.ts#site@1 GET /v2/rooms/:room? hono-server.ts#listRooms',
      'hono-server.ts#site@2 * /legacy/:** hono-server.ts#forward',
      'hono-server.ts#site@3 PURGE /cache/:**! hono-server.ts#(anonymous)',
      'hono-server.ts#site@4 * /api/:**! hono-server.ts#(anonymous)',
      // A child from another module has its top-level routes before the file that imports it runs.
      'hono-server.ts#site@5 GET /shop/items hono-routes.ts#listItems',
      // A hand-off in the file that creates the application, before routes another file registers, or
      // inside any statement but a top-level one, runs at a place the scan cannot order.
      'hosted-app.ts#hosted@0 * /:**! hosted-app.ts#(anonymous)',
      'hosted-app.ts#hosted@0 GET /one hosted-routes.ts#one',
      'hosted-app.ts#hosted@0 GET /two hosted-routes.ts#two',
      'legacy-server.ts#app@0 * /:**! legacy-server.ts#(anonymous)',
      'legacy-server.ts#app@0 GET /rooms legacy-server.ts#listRooms',
      'legacy-server.ts#app@0 GET /talks legacy-server.ts#listTalks',
      // NestJS behind Express registers its routes in an order the scan does not follow, so they share
      // one; a computed controller path blocks every route below it, and a computed route its own.
      // A controller path may be an option or a string enum member.
      'nest-main.ts@0 GET /:**! nest-controller.ts#list',
      'nest-main.ts@0 GET /rooms/:id nest-options.ts#find',
      'nest-main.ts@0 GET /speakers/:id nest-controller.ts#find',
      'nest-main.ts@0 GET /talks/:**! nest-controller.ts#find',
      'nest-main.ts@0 GET /votes nest-options.ts#list',
      'nest-main.ts@0 POST /speakers nest-controller.ts#create',
      // Routers one call mounts are tried in the order it lists them, chained registrations in the order
      // they are written, and an application handed to other code may gain any route there.
      'ordered-server.ts#app@0 GET /admin/users/:id! ordered-server.ts#showUser',
      'ordered-server.ts#app@1 GET /admin/users/:id! ordered-server.ts#showTalkUser',
      'ordered-server.ts#app@2 GET /admin/log ordered-server.ts#showLog',
      'ordered-server.ts#app@3 * /static/:**! ordered-server.ts#(anonymous)',
      'ordered-server.ts#app@4 * /reports/:**! ordered-server.ts#(anonymous)',
      'ordered-server.ts#app@5 GET /about ordered-server.ts#showAbout',
      'ordered-server.ts#app@6 POST /about ordered-server.ts#saveAbout',
      'ordered-server.ts#app@7 * /:**! ordered-server.ts#(anonymous)',
      'ordered-server.ts#app@8 GET /:*+ ordered-server.ts#fallback',
      // A hand-off in a file that registers on an application takes its place there.
      'shared-app.ts#shared@0 GET /first shared-routes.ts#first',
      'shared-app.ts#shared@1 * /:**! shared-routes.ts#(anonymous)',
      'shared-app.ts#shared@2 GET /second shared-routes.ts#second',
      // Two applications of one file keep their own orders; a registration inside a function leaves its
      // application's order unknown, and a `let` the program never assigns again holds its registrar.
      'two-apps.ts#late@0 GET /late two-apps.ts#first',
      'two-apps.ts#main@0 GET /first two-apps.ts#first',
      'two-apps.ts#main@1 GET /second two-apps.ts#second',
      // A computed segment blocks from the last whole segment before it, a remainder pattern is a
      // catch-all, and a pattern that may span segments blocks from its place.
      'unsupported.ts#patterns@0 GET /:**! unsupported.ts#(anonymous)',
      'unsupported.ts#patterns@1 GET /files/:id! unsupported.ts#handle',
      'unsupported.ts#patterns@2 * /:**! unsupported.ts#(anonymous)',
      'unsupported.ts#patterns@3 GET /versions/:**! unsupported.ts#(anonymous)',
      'unsupported.ts#patterns@4 GET /assets/:rest+ unsupported.ts#handle',
      'unsupported.ts#patterns@5 GET /archives/:name*! unsupported.ts#handle',
      // Express 5's optional wildcard may match nothing more; a group before more path blocks from its place.
      'unsupported.ts#patterns@6 GET /files/:path* unsupported.ts#handle',
      'unsupported.ts#patterns@7 GET /users/:**! unsupported.ts#handle',
    ])
  } finally { await clean() }
})

test.concurrent('NestJS behind a FastifyAdapter prefers the most specific route and states no order', async () => {
  const { scan, clean } = await scanFixture('typescript-nest-fastify')
  try {
    // A program that compiles the controller without the file creating the application states nothing else,
    // whether the controller's own library config or a check outside every config.
    expect(endpointTable(scan)).toEqual(['GET /speakers/:id library/controller.ts#find'])
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
      // An input that is not a URL may carry a method.
      '(unknown) /? values.ts#requested',
      '(unknown) /api/speakers axios-client.ts#sendSpeaker',
      '(unknown) /api/talks client.ts#sendChosen',
      // An option name the scanner cannot read could be the method.
      '(unknown) /api/talks values.ts#computedKey',
      'DELETE <base>/speakers/{} axios-client.ts#removeSpeaker',
      // A string the scan cannot read is still a URL, which carries no method; a changed property is no
      // longer its literal.
      'GET /? client.ts#loadComputed',
      'GET /? values.ts#changed',
      // A request's own baseURL replaces the client's, and a host is never path text.
      'GET /?/api/talks values.ts#requestBase',
      // A field a subclass declares again, or a write through any object assigns again, is unknown.
      'GET /?/guests values.ts#guests',
      'GET /?/rooms values.ts#rooms',
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
      // A field read through `this` holds its one assignment.
      'GET /api/talks/latest values.ts#latest',
      'GET /api/talks/{} client.ts#loadTalk',
      'GET <base>/talks client.ts#loadConfigured',
      // A global the program only declares, `declare global`, is configuration.
      'GET <base>/talks values.ts#ambientRoot',
      'PATCH /api/speakers/{} axios-client.ts#patchSpeaker',
      'POST /api/talks client.ts#createTalk',
      // One assignment to an instance's defaults sets its method.
      'POST /api/talks values.ts#tunedCall',
      'POST <base>/speakers axios-client.ts#saveSpeaker',
    ])
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
      'reassignedProperty GET /<unknown>',
      'requested no-method /<unknown>',
      'returned GET /<unknown>/talks',
      'routed GET /api/talks',
      'typedParameter GET /<unknown>',
      'viaAccessor GET /<unknown>',
      'viaAlias GET /<unknown>',
      'viaArgument GET /<unknown>',
      'viaDynamicImport GET /<unknown>',
      'viaHandedImport GET /<unknown>',
      'viaMethod GET /<unknown>',
      'viaNamespace GET /<unknown>',
      'viaOtherFile GET /<unknown>',
      'viaReexport GET /<unknown>',
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
