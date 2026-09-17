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

/** `:id` is a parameter, `:id?` optional, `:rest+` a catch-all and `:rest*` an optional catch-all. */
function endpoint(file: string, method: string, route: string): ScanHttpEndpoint {
  const path = route.split('/').filter(Boolean).map((part): HttpEndpointSegment => {
    const variable = /^:(\w+)([?+*]?)$/.exec(part)
    if (!variable) return { kind: 'literal', value: part }
    const suffix = variable[2]
    const kind = suffix === '+' || suffix === '*' ? 'catch-all' : 'parameter'
    return { kind, name: variable[1]!, ...(suffix === '?' || suffix === '*' ? { optional: true } : {}) }
  })
  return { operation: file, method, path }
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
  ['an exact path before a prefixed one in another file',
    [endpoint(talks, 'GET', '/api/talks'), endpoint(archive, 'GET', '/talks')], request('GET', '/api/talks'), 'GET /api/talks'],
  ['a literal path before a fallback catch-all in another file',
    [endpoint(talks, 'GET', '/talks'), endpoint(archive, 'GET', '/:rest+')], request('GET', '/talks'), 'GET /talks'],
  ['a parameter before a fallback catch-all in another file',
    [endpoint(talks, 'GET', '/talks/:id'), endpoint(archive, '*', '/talks/:rest+')], request('GET', '/talks/9'), 'GET /talks/:id'],
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
  ['an any-method endpoint in another file', [endpoint(talks, 'GET', '/talks'), endpoint(archive, '*', '/:page')], request('GET', '/talks')],
  ['different leading segments on both sides', [endpoint(talks, 'GET', '/v1/talks')], request('GET', '/api/talks')],
  ['a two-segment prefix', [endpoint(talks, 'GET', '/talks')], request('GET', '/api/v1/talks')],
  ['a dynamic leading request segment', [endpoint(talks, 'GET', '/talks')], request('GET', '/{}/talks')],
  ['a leading endpoint parameter', [endpoint(talks, 'GET', '/:tenant/talks')], request('GET', '/talks')],
  ['a prefix followed by a parameter', [endpoint(talks, 'GET', '/api/:id')], request('GET', '/talks')],
  ['a prefix that leaves nothing to compare', [endpoint(talks, 'GET', '/')], request('GET', '/talks')],
  ['a catch-all without its required remainder', [endpoint(talks, 'GET', '/files/:path+')], request('GET', '/files')],
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
    httpEndpoints: [endpoint(talks, '*', '/talks/:id?/:rest+')],
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
