import { expect, test } from 'bun:test'
import { cp, mkdtemp, readdir, rename, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  createScanObservation,
  type HttpEndpointSegment, type ScanHttpEndpoint, type ScanObservation, type ScannerPlugin,
} from '@groma/scanner'
import { buildPackage } from '../plugins/scanners/angular/build.ts'
import manifest from '../plugins/scanners/angular/package.json'
import { inferRelationships } from '../src/relationship-inference.ts'
import { scannerFiles } from '../src/scanner/modules/selection.ts'

/** The files Groma hands the Angular scanner with its package defaults. */
const angularFiles = (root: string) => scannerFiles(root, manifest.groma.scanner)

const served = 'server/talks.ts'
const users = 'server/users.ts'

async function setup() {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-angular-http-'))
  const root = path.join(temporary, 'project')
  await cp(path.resolve(import.meta.dir, '../test/fixtures/angular-http'), root, { recursive: true })
  for (const name of await readdir(root)) {
    if (name.endsWith('.ts.fixture')) await rename(path.join(root, name), path.join(root, name.slice(0, -'.fixture'.length)))
  }
  const git = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
  expect(await git.exited, await new Response(git.stderr).text()).toBe(0)
  await buildPackage(path.join(temporary, 'scanner'))
  const scanner: ScannerPlugin = (await import(path.join(temporary, 'scanner', 'dist/index.js'))).default
  return { temporary, root, scanner }
}

/** Each request as `operation method path`, with a dynamic or unknown segment marked. */
function requests(observation: ScanObservation): string[] {
  const operations = new Map(observation.operations?.map(operation => [operation.id, operation.name]))
  return (observation.httpRequests ?? []).map(request => [
    operations.get(request.operation),
    request.method ?? 'no-method',
    `${request.configured ? 'configured:' : ''}/${request.path.map(segment => (
      segment.kind === 'literal' ? segment.value : `<${segment.kind}>`
    )).join('/')}`,
  ].join(' '))
}

/** `:id` marks a parameter segment in the endpoint the fixture server serves. */
function endpoint(method: string, route: string, operation = served): ScanHttpEndpoint {
  return {
    operation,
    method,
    path: route.split('/').filter(Boolean).map((part): HttpEndpointSegment => (
      part.startsWith(':') ? { kind: 'parameter', name: part.slice(1) } : { kind: 'literal', value: part }
    )),
  }
}

function server(): ScanObservation {
  return createScanObservation({
    scanner: { id: 'server', technology: 'fixture', engine: 'fixture', engineVersion: '1' },
    roots: [{ id: 'app', kind: 'project', name: 'App' }],
    files: [{ file: served, roots: ['app'], symbols: [] }, { file: users, roots: ['app'], symbols: [] }],
    operations: [{ id: served, file: served, name: 'talks' }, { id: users, file: users, name: 'users' }],
    httpEndpoints: [
      endpoint('GET', '/api/talks'), endpoint('POST', '/api/talks'), endpoint('DELETE', '/api/talks/:id'),
      endpoint('GET', '/api/users', users),
    ],
    diagnostics: [],
  })
}

test.concurrent('the built Angular package reports HttpClient requests and serves no endpoint', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const observation = (await scanner.scan(root, {}, await angularFiles(root)))!

    expect(requests(observation).sort()).toEqual([
      // Every supported client method, with the URL read at the call.
      'allowed OPTIONS /api/talks',
      'amend PATCH /api/talks/<dynamic>',
      // A method the source computes leaves the fact without one, so core derives nothing.
      'byMethod no-method /api/talks',
      // A property the project assigns again no longer holds its literal.
      'changed GET /<unknown>',
      // A value the scanner cannot see is configuration; the base contributes no path text.
      'configured GET configured:/talks',
      'create POST /api/talks',
      'exists HEAD /api/talks',
      // A base stating a host, and a base that is a parameter, are unknown.
      'external GET /<unknown>/talks',
      'fromBase GET /<unknown>/talks',
      // A field the sources never assign, here an injected one, is the client's own setting.
      'injected GET configured:/talks',
      // A field holds its one assignment.
      'latest GET /api/talks/latest',
      'list GET /api/talks',
      // A field assigned twice is unknown.
      'moved GET /<unknown>/talks',
      // One computed segment is dynamic; a partly computed segment is unknown.
      'one GET /api/speakers/<dynamic>',
      'partial GET /api/talks/<unknown>',
      'purge DELETE /api/talks/<dynamic>',
      'remove DELETE /api/talks/<dynamic>',
      'replace PUT /api/talks/<dynamic>',
      // A property nothing changes holds its literal.
      'routed GET /api/talks',
      // The query is dropped, computed or not.
      'search GET /api/talks',
      // A helper reads its path from a parameter, and its caller reports nothing.
      'send GET /<unknown>',
      // A field holds its one assignment, here a configured base and a literal path.
      'users GET configured:/api/speakers/users',
      // The constructor runs its own calls and the field initializers.
      'constructor GET /api/boot',
      'constructor GET /api/feed',
      // httpResource sends GET unless its request object states another method.
      'callback at 154 GET /api/talks/<dynamic>',
      'callback at 155 POST /api/saved',
    ].sort())
    // `request(new HttpRequest(...))` states no separate URL, so `packaged` reports nothing.
    expect(requests(observation).some(request => request.startsWith('packaged'))).toBe(false)
    // Router routes and interceptors answer no request, and the DraftService `get` is not a client.
    expect(observation.httpEndpoints).toBeUndefined()
  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 120000)

test.concurrent('core derives one row from the Angular requests to the file that serves them', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const angular = (await scanner.scan(root, {}, await angularFiles(root)))!
    const owners = new Map([...angular.files.map(file => [file.file, file.file] as const), [served, served], [users, users]])

    // `/api/speakers/users` below a configured base is no request to `/api/users`.
    const rows = inferRelationships([angular, server()], owners)
    expect(rows.map(row => [row.source, row.target])).toEqual([['talk.service.ts', served]])
    const [row] = rows
    expect(row?.description).toContain('GET /api/talks')
    expect(row?.description).toContain('DELETE /api/talks/:id')
    expect(row?.technology).toContain('angular')
  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 120000)
