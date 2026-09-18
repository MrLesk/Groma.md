import { expect, test } from 'bun:test'
import { cp, mkdtemp, readdir, rename, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { HttpEndpointSegment, HttpRequestSegment, ScanObservation } from '@groma/scanner'

import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'

async function scanFixture(): Promise<{ scan: ScanObservation; clean: () => Promise<void> }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-ts-http-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/typescript-http'), root, { recursive: true })
  // The fixture ships framework imports this repository does not install, so its sources stay unbuilt.
  for (const name of await readdir(root)) {
    await rename(path.join(root, name), path.join(root, name.replace(/\.fixture$/, '')))
  }
  for (const command of [['git', 'init', '--quiet'], ['git', 'add', '-A']]) {
    const child = Bun.spawn(command, { cwd: root, stdout: 'ignore', stderr: 'pipe' })
    expect(await child.exited, await new Response(child.stderr).text()).toBe(0)
  }
  const scan = await scanTypeScriptSource(root)
  expect(scan).toBeDefined()
  return { scan: scan!, clean: () => rm(root, { recursive: true, force: true }) }
}

function endpointLabel(segment: HttpEndpointSegment): string {
  if (segment.kind === 'literal') return segment.value
  if (segment.kind === 'parameter') return `:${segment.name}${segment.optional ? '?' : ''}`
  return `:${segment.name}${segment.optional ? '*' : '+'}`
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
    // Nothing from unsupported.ts, the spread route value, or a router mounted on an unrecognized host.
    expect(endpoints.sort()).toEqual([
      '* /legacy/:*+ hono-server.ts#forward',
      '* /uploads/:*+ bun-server.ts#serveUpload',
      'GET /api/rooms/:id bun-server.ts#showRoom',
      'GET /api/talks/:id talks-router.ts#showTalk',
      'GET /health express-server.ts#(anonymous)',
      'GET /jobs/:id fastify-server.ts#runJob',
      'GET /speakers/:id nest-controller.ts#find',
      'GET /status fastify-server.ts#(anonymous)',
      'GET /v1/rooms/:room? hono-server.ts#listRooms',
      'GET /v2/rooms/:room? hono-server.ts#listRooms',
      'POST /api/talks talks-router.ts#createTalk',
      'POST /jobs/:id fastify-server.ts#runJob',
      'POST /speakers nest-controller.ts#create',
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
    // Nothing from a reassignable axios instance or from a named axios import such as isAxiosError.
    expect(requests.sort()).toEqual([
      '(unknown) /api/speakers axios-client.ts#sendSpeaker',
      '(unknown) /api/talks client.ts#sendChosen',
      'DELETE <base>/speakers/{} axios-client.ts#removeSpeaker',
      'GET /? client.ts#loadComputed',
      'GET /?/talks client.ts#loadExternal',
      'GET /api/speakers axios-client.ts#listSpeakers',
      'GET /api/talks client.ts#loadPage',
      'GET /api/talks client.ts#loadTalks',
      'GET /api/talks/? client.ts#loadPartial',
      'GET /api/talks/{} client.ts#loadTalk',
      'GET <base>/talks client.ts#loadConfigured',
      'PATCH /api/speakers/{} axios-client.ts#patchSpeaker',
      'POST /api/talks client.ts#createTalk',
      'POST <base>/speakers axios-client.ts#saveSpeaker',
    ])
  } finally { await clean() }
})
