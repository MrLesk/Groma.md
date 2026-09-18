import { expect, test } from 'bun:test'
import { cp, mkdtemp, readdir, rename, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ScanObservation, ScannerPlugin } from '@groma/scanner'
import { buildPackage } from '../plugins/scanners/react/build.ts'
import { inferRelationships } from '../src/relationship-inference.ts'

async function setup(fixture = 'react-http') {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-react-http-'))
  const root = path.join(temporary, 'project')
  await cp(path.resolve(import.meta.dir, '../test/fixtures', fixture), root, { recursive: true })
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
      // A URL that replaces a base stating a host is its own URL, and a host is never path text.
      'absoluteOverBase GET /<unknown>/talks',
      'added POST /api/talks',
      // An axios instance's baseURL starts the path.
      'based GET /api/talks',
      // A post, put or patch takes its configuration third, and its baseURL joins the path.
      'bodyConfig POST /api/talks',
      // A computed method leaves the fact without one, so core derives nothing.
      'byMethod no-method /api/talks',
      // A configuration another statement changes states no base, URL or method.
      'changedBase GET /<unknown>/talks',
      'changedMethod no-method /api/talks',
      'changedRequest GET /<unknown>',
      'changedUrl GET /<unknown>',
      // A value the scanner cannot see, here an ambient declaration, is configuration.
      'configured GET configured:/talks',
      'configuredCall PUT /api/talks',
      // Text that continues a configured value's last segment is unknown.
      'continued GET /<unknown>/talks',
      'create POST /api/talks',
      'direct PATCH /api/talks',
      'dropped DELETE /api/talks/<dynamic>',
      // The last of two properties with one name is the value the object holds.
      'duplicated GET /api/talks',
      // A literal host is never comparable path text.
      'external GET /<unknown>/talks',
      // A base the caller supplies is computed.
      'fromBase GET /<unknown>/talks',
      // A helper reads its path from a parameter, which could also be a Request with a method of its own,
      // and its caller reports nothing.
      'helper no-method /<unknown>',
      // An instance joins its base and a path with one slash, and uses the method its configuration states.
      'joined POST /api/talks',
      // Literal fragments that together state a host are not a path.
      'joinedHost GET /<unknown>/talks',
      'list GET /api/talks',
      'listed GET /api/talks',
      'one GET /api/talks/<dynamic>',
      // A partly computed segment is unknown.
      'partial GET /api/talks/<unknown>',
      'plain GET /api/talks',
      // An instance whose configuration comes from a call has an unknown base.
      'readBase GET /<unknown>/talks',
      // A property the sources assign again no longer holds its literal.
      'reassignedProperty no-method /<unknown>',
      // A request's own baseURL replaces the client's, and a host is never path text.
      'requestBase GET /<unknown>/api/talks',
      // A Request carries a method of its own, so the call states none.
      'requested no-method /<unknown>',
      // A value a call returns is computed, never configuration.
      'returned GET /<unknown>/talks',
      // A property nothing changes holds its literal.
      'routed GET /api/talks',
      // A base an instance may be reassigned is not a base, so `reassigned` reports nothing.
      // The query is dropped, computed or not.
      'search GET /api/talks',
      // A parameter typed like an object literal can hold any such object.
      'typedParameter no-method /<unknown>',
      // An axios config the scanner cannot read may hold a method and a base, so it leaves both unknown.
      'unresolved no-method /<unknown>/api/talks',
      // An object is not the literal it was written as once an alias, a function it is handed to, one of
      // its methods or accessors, another file, or a module object holding it can change it: a namespace
      // import, a re-exported namespace, or a dynamic import's result.
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
    // A project-declared `fetch`, a `get` on any other object, a reassigned axios instance, and the
    // named axios exports `isAxiosError` and `post` are not clients.
    expect(requests(observation).some(request => /^(shadowed|stored|reassigned|checked|named) /.test(request))).toBe(false)
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
    ])
    // `pages/api.tsx` is a page, `pages/api/health.ts` exports no function, middleware answers nothing,
    // and `src/app` is not read while the project root has an `app` directory.
    expect(endpoints(observation).some(fact => /api\.tsx|health\.ts|middleware|^src\//.test(fact))).toBe(false)
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
      'options.tsx -> app/api/talks/route.ts',
      'talks.tsx -> app/api/talks/[id]/route.ts',
      'talks.tsx -> app/api/talks/route.ts',
      'uncertain.tsx -> app/api/talks/route.ts',
    ])
    const listing = rows.find(row => row.source === 'talks.tsx' && row.target === 'app/api/talks/route.ts')?.description
    expect(listing).toContain('GET /api/talks')
    expect(listing).toContain('POST /api/talks')
    expect(rows[0]?.technology).toContain('react')
  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 120000)

test.concurrent('Next.js routes come from the active routers of a project that declares next', async () => {
  const { temporary, root, scanner } = await setup('react-next-routers')
  try {
    const observation = (await scanner.scan(root))!

    // `pages` at the project root wins over `src/pages`, while `src/app` serves when the root has no `app`.
    // A project without `next` reports no endpoint for its `app` directory.
    expect(endpoints(observation)).toEqual([
      'src-router/pages/api/ping.ts * /api/ping',
      'src-router/src/app/api/status/route.ts GET /api/status',
    ])
  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 120000)

test.concurrent('an axios client is configured by what the project sets on its defaults', async () => {
  const { temporary, root, scanner } = await setup('react-client-defaults')
  try {
    const observation = (await scanner.scan(root))!

    expect(requests(observation)).toEqual([
      // The one assignment to the default client's baseURL, in another file that imports the default
      // export by name, reads configuration.
      'defaultCall GET configured:/talks',
      // An instance with no base of its own copies the default client's when it is created, which the
      // scan cannot order against that assignment.
      'inheritedCall PUT /<unknown>/talks',
      // A change to defaults other than one assignment hides the base; a shorthand still states its method.
      'mergedCall GET /<unknown>/talks',
      // One assignment to an instance's defaults sets its method,
      'postingCall GET /api/talks',
      // and one in another file sets its base.
      'sharedCall GET /<unknown>/talks',
      'statedCall GET /api/talks',
    ])
  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 120000)
