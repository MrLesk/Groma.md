import { expect, test } from 'bun:test'
import { cp, mkdtemp, readdir, rename, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ScanObservation, ScannerPlugin } from '@groma/scanner'
import { buildPackage } from '../plugins/scanners/react/build.ts'
import { inferRelationships } from '../src/relationship-inference.ts'

async function setup() {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-react-http-'))
  const root = path.join(temporary, 'project')
  await cp(path.resolve(import.meta.dir, '../test/fixtures/react-http'), root, { recursive: true })
  for (const name of await readdir(root, { recursive: true })) {
    if (name.endsWith('.fixture')) await rename(path.join(root, name), path.join(root, name.slice(0, -'.fixture'.length)))
  }
  const git = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
  expect(await git.exited, await new Response(git.stderr).text()).toBe(0)
  await buildPackage(path.join(temporary, 'scanner'))
  const scanner: ScannerPlugin = (await import(path.join(temporary, 'scanner', 'dist/index.js'))).default
  return { temporary, root, scanner }
}

/** Each endpoint as `file method path`, with parameter and catch-all segments named. */
function endpoints(observation: ScanObservation): string[] {
  const files = new Map(observation.operations?.map(operation => [operation.id, operation.file]))
  return (observation.httpEndpoints ?? []).map(fact => [
    files.get(fact.operation),
    fact.method,
    `/${fact.path.map(segment => (
      segment.kind === 'literal' ? segment.value : `:${segment.name}${segment.kind === 'catch-all' ? (segment.optional ? '*' : '+') : ''}`
    )).join('/')}`,
  ].join(' ')).sort()
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
  ].join(' ')).sort()
}

test.concurrent('the built React package reports fetch and axios requests', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const observation = (await scanner.scan(root))!

    expect(requests(observation)).toEqual([
      'added POST /api/talks',
      // An axios instance's baseURL starts the path.
      'based GET /api/talks',
      // A computed method leaves the fact without one, so core derives nothing.
      'byMethod no-method /api/talks',
      // A value the scanner cannot see, here an ambient declaration, is configuration.
      'configured GET configured:/talks',
      'configuredCall PUT /api/talks',
      'create POST /api/talks',
      'direct PATCH /api/talks',
      'dropped DELETE /api/talks/<dynamic>',
      // A literal host is never comparable path text.
      'external GET /<unknown>/talks',
      // A base the caller supplies is computed.
      'fromBase GET /<unknown>/talks',
      // A helper reads its path from a parameter, and its caller reports nothing.
      'helper GET /<unknown>',
      'list GET /api/talks',
      'listed GET /api/talks',
      'one GET /api/talks/<dynamic>',
      // A partly computed segment is unknown.
      'partial GET /api/talks/<unknown>',
      'plain GET /api/talks',
      // A base an instance may be reassigned is not a base, so `reassigned` reports nothing.
      // The query is dropped, computed or not.
      'search GET /api/talks',
      // An options object the scanner cannot read leaves the method out instead of claiming GET.
      'unresolved no-method /api/talks',
    ])
    // A project-declared `fetch`, a `get` on any other object, and a reassigned axios instance are not clients.
    expect(requests(observation).some(request => /^(shadowed|stored|reassigned) /.test(request))).toBe(false)
  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 120000)

test.concurrent('the built React package reports Next.js route handlers and API routes as endpoints', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const observation = (await scanner.scan(root))!

    expect(endpoints(observation)).toEqual([
      // A route group organizes files without serving a segment.
      'app/api/(admin)/audit/route.ts GET /api/audit',
      // A catch-all takes the rest of the path, and an optional one may take none.
      'app/api/docs/[[...slug]]/route.ts GET /api/docs/:slug*',
      'app/api/files/[...path]/route.ts GET /api/files/:path+',
      // An App Router directory named index is an ordinary segment.
      'app/api/index/route.ts GET /api/index',
      'app/api/talks/[id]/route.ts DELETE /api/talks/:id',
      'app/api/talks/route.ts GET /api/talks',
      'app/api/talks/route.ts POST /api/talks',
      // A Pages Router index file serves its directory, while an index directory is a segment.
      'pages/api/drafts/index.ts * /api/drafts',
      'pages/api/index/list.ts * /api/index/list',
      'pages/api/speakers/[id].ts * /api/speakers/:id',
      // A router root may sit under src.
      'src/app/api/status/route.ts GET /api/status',
    ])
    // `pages/api.tsx` is a page, `pages/api/health.ts` exports no function, and middleware answers nothing.
    expect(endpoints(observation).some(fact => /api\.tsx|health\.ts|middleware/.test(fact))).toBe(false)
    expect(observation.files.map(file => file.file)).toContain('app/api/talks/route.ts')
  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 120000)

test.concurrent('core derives rows from the React requests to the route files that serve them', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const react = (await scanner.scan(root))!
    const owners = new Map(react.files.map(file => [file.file, file.file]))

    // The fixture's requests and its Next.js route files are both React facts.
    const rows = inferRelationships([react], owners)
    expect(rows.map(row => `${row.source} -> ${row.target}`).sort()).toEqual([
      'talks.tsx -> app/api/talks/[id]/route.ts',
      'talks.tsx -> app/api/talks/route.ts',
    ])
    const [, listing] = rows.map(row => row.description).sort()
    expect(listing).toContain('GET /api/talks')
    expect(listing).toContain('POST /api/talks')
    expect(rows[0]?.technology).toContain('react')
  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 120000)
