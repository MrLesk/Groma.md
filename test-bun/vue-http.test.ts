import { expect, test } from 'bun:test'
import { cp, mkdtemp, readdir, rename, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ScanObservation, ScannerPlugin } from '@groma/scanner'
import { buildPackage } from '../plugins/scanners/vue/build.ts'
import { inferRelationships } from '../src/relationship-inference.ts'

async function setup() {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-vue-http-'))
  const root = path.join(temporary, 'project')
  await cp(path.resolve(import.meta.dir, '../test/fixtures/vue-http'), root, { recursive: true })
  for (const name of await readdir(root, { recursive: true })) {
    if (name.endsWith('.fixture')) await rename(path.join(root, name), path.join(root, name.slice(0, -'.fixture'.length)))
  }
  const git = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
  expect(await git.exited, await new Response(git.stderr).text()).toBe(0)
  await buildPackage(path.join(temporary, 'scanner'))
  const scanner: ScannerPlugin = (await import(path.join(temporary, 'scanner', 'dist/index.js'))).default
  return { temporary, root, scanner }
}

/** Each request as `file#operation method path`, with a dynamic or unknown segment marked. */
function requests(observation: ScanObservation): string[] {
  const operations = new Map(observation.operations?.map(operation => [operation.id, operation]))
  return (observation.httpRequests ?? []).map(request => {
    const operation = operations.get(request.operation)
    return [
      `${operation?.file}#${operation?.name}`,
      request.method ?? 'no-method',
      `${request.configured ? 'configured:' : ''}/${request.path.map(segment => (
        segment.kind === 'literal' ? segment.value : `<${segment.kind}>`
      )).join('/')}`,
    ].join(' ')
  }).sort()
}

/** Each endpoint as `file method path`, with parameter and catch-all segments named and a constrained one marked `!`. */
function endpoints(observation: ScanObservation): string[] {
  const files = new Map(observation.operations?.map(operation => [operation.id, operation.file]))
  return (observation.httpEndpoints ?? []).map(fact => [
    files.get(fact.operation),
    fact.method,
    `/${fact.path.map(segment => {
      if (segment.kind === 'literal') return segment.value
      const rest = segment.kind === 'catch-all' ? (segment.optional ? '*' : '+') : ''
      return `:${segment.name}${rest}${segment.constrained ? '!' : ''}`
    }).join('/')}`,
  ].join(' ')).sort()
}

test.concurrent('the built Vue package reports Nuxt and axios requests, including from a component script', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const observation = (await scanner.scan(root))!

    // A `get` on another object, a reassigned axios instance, a helper's caller, a project's own
    // `useFetch` composable, a `fetch` imported from a package, and the named axios exports
    // `isAxiosError` and `post` report nothing, so `stored`, `reassigned`, `viaHelper`, `wrapped`,
    // `viaUndici`, `checked` and `named` send nothing.
    expect(requests(observation)).toEqual([
      // A single-file component's script block reports its own file and lines.
      // A component's own setup code runs the request its module operation names.
      'web/Talks.vue#(module) GET /api/talks',
      'web/Talks.vue#byMethod no-method /api/talks',
      'web/Talks.vue#create POST /api/talks',
      'web/Talks.vue#external GET /<unknown>/talks',
      'web/Talks.vue#fromBase GET /<unknown>/talks',
      'web/Talks.vue#list GET /api/talks',
      'web/Talks.vue#one GET /api/talks/<dynamic>',
      'web/Talks.vue#partial GET /api/talks/<unknown>',
      'web/Talks.vue#plain GET /health',
      'web/Talks.vue#search GET /api/talks',
      // A module's own top-level request names that file's module operation.
      'web/client.ts#(module) GET /api/talks',
      // A dynamic segment could reach many routes, so it derives no row.
      'web/client.ts#anyResource GET /api/<dynamic>',
      'web/client.ts#based GET /api/talks',
      // A base's end that a computed part may continue starts the path unknown.
      'web/client.ts#computedBoundary GET /<unknown>/<dynamic>',
      'web/client.ts#configured GET configured:/talks',
      'web/client.ts#configuredCall PUT /api/talks',
      'web/client.ts#fetchNamed GET /api/talks/named',
      'web/client.ts#helper no-method /<unknown>',
      // Nuxt's baseURL option: a host is never path text, a URL that already starts with the base is
      // kept, and the base joins any other.
      'web/client.ts#hosted GET /<unknown>/talks',
      // A base built from pieces is compared as the text they make.
      'web/client.ts#joinedBase GET /v1/api/talks',
      'web/client.ts#kept GET /api/talks',
      'web/client.ts#listSpeakers GET /api/speakers',
      'web/client.ts#listUsers GET /api/users',
      'web/client.ts#listed GET /api/talks',
      'web/client.ts#load GET /api/talks',
      // A URL that only shares the base's text, not a whole segment, is joined to it.
      'web/client.ts#prefixMismatch GET /api/apix/talks',
      'web/client.ts#prefixed GET /api/talks',
      'web/client.ts#removed DELETE /api/talks/<dynamic>',
      // Computed text that may or may not repeat the base starts the path unknown.
      'web/client.ts#slashed GET /<unknown>/<dynamic>',
      'web/client.ts#templated GET /api/talks',
      // Options the scanner cannot read leave the method out instead of claiming GET, and may hold a base.
      'web/client.ts#unresolved no-method /<unknown>/api/talks',
    ])
  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 120000)

test.concurrent('the built Vue package reports Nuxt server routes as endpoints', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const observation = (await scanner.scan(root))!

    expect(endpoints(observation)).toEqual([
      // A method suffix names the method; a route without one answers every method.
      // An index file serves its directory, and a catch-all takes the rest of the path.
      // A route group directory serves no segment.
      'web/server/api/(admin)/users.get.ts GET /api/users',
      'web/server/api/[resource].get.ts GET /api/:resource',
      // A catch-all name is word characters; any other name makes the segment a parameter.
      'web/server/api/docs/[...file-path].get.ts GET /api/docs/:...file-path',
      'web/server/api/drafts/index.get.ts GET /api/drafts',
      'web/server/api/files/[...path].get.ts GET /api/files/:path+',
      // Text before a placeholder makes the whole segment literal, as Nitro registers it.
      'web/server/api/hello-[name].get.ts GET /api/hello-:name',
      // Nuxt serves every route file: one whose handler the scan cannot resolve, or whose default export
      // is not a function, names the file's module operation.
      'web/server/api/imported.get.ts GET /api/imported',
      // A segment that starts with a placeholder is a parameter.
      'web/server/api/optional/[[opt]].get.ts GET /api/optional/:*',
      'web/server/api/settings.ts * /api/settings',
      // An environment suffix follows the method suffix, and neither is a segment.
      'web/server/api/speakers.get.prod.ts GET /api/speakers',
      'web/server/api/talks.get.ts GET /api/talks',
      'web/server/api/talks.post.ts POST /api/talks',
      'web/server/api/talks/[id].delete.ts DELETE /api/talks/:id',
      'web/server/api/talks/[id].get.ts GET /api/talks/:id',
      // A handler written as a default-exported function, or named by a constant, is the endpoint's.
      'web/server/api/talks/declared.get.ts GET /api/talks/declared',
      'web/server/api/talks/named.get.ts GET /api/talks/named',
      // `[...]` is an unnamed catch-all, and a name no placeholder can spell is `*`.
      'web/server/api/wild/[...].ts * /api/wild/:*+',
      'web/server/routes/feed.tsx * /feed',
      'web/server/routes/health.ts * /health',
    ])
    const operations = new Map(observation.operations?.map(operation => [operation.id, operation.name]))
    const named = (file: string) => operations.get(observation.httpEndpoints!.find(fact => (
      observation.operations?.find(operation => operation.id === fact.operation)?.file === file
    ))!.operation)
    expect(named('web/server/api/talks/named.get.ts')).toBe('handler')
    expect(named('web/server/api/talks/declared.get.ts')).toBe('declared')
    expect(named('web/server/api/imported.get.ts')).toBe('(module)')

  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 120000)

test.concurrent('core derives rows from the Vue requests to the server routes that serve them', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const vue = (await scanner.scan(root))!
    const owners = new Map(vue.files.map(file => [file.file, file.file]))

    const rows = inferRelationships([vue], owners)
    expect(rows.map(row => `${row.source} -> ${row.target}`).sort()).toEqual([
      'web/Talks.vue -> web/server/api/talks.get.ts',
      'web/Talks.vue -> web/server/api/talks.post.ts',
      // The component sends no DELETE, so the method-suffixed route it does not call has no row.
      'web/Talks.vue -> web/server/routes/health.ts',
      // Route groups and environment suffixes name the served path, so these rows reach the files serving
      // it rather than the parameter route beside them.
      'web/client.ts -> web/server/api/(admin)/users.get.ts',
      'web/client.ts -> web/server/api/speakers.get.prod.ts',
      'web/client.ts -> web/server/api/talks.get.ts',
      'web/client.ts -> web/server/api/talks/[id].delete.ts',
      // A literal route beats the parameter route beside it, so a named handler keeps its requests.
      'web/client.ts -> web/server/api/talks/named.get.ts',
    ])
    expect(rows.find(row => row.target.endsWith('health.ts'))?.description).toContain('GET /health')
  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 120000)
