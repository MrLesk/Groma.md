import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  createScanObservation, parseScanObservation,
  type HttpEndpointSegment, type HttpRequestSegment, type ScanHttpEndpoint, type ScanHttpRequest,
  type ScanInvocation, type ScanObservation,
} from '@groma/scanner'

import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { addRelation } from '../src/relation.ts'
import { inferRelationships } from '../src/relationship-inference.ts'

const client = 'src/client.ts'
const talks = 'src/talks.ts'
const archive = 'src/archive.ts'
const files = [client, talks, archive]
const separateOwners = new Map(files.map(file => [file, file]))

interface Facts {
  httpEndpoints?: ScanHttpEndpoint[]
  httpRequests?: ScanHttpRequest[]
  invocations?: ScanInvocation[]
}

function scan(id: string, facts: Facts): ScanObservation {
  return createScanObservation({
    scanner: { id, technology: id, engine: 'fixture', engineVersion: '1' },
    roots: [{ id: 'app', kind: 'project', name: 'App' }],
    files: files.map(file => ({ file, roots: ['app'], symbols: [] })),
    operations: files.map(file => ({ id: file, file, name: 'handle' })),
    ...facts,
    diagnostics: [],
  })
}

/**
 * `:id` is a parameter, `:id?` optional, `:rest+` a catch-all and `:rest*` an optional catch-all;
 * a trailing `!` marks a constrained parameter or catch-all.
 */
function endpoint(file: string, method: string, route: string): ScanHttpEndpoint {
  const path = route.split('/').filter(Boolean).map((part): HttpEndpointSegment => {
    const variable = /^:(\w+)([?+*]?)(!?)$/.exec(part)
    if (!variable) return { kind: 'literal', value: part }
    const suffix = variable[2]
    const kind = suffix === '+' || suffix === '*' ? 'catch-all' : 'parameter'
    return {
      kind, name: variable[1]!,
      ...(suffix === '?' || suffix === '*' ? { optional: true } : {}),
      ...(variable[3] ? { constrained: true } : {}),
    }
  })
  return { operation: file, method, path }
}

/** An endpoint of a router that takes the first registered match, at its registration position. */
function registered(fact: ScanHttpEndpoint, position: number, application = 'src/server.ts'): ScanHttpEndpoint {
  return { ...fact, order: { application, position } }
}

/** `{}` is a dynamic segment and `?` unknown text; a configured base precedes the path. */
function request(method: string | undefined, url: string, configured = false): ScanHttpRequest {
  const path = url.split('/').filter(Boolean).map((part): HttpRequestSegment => {
    if (part === '{}') return { kind: 'dynamic' }
    return part === '?' ? { kind: 'unknown' } : { kind: 'literal', value: part }
  })
  return { operation: client, ...(method === undefined ? {} : { method }), ...(configured ? { configured: true } : {}), path }
}

function derive(endpoints: ScanHttpEndpoint[], requests: ScanHttpRequest[], owners = separateOwners) {
  return inferRelationships([scan('server', { httpEndpoints: endpoints }), scan('client', { httpRequests: requests })], owners)
}

const matches: [string, ScanHttpEndpoint[], ScanHttpRequest, string][] = [
  ['a literal path', [endpoint(talks, 'GET', '/talks')], request('GET', '/talks'), 'GET /talks'],
  ['a dynamic value in a parameter', [endpoint(talks, 'GET', '/talks/:id')], request('GET', '/talks/{}'), 'GET /talks/:id'],
  ['a literal in a parameter', [endpoint(talks, 'DELETE', '/talks/:id')], request('DELETE', '/talks/7'), 'DELETE /talks/:id'],
  ['a configured base', [endpoint(talks, 'GET', '/talks')], request('GET', '/talks', true), 'GET /talks'],
  ['a prefix only the request states', [endpoint(talks, 'GET', '/talks/:id')], request('GET', '/api/talks/{}'), 'GET /talks/:id'],
  ['a prefix only the endpoint states', [endpoint(talks, 'GET', '/api/talks')], request('GET', '/talks', true), 'GET /api/talks'],
  ['an omitted optional parameter', [endpoint(talks, 'GET', '/talks/:page?')], request('GET', '/talks'), 'GET /talks/:page?'],
  ['a present optional parameter', [endpoint(talks, 'GET', '/talks/:page?/all')], request('GET', '/talks/2/all'), 'GET /talks/:page?/all'],
  ['a catch-all remainder', [endpoint(talks, 'GET', '/files/:path+')], request('GET', '/files/a/{}'), 'GET /files/:path+'],
  ['an empty optional catch-all', [endpoint(talks, 'GET', '/files/:path*')], request('GET', '/files'), 'GET /files/:path*'],
  ['a file-location endpoint for every method', [endpoint(talks, '*', '/talks/:id')], request('PUT', '/talks/{}'), 'PUT /talks/:id'],
  ['a literal segment that differs only in case', [endpoint(talks, 'GET', '/api/Talks')], request('GET', '/api/talks'), 'GET /api/Talks'],
  ['a literal sibling of a parameter route in the same file',
    [endpoint(talks, 'GET', '/ratings/top'), endpoint(talks, 'GET', '/ratings/:token')],
    request('GET', '/ratings/top'), 'GET /ratings/top'],
  ['a specific path before another file\'s fallback route',
    [endpoint(talks, 'GET', '/api/account'), endpoint(archive, 'GET', '/:path1/:path2')],
    request('GET', '/api/account'), 'GET /api/account'],
  ['a literal path before another file\'s any-method parameter route',
    [endpoint(talks, 'GET', '/talks'), endpoint(archive, '*', '/:page')], request('GET', '/talks'), 'GET /talks'],
  ['a dropped prefix before a segment that differs only in case',
    [endpoint(talks, 'GET', '/Talks/:id')], request('GET', '/api/talks/{}'), 'GET /Talks/:id'],
  ['an exact path before a prefixed one in another file',
    [endpoint(talks, 'GET', '/api/talks'), endpoint(archive, 'GET', '/talks')], request('GET', '/api/talks'), 'GET /api/talks'],
  ['a literal path before a fallback catch-all in another file',
    [endpoint(talks, 'GET', '/talks'), endpoint(archive, 'GET', '/:rest+')], request('GET', '/talks'), 'GET /talks'],
  ['a parameter before a fallback catch-all in another file',
    [endpoint(talks, 'GET', '/talks/:id'), endpoint(archive, '*', '/talks/:rest+')], request('GET', '/talks/9'), 'GET /talks/:id'],
  ['a path that ends before another file\'s unused optional parameter',
    [endpoint(talks, 'GET', '/talks'), endpoint(archive, 'GET', '/talks/:page?')], request('GET', '/talks'), 'GET /talks'],
  ['the root path before another file\'s empty optional catch-all',
    [endpoint(talks, 'GET', '/'), endpoint(archive, 'GET', '/:rest*')], request('GET', '/'), 'GET /'],
  ['a path that ends before an unused optional parameter in the same file',
    [endpoint(talks, 'GET', '/talks'), endpoint(talks, 'GET', '/talks/:page?')], request('GET', '/talks'), 'GET /talks'],
  ['a parameter route whose literal sibling is in the same file',
    [endpoint(talks, 'GET', '/talks/:id'), endpoint(talks, 'GET', '/talks/archive')], request('GET', '/talks/{}'), 'GET /talks/:id'],
  ['a dynamic value in a constrained parameter', [endpoint(talks, 'GET', '/talks/:id!')], request('GET', '/talks/{}'), 'GET /talks/:id'],
  ['an exact route beside another application\'s fallback in one repository',
    [registered(endpoint(talks, 'GET', '/api/talks'), 3, 'api/server.ts'), registered(endpoint(archive, 'GET', '/:rest*'), 0, 'web/server.ts')],
    request('GET', '/api/talks'), 'GET /api/talks'],
  ['a literal route beside a constrained parameter in another file',
    [endpoint(talks, 'GET', '/talks/archive'), endpoint(archive, 'GET', '/talks/:id!')], request('GET', '/talks/archive'),
    'GET /talks/archive'],
  ['a literal path before another file\'s constrained fallback route',
    [endpoint(talks, 'GET', '/api/account'), endpoint(archive, 'GET', '/:path1!/:path2!')], request('GET', '/api/account'),
    'GET /api/account'],
  ['a route registered before an unreadable route in the same file',
    [registered(endpoint(talks, 'GET', '/api/talks'), 0), registered(endpoint(talks, '*', '/api/:rest*!'), 1)],
    request('GET', '/api/talks'), 'GET /api/talks'],
  ['a removed request prefix beside an unreadable route under another prefix',
    [registered(endpoint(archive, '*', '/static/:rest*!'), 0), registered(endpoint(talks, 'POST', '/talks'), 2)],
    request('POST', '/api/talks'), 'POST /talks'],
  ['a literal path beside an unreadable route that its first differing segment beats',
    [endpoint(talks, 'GET', '/api/talks'), endpoint(archive, '*', '/api/:rest*!')], request('GET', '/api/talks'), 'GET /api/talks'],
  ['a route registered before a constrained route in another file',
    [registered(endpoint(talks, 'GET', '/files/:dir/:name'), 0), registered(endpoint(archive, 'GET', '/files/:path*!'), 1)],
    request('GET', '/files/a/report.json'), 'GET /files/:dir/:name'],
  ['the first registered match in a first-match application',
    [registered(endpoint(talks, '*', '/:name'), 0), registered(endpoint(archive, '*', '/talks'), 1)], request('GET', '/talks'), 'GET /:name'],
  ['a parameter route registered before a literal sibling in another file',
    [registered(endpoint(talks, 'GET', '/talks/:id'), 0), registered(endpoint(archive, 'GET', '/talks/archive'), 1)],
    request('GET', '/talks/archive'), 'GET /talks/:id'],
  ['a route registered before a fallback in another file',
    [registered(endpoint(talks, 'GET', '/api/talks/:id'), 0), registered(endpoint(archive, 'GET', '/:rest*'), 1)],
    request('GET', '/api/talks/{}'), 'GET /api/talks/:id'],
  ['an exact path before a prefixed one registered earlier',
    [registered(endpoint(archive, 'GET', '/talks'), 0), registered(endpoint(talks, 'GET', '/api/talks'), 1)],
    request('GET', '/api/talks'), 'GET /api/talks'],
  ['a parameter route registered before a literal sibling in the same file',
    [registered(endpoint(talks, 'GET', '/users/:id'), 0), registered(endpoint(talks, 'GET', '/users/me'), 1)],
    request('GET', '/users/me'), 'GET /users/:id'],
]

for (const [name, endpoints, sent, label] of matches) {
  test.concurrent(`a request reaches ${name}`, () => {
    expect(derive(endpoints, [sent])).toEqual([{
      source: client, target: talks, description: `Calls HTTP endpoint: ${label}`,
      technology: 'client, server', status: 'stable', authored: false,
    }])
  })
}

const abstentions: [string, ScanHttpEndpoint[], ScanHttpRequest][] = [
  ['a different method', [endpoint(talks, 'GET', '/talks')], request('POST', '/talks')],
  ['an unknown method', [endpoint(talks, '*', '/talks')], request(undefined, '/talks')],
  ['a partly known segment', [endpoint(talks, 'GET', '/talks/:id')], request('GET', '/talks/?')],
  ['an unknown remainder', [endpoint(talks, 'GET', '/talks/:rest+')], request('GET', '/talks/?')],
  ['a literal host, reported as a leading unknown segment', [endpoint(talks, 'GET', '/talks')], request('GET', '/?/talks')],
  ['a configured base with no path of its own', [endpoint(talks, 'GET', '/')], request('GET', '/', true)],
  ['a configured base before a dynamic segment', [endpoint(talks, 'GET', '/:slug')], request('GET', '/{}', true)],
  ['a dynamic value against a literal', [endpoint(talks, 'GET', '/talks/archive')], request('GET', '/talks/{}')],
  ['a sibling literal path in another file',
    [endpoint(talks, 'GET', '/talks/:id'), endpoint(archive, 'GET', '/talks/archive')], request('GET', '/talks/{}')],
  ['endpoints in several files', [endpoint(talks, 'GET', '/talks/:id'), endpoint(archive, 'GET', '/talks/:slug')], request('GET', '/talks/1')],
  ['different leading segments on both sides', [endpoint(talks, 'GET', '/v1/talks')], request('GET', '/api/talks')],
  ['a two-segment prefix', [endpoint(talks, 'GET', '/talks')], request('GET', '/api/v1/talks')],
  ['paths in two files that differ only in case',
    [endpoint(talks, 'GET', '/api/Talks'), endpoint(archive, 'GET', '/api/talks')], request('GET', '/api/talks')],
  ['a dynamic leading request segment', [endpoint(talks, 'GET', '/talks')], request('GET', '/{}/talks')],
  ['a leading endpoint parameter', [endpoint(talks, 'GET', '/:tenant/talks')], request('GET', '/talks')],
  ['a prefix followed by a parameter', [endpoint(talks, 'GET', '/api/:id')], request('GET', '/talks')],
  ['a prefix that leaves nothing to compare', [endpoint(talks, 'GET', '/')], request('GET', '/talks')],
  ['a catch-all without its required remainder', [endpoint(talks, 'GET', '/files/:path+')], request('GET', '/files')],
  ['a literal that a constrained parameter may reject', [endpoint(talks, 'GET', '/talks/:id!')], request('GET', '/talks/abc')],
  ['a literal that a constrained parameter may accept before another file\'s fallback',
    [endpoint(talks, 'GET', '/:page+'), endpoint(archive, 'GET', '/talks/:id!')], request('GET', '/talks/7')],
  ['a remainder that a constrained catch-all may reject', [endpoint(talks, 'GET', '/files/:rest+!')], request('GET', '/files/{}')],
  ['a fallback in another file registered in unknown order',
    [registered(endpoint(talks, 'GET', '/api/talks'), 0), registered(endpoint(archive, 'GET', '/:rest*'), 0)], request('GET', '/api/talks')],
  ['two routes in one file registered in unknown order',
    [registered(endpoint(talks, 'GET', '/users/me'), 0), registered(endpoint(talks, 'GET', '/users/:id'), 0)], request('GET', '/users/me')],
  ['a literal in another file registered before the reached parameter',
    [registered(endpoint(archive, 'GET', '/talks/archive'), 0), registered(endpoint(talks, 'GET', '/talks/:id'), 1)],
    request('GET', '/talks/{}')],
  ['a literal registered at the same position as the reached parameter',
    [registered(endpoint(talks, 'GET', '/talks/:id'), 0), registered(endpoint(archive, 'GET', '/talks/archive'), 0)],
    request('GET', '/talks/{}')],
  ['paths that removed different leading segments in one application',
    [registered(endpoint(archive, 'GET', '/v1/talks/:id'), 1), registered(endpoint(talks, 'GET', '/v2/talks/:id'), 0)],
    request('GET', '/talks/{}', true)],
  ['a removed request prefix beside a removed endpoint prefix in one application',
    [registered(endpoint(talks, 'GET', '/talks'), 1), registered(endpoint(archive, 'GET', '/v1/api/talks'), 0)],
    request('GET', '/api/talks')],
  ['paths that removed different leading segments',
    [endpoint(talks, 'GET', '/v1/talks/archive'), endpoint(archive, 'GET', '/v2/talks/:id')], request('GET', '/talks/archive', true)],
  ['a removed request prefix beside a removed endpoint prefix',
    [endpoint(talks, 'GET', '/talks'), endpoint(archive, 'GET', '/v1/api/talks')], request('GET', '/api/talks')],
  ['an exact fallback catch-all beside a path that removed a prefix',
    [endpoint(archive, 'GET', '/:rest*'), endpoint(talks, 'GET', '/talks')], request('GET', '/api/talks')],
  ['an optional constrained parameter in another file that its router may try first',
    [endpoint(talks, 'GET', '/blog/:slug'), endpoint(archive, 'GET', '/blog/:year?!/:slug?')], request('GET', '/blog/{}')],
  ['a literal that an optional constrained parameter in another file may accept',
    [endpoint(talks, 'GET', '/blog/:slug'), endpoint(archive, 'GET', '/blog/:year?!/:slug?')], request('GET', '/blog/2024')],
  ['a constrained parameter in another file that its router may rank first before a shared literal',
    [endpoint(talks, 'GET', '/api/:x/talks'), endpoint(archive, 'GET', '/api/:y!/:z')], request('GET', '/api/v/talks')],
  ['an unreadable route under a prefix beside another application\'s parameter route',
    [registered(endpoint(archive, '*', '/api/:rest*!'), 0, 'src/main.rs'), endpoint(talks, 'GET', '/:category/:slug')],
    request('GET', '/api/talks')],
  ['a constrained catch-all in the file of the reached parameter route',
    [endpoint(talks, 'GET', '/files/:dir/:name'), endpoint(talks, 'GET', '/files/:path*!')], request('GET', '/files/a/report.json')],
  ['a configured request under an unreadable mount registered first',
    [registered(endpoint(archive, '*', '/api/:rest*!'), 0), registered(endpoint(talks, 'GET', '/api/talks'), 1)],
    request('GET', '/talks', true)],
  ['a fallback registered after an unreadable mount in the same file',
    [registered(endpoint(talks, '*', '/api/:rest*!'), 0), registered(endpoint(talks, 'GET', '/:rest*'), 1)], request('GET', '/api/talks')],
  ['a constrained catch-all in another file that its router may try first',
    [endpoint(talks, 'GET', '/files/:dir/:name'), endpoint(archive, 'GET', '/files/:path*!')], request('GET', '/files/a/report.json')],
  ['an unreadable route registered earlier in another file',
    [registered(endpoint(archive, '*', '/api/:rest*!'), 0), registered(endpoint(talks, 'GET', '/api/talks'), 1)], request('GET', '/api/talks')],
  ['a constrained parameter beside a catch-all in another file',
    [endpoint(talks, 'GET', '/talks/:id!'), endpoint(archive, 'GET', '/talks/:rest+')], request('GET', '/talks/{}')],
  ['a constrained parameter registered before a parameter route in another file',
    [registered(endpoint(talks, 'GET', '/talks/:id!'), 0), registered(endpoint(archive, 'GET', '/talks/:slug'), 1)],
    request('GET', '/talks/{}')],
  ['routes of two applications in one repository',
    [registered(endpoint(talks, 'GET', '/api/talks'), 3, 'api/server.ts'), registered(endpoint(archive, 'GET', '/api/:section'), 0, 'web/server.ts')],
    request('GET', '/api/talks')],
  ['a first-match route beside a most-specific route',
    [endpoint(talks, 'GET', '/api/talks'), registered(endpoint(archive, 'GET', '/api/:section'), 0)], request('GET', '/api/talks')],
  ['a route registered after an unreadable root route of its application',
    [registered(endpoint(archive, '*', '/:rest*!'), 0), registered(endpoint(talks, 'GET', '/api/talks'), 1)], request('GET', '/api/talks')],
  ['a literal in another file that a dynamic segment could reach after a dropped prefix',
    [endpoint(talks, 'GET', '/api/talks/:id/:section'), endpoint(archive, 'GET', '/archive/details')], request('GET', '/talks/{}/details')],
]

for (const [name, endpoints, sent] of abstentions) {
  test.concurrent(`a request derives no row for ${name}`, () => {
    expect(derive(endpoints, [sent])).toEqual([])
  })
}

test.concurrent('files that share an owner or lack one derive no row', () => {
  const endpoints = [endpoint(talks, 'GET', '/talks')]
  const sent = [request('GET', '/talks')]
  expect(derive(endpoints, sent, new Map([[client, 'site'], [talks, 'site']]))).toEqual([])
  expect(derive(endpoints, sent, new Map([[client, 'site']]))).toEqual([])
})

test.concurrent('one file pair lists every reached endpoint once with every contributing scanner', () => {
  const server = scan('server', { httpEndpoints: [endpoint(talks, 'GET', '/talks'), endpoint(talks, 'POST', '/talks')] })
  const pages = scan('pages', { httpEndpoints: [endpoint(talks, 'GET', '/talks')] })
  const requests = scan('client', { httpRequests: [request('POST', '/talks'), request('GET', '/talks'), request('GET', '/api/talks')] })
  const rows = inferRelationships([requests, pages, server], separateOwners)
  expect(rows).toEqual([expect.objectContaining({
    source: client, target: talks, technology: 'client, pages, server',
  })])
  expect(rows[0]!.description.split(': ')[1]?.split(', ')).toEqual(['GET /talks', 'POST /talks'])
  expect(inferRelationships([server, requests, pages], separateOwners)).toEqual(rows)
})

test.concurrent('an optional catch-all beside a controller\'s routes takes no request those routes end on', () => {
  const endpoints = [
    endpoint(talks, 'GET', '/api/Talks'), endpoint(talks, 'GET', '/api/Talks/:id'),
    endpoint(talks, 'POST', '/api/Talks/:id?'), endpoint(talks, 'GET', '/api/Talks/:slug*'),
  ]
  const sent = [request('GET', '/api/talks'), request('GET', '/api/talks/{}'), request('POST', '/api/talks')]
  expect(derive(endpoints, sent).map(row => row.description))
    .toEqual(['Calls HTTP endpoints: GET /api/Talks, GET /api/Talks/:id, POST /api/Talks/:id?'])
})

test.concurrent('registration positions from different scanners are not compared', () => {
  const rows = inferRelationships([
    scan('javascript', { httpEndpoints: [registered(endpoint(archive, 'GET', '/api/:section'), 0)] }),
    scan('typescript', { httpEndpoints: [registered(endpoint(talks, 'GET', '/api/talks'), 1)] }),
    scan('client', { httpRequests: [request('GET', '/api/talks')] }),
  ], separateOwners)
  expect(rows).toEqual([])
})

test.concurrent('a catch-all of one application takes no request another application\'s route reaches directly', () => {
  const client = scan('client', { httpRequests: [request('GET', '/api/talks')] })
  const api = [registered(endpoint(talks, 'GET', '/api/talks'), 3, 'src/server.ts')]
  const blocker = scan('rust', { httpEndpoints: [registered(endpoint(archive, '*', '/:rest*!'), 0, 'src/main.rs')] })
  const page = scan('react', { httpEndpoints: [endpoint(archive, 'GET', '/:slug+')] })
  for (const other of [blocker, page]) {
    const rows = inferRelationships([other, scan('typescript', { httpEndpoints: api }), client], separateOwners)
    expect(rows).toEqual([expect.objectContaining({ target: talks, description: 'Calls HTTP endpoint: GET /api/talks' })])
  }
  const spring = scan('java', { httpEndpoints: [endpoint(talks, 'GET', '/api/talks')] })
  expect(inferRelationships([blocker, spring, client], separateOwners)).toEqual([expect.objectContaining({ target: talks })])
})

test.concurrent('a callback and an HTTP request between the same files share one derived row', () => {
  const invocation: ScanInvocation = {
    source: client, targets: [talks], unresolved: false, line: 1, member: 'saved', binding: { file: archive, line: 1 },
  }
  const rows = inferRelationships([
    scan('client', { invocations: [invocation], httpRequests: [request('GET', '/talks')] }),
    scan('server', { httpEndpoints: [endpoint(talks, 'GET', '/talks')] }),
  ], separateOwners)
  expect(rows).toEqual([expect.objectContaining({ source: client, target: talks, technology: 'client, server' })])
  expect(rows[0]!.description.split('; ')).toHaveLength(2)
})

test.concurrent('HTTP facts survive JSON exchange and reject input core cannot match exactly', () => {
  const observation = scan('fixture', {
    httpEndpoints: [registered(endpoint(talks, '*', '/talks/:id?!/:rest+'), 2)],
    httpRequests: [request(undefined, '/talks/{}/?', true)],
  })
  expect(parseScanObservation(JSON.stringify(observation))).toEqual(observation)
  const invalid = (facts: Record<string, unknown>) => () => parseScanObservation(JSON.stringify({ ...observation, ...facts }))
  const literal = (value: string) => ({ httpRequests: [{ ...request('GET', '/'), path: [{ kind: 'literal', value }] }] })
  expect(invalid(literal('talks?page=1'))).toThrow('URL path characters')
  expect(invalid(literal('api/talks'))).toThrow('URL path characters')
  expect(invalid(literal(''))).toThrow('URL path characters')
  expect(invalid({ httpEndpoints: [endpoint(talks, 'GET', '/:rest+/talks')] })).toThrow('must be last')
  expect(invalid({ httpEndpoints: [endpoint(talks, 'get', '/talks')] })).toThrow('uppercase HTTP method')
  expect(invalid({ httpRequests: [request('*', '/talks')] })).toThrow('uppercase HTTP method')
  expect(invalid({ httpRequests: [{ ...request('GET', '/talks'), configured: 'yes' }] })).toThrow('configured')
  const loose = { ...endpoint(talks, 'GET', '/'), path: [{ kind: 'parameter', name: 'id', constrained: 'int' }] }
  expect(invalid({ httpEndpoints: [loose] })).toThrow('constrained')
  expect(invalid({ httpEndpoints: [registered(endpoint(talks, 'GET', '/'), 1.5)] })).toThrow('nonnegative integer')
  expect(invalid({ httpEndpoints: [registered(endpoint(talks, 'GET', '/'), 0, '')] })).toThrow('nonempty')
  expect(invalid({ httpRequests: [{ ...request('GET', '/talks'), operation: 'missing' }] })).toThrow('unknown operation')
  expect(invalid({ operations: undefined, httpRequests: [request('GET', '/talks')] })).toThrow('require operation declarations')
})

async function repository(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-http-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  await mkdir(path.join(root, 'src'))
  for (const file of files) await writeFile(path.join(root, file), 'export function handle() {}\n')
  return root
}

test.concurrent('scans store derived HTTP rows, keep them while a contributing scanner is absent, and let authored text take precedence', async () => {
  const root = await repository()
  try {
    const server = scan('server', { httpEndpoints: [endpoint(talks, 'GET', '/talks/:id')] })
    const browser = scan('client', { httpRequests: [request('GET', '/api/talks/{}', true)] })
    await reconcileScanObservations(root, [server, browser])
    const derived = await loadAnnotatedArchitecture(root)
    expect(derived.relationships).toEqual([expect.objectContaining({
      description: 'Calls HTTP endpoint: GET /talks/:id', technology: 'client, server',
    })])
    const stored = await readFile(path.join(root, 'groma/relationships.md'), 'utf8')
    await reconcileScanObservations(root, [browser])
    expect(await readFile(path.join(root, 'groma/relationships.md'), 'utf8')).toBe(stored)
    await addRelation(root, { source: client, target: talks, description: 'Loads a talk', technology: 'REST' })
    await reconcileScanObservations(root, [server, browser])
    const authored = await loadAnnotatedArchitecture(root)
    expect(authored.relationships).toHaveLength(1)
    expect(authored.relationships[0]!.connections?.map(connection => connection.authored)).toEqual([true])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a literal segment with Markdown characters is escaped in the row and restored from storage', async () => {
  const endpoints = [endpoint(talks, 'GET', '/__debug__/:id')]
  const sent = [request('GET', '/__debug__/{}')]
  expect(derive(endpoints, sent)[0]!.description).toBe('Calls HTTP endpoint: GET /\\_\\_debug\\_\\_/:id')
  const root = await repository()
  try {
    await reconcileScanObservations(root, [scan('server', { httpEndpoints: endpoints }), scan('client', { httpRequests: sent })])
    const model = await loadAnnotatedArchitecture(root)
    expect(model.relationships[0]!.description).toBe('Calls HTTP endpoint: GET /__debug__/:id')
  } finally { await rm(root, { recursive: true, force: true }) }
})
