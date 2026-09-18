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
    const constrained = 'constrained' in segment && segment.constrained ? '(constrained)' : ''
    if (segment.kind === 'parameter') return `:${segment.name}${segment.optional ? '?' : ''}${constrained}`
    if (segment.kind === 'catch-all') return `:${segment.name}${segment.optional ? '*' : '+'}${constrained}`
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
    // Spring MVC and WebFlux controllers and JAX-RS resources serve; nothing comes from a security matcher.
    // A class-level method joins each mapping's own, every class route prefixes each mapping, and Spring finds
    // a class's prefix on its interfaces and superclass in the sources. A Spring pattern parameter, text mixed
    // with a placeholder or a wildcard is a constrained parameter, as is a Spring catch-all, which Spring ranks
    // last; a JAX-RS regular expression, which may match a slash, ends the path. A route the scanner sees but
    // cannot read (an unresolved prefix, route or method, a configuration placeholder, a wildcard class prefix,
    // an un-annotated override where the class or a supertype in the sources has an unresolved supertype, a
    // sub-resource locator) is a blocker: its readable prefix, then a constrained optional catch-all, for every
    // method unless known. A resolved or known supertype such as ErrorController changes nothing.
    expect(scan.httpEndpoints!.map(endpoint => `${endpoint.method} /${route(endpoint.path)} ${owner(endpoint.operation)}`)).toEqual([
      'POST /admin/talks AdminController.java',
      'POST /staff/talks AdminController.java',
      'POST /admin/stats AdminController.java',
      'GET /admin/stats AdminController.java',
      'POST /staff/stats AdminController.java',
      'GET /staff/stats AdminController.java',
      'GET /api/v9/featured ApiController.java',
      '* /archive/:**(constrained) ArchiveController.java',
      'GET /api/children/:id ChildController.java',
      '* /featured/:**(constrained) FeaturedController.java',
      'GET /hotels/:**(constrained) HotelsController.java',
      '* /api/imported/talks/:**(constrained) ImportedMethodController.java',
      '* /api/imported/audit/:**(constrained) ImportedMethodController.java',
      'GET /library LibraryController.java',
      'GET /patterns/:id(constrained) PatternsController.java',
      'GET /patterns/:name(constrained)/profile PatternsController.java',
      'GET /patterns/tree/:path*(constrained) PatternsController.java',
      'GET /patterns/:patterns.segment*(constrained) PatternsController.java',
      'GET /patterns/exports/:*(constrained) PatternsController.java',
      'GET /:**(constrained) PrefixController.java',
      'GET /replies/:id*(constrained) RepliesResource.java',
      '* /api/restricted/talks/:**(constrained) RestrictedController.java',
      'GET /reviews ReviewsResource.java',
      'GET /reviews/:id ReviewsResource.java',
      'POST /reviews/:id ReviewsResource.java',
      '* /reviews/:id/comments/:**(constrained) ReviewsResource.java',
      'GET /status StatusController.java',
      'GET /api/stream/talks StreamController.java',
      'GET /api/talks/:id TalksController.java',
      'POST /api/talks TalksController.java',
      'PUT /api/talks TalksController.java',
      'GET /api/files/:**(constrained) TalksController.java',
      'GET /api/:version(constrained)/archive TalksController.java',
    ])
    // Every supported client resolves a root-relative URL against its configured base; a URL stating a
    // host, including a protocol-relative one or a field holding one, and text continuing the base have
    // a leading unknown segment. A field Spring injects or a method reassigns stays a configured base. Nothing
    // comes from a method constant of another type or from a client route the scanner cannot read. A URI template fills one whole segment. Nothing comes from a builder
    // method the scanner cannot read, or from a receiver whose name the file declares with two types.
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
      'GET {base}/admin/talks Clients.java',
      'GET {base}/patterns/42 Clients.java',
      'GET {base}/replies/7/latest Clients.java',
      'GET /unknown/api/stream/talks Clients.java',
      'GET /unknown/reviews Clients.java',
      'GET /unknown/reviews Clients.java',
      'GET /unknown/reviews Clients.java',
      'GET {base}/reviews Clients.java',
      'GET {base}/reviews Clients.java',
      'GET {base}/reviews Clients.java',
      'GET {base}/reviews/dynamic ReviewsClient.java',
      'GET {base}/reviews/featured ReviewsClient.java',
      'GET {base}/api/talks/dynamic TalksClient.java',
      'DELETE {base}/api/talks/dynamic TalksClient.java',
    ])
    // A GET reaches no POST-only admin route, and a literal only possibly satisfies a constrained segment.
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
