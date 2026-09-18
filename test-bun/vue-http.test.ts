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

/** Each endpoint as `file method path`, with parameter and catch-all segments named. */
function endpoints(observation: ScanObservation): string[] {
  const files = new Map(observation.operations?.map(operation => [operation.id, operation.file]))
  return (observation.httpEndpoints ?? []).map(fact => [
    files.get(fact.operation),
    fact.method,
    `/${fact.path.map(segment => (
      segment.kind === 'literal' ? segment.value : `:${segment.name}${segment.kind === 'catch-all' ? '+' : ''}`
    )).join('/')}`,
  ].join(' ')).sort()
}

test.concurrent('the built Vue package reports Nuxt and axios requests, including from a component script', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const observation = (await scanner.scan(root))!

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
      'web/client.ts#based GET /api/talks',
      'web/client.ts#configured GET configured:/talks',
      'web/client.ts#configuredCall PUT /api/talks',
      'web/client.ts#helper GET /<unknown>',
      'web/client.ts#listed GET /api/talks',
      'web/client.ts#load GET /api/talks',
      'web/client.ts#removed DELETE /api/talks/<dynamic>',
      // Options the scanner cannot read leave the method out instead of claiming GET.
      'web/client.ts#unresolved no-method /api/talks',
    ])
    // A `get` on another object, a reassigned axios instance, a helper's caller, and a project's own
    // `useFetch` composable report nothing.
    expect(requests(observation).some(request => /#(stored|reassigned|viaHelper|wrapped) /.test(request))).toBe(false)
  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 120000)

test.concurrent('the built Vue package reports Nuxt server routes as endpoints', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const observation = (await scanner.scan(root))!

    expect(endpoints(observation)).toEqual([
      // A method suffix names the method; a route without one answers every method.
      // An index file serves its directory, and a catch-all takes the rest of the path.
      'web/server/api/drafts/index.get.ts GET /api/drafts',
      'web/server/api/files/[...path].get.ts GET /api/files/:path+',
      'web/server/api/talks.get.ts GET /api/talks',
      'web/server/api/talks.post.ts POST /api/talks',
      'web/server/api/talks/[id].delete.ts DELETE /api/talks/:id',
      'web/server/routes/health.ts * /health',
    ])

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
      'web/client.ts -> web/server/api/talks.get.ts',
      'web/client.ts -> web/server/api/talks/[id].delete.ts',
    ])
    expect(rows.find(row => row.target.endsWith('health.ts'))?.description).toContain('GET /health')
  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 120000)
