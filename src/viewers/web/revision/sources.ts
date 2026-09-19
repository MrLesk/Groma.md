import type { RevisionSource, RevisionSourceSettings } from '@groma/revision-source'

const paths = ['/revision-sources', '/revision-entries', '/revision-resolve', '/revision-settings']

async function readSource(source: RevisionSource, url: URL): Promise<Response> {
  const state = await source.readiness()
  if (!state.enabled || !state.ready) throw new Error(state.message ?? 'Revision source is unavailable')
  if (url.pathname === '/revision-resolve') return Response.json(await source.resolve(url.searchParams.get('id') ?? ''))
  return Response.json(await source.list({
    collection: url.searchParams.get('collection') ?? '',
    search: url.searchParams.get('search') ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
    state: url.searchParams.get('state') ?? undefined,
  }))
}

/** HTTP host only sees normalized source data and opaque entry/cursor identities. */
export function revisionSourceRoutes(sources: readonly RevisionSource[]) {
  async function dispatch(request: Request, url: URL) {
    if (url.pathname === '/revision-sources') return Response.json(await Promise.all(sources.map(source => source.readiness())))
    const source = sources.find(source => source.id === url.searchParams.get('source'))
    if (!source) throw new Error('Revision source not found')
    if (url.pathname === '/revision-settings' && request.method === 'POST') {
      if (!source.configure) throw new Error('Source has no settings')
      await source.configure(await request.json() as RevisionSourceSettings)
      return Response.json(await source.readiness())
    }
    return readSource(source, url)
  }
  return async (request: Request, url: URL): Promise<Response | undefined> => {
    if (!paths.includes(url.pathname)) return undefined
    try { return await dispatch(request, url) }
    catch (error) { return new Response(error instanceof Error ? error.message : String(error), { status: 400 }) }
  }
}
