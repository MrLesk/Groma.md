import { expect, test } from 'bun:test'
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { parseScanObservation, type HttpEndpointSegment, type HttpRequestSegment } from '@groma/scanner'
import { buildWorker } from '../plugins/scanners/java/build.ts'
import { javaCommand, run } from '../plugins/scanners/java/src/process.ts'
import { httpRelationships } from '../src/http-relationships.ts'

function route(segments: readonly (HttpEndpointSegment | HttpRequestSegment)[]): string {
  return segments.map(segment => {
    if (segment.kind === 'literal') return segment.value
    if (segment.kind === 'parameter') return `:${segment.name}${segment.optional ? '?' : ''}`
    if (segment.kind === 'catch-all') return `:${segment.name}${segment.optional ? '*' : '+'}`
    return segment.kind
  }).join('/')
}

test.concurrent('Java reports the endpoints its controllers serve and the requests its clients send', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-java-http-'))
  try {
    await cp(path.resolve(import.meta.dir, '../test/fixtures/java-http'), root, { recursive: true })
    const worker = path.join(root, 'worker.jar')
    await buildWorker(worker)
    const sources = (await readdir(path.join(root, 'src/main/java/http')))
      .map(file => `src/main/java/http/${file}`).sort()
    const scan = parseScanObservation(await run(javaCommand(), ['-jar', worker, root, '21', 'UTF-8'], root, `${sources.join('\n')}\n`))
    const operations = new Map(scan.operations!.map(operation => [operation.id, operation]))
    const owner = (id: string) => path.posix.basename(operations.get(id)!.file)
    // Spring MVC and WebFlux controllers and JAX-RS resources serve. Nothing comes from a security
    // matcher, a prefix constant the sources do not declare, a mixed `v{version}` segment, a class
    // whose prefix a base class holds, or a mapping whose method attribute does not resolve.
    expect(scan.httpEndpoints!.map(endpoint => `${endpoint.method} /${route(endpoint.path)} ${owner(endpoint.operation)}`)).toEqual([
      'GET /reviews ReviewsResource.java',
      'GET /reviews/:id ReviewsResource.java',
      'POST /reviews/:id ReviewsResource.java',
      'GET /api/stream/talks StreamController.java',
      'GET /api/talks/:id TalksController.java',
      'POST /api/talks TalksController.java',
      'PUT /api/talks TalksController.java',
      'GET /api/files/:*+ TalksController.java',
    ])
    // Every supported client resolves its base from configuration unless the URL states a host. A URI
    // template fills one whole segment. Nothing comes from a builder method the scanner cannot read,
    // or from a receiver whose name the file declares with two types.
    expect(scan.httpRequests!.map(request => [
      request.method ?? '(none)', `${request.configured ? '{base}' : ''}/${route(request.path)}`, owner(request.operation),
    ].join(' '))).toEqual([
      'GET {base}/api/talks/dynamic Clients.java',
      'PUT {base}/api/talks Clients.java',
      'POST {base}/api/talks Clients.java',
      'GET {base}/reviews Clients.java',
      'GET {base}/reviews/dynamic Clients.java',
      'GET {base}/api/talks/dynamic Clients.java',
      'GET {base}/api/stream/talks Clients.java',
      'GET /unknown/api/talks Clients.java',
      'PATCH {base}/api/talks Clients.java',
      'GET /unknown Clients.java',
      'GET {base}/api/talks/unknown Clients.java',
      'GET {base}/reviews/dynamic ReviewsClient.java',
      'GET {base}/reviews/featured ReviewsClient.java',
      'GET {base}/api/talks/dynamic TalksClient.java',
      'DELETE {base}/api/talks/dynamic TalksClient.java',
    ])
    const owners = new Map(scan.files.map(file => [file.file, file.file]))
    expect(httpRelationships([scan], owners).map(row => [
      path.posix.basename(row.source), path.posix.basename(row.target), row.description,
    ].join(' | '))).toEqual([
      'Clients.java | TalksController.java | Calls HTTP endpoints: GET /api/talks/:id, POST /api/talks, PUT /api/talks',
      'Clients.java | ReviewsResource.java | Calls HTTP endpoints: GET /reviews, GET /reviews/:id',
      'Clients.java | StreamController.java | Calls HTTP endpoint: GET /api/stream/talks',
      'ReviewsClient.java | ReviewsResource.java | Calls HTTP endpoint: GET /reviews/:id',
      'TalksClient.java | TalksController.java | Calls HTTP endpoint: GET /api/talks/:id',
    ])
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)
