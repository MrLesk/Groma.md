import type { RevisionEntry, RevisionPage, RevisionQuery } from '@groma/revision-source'

export type Api = <T>(endpoint: string, fields?: Record<string, string>) => Promise<T>
export const entryId = (repository: string, kind: string, name: string) => JSON.stringify({ repository, kind, name })
interface Branch { name: string; commit: { sha: string } }
interface Review {
  number: number; title: string; state: string; isDraft: boolean; headRefName: string; baseRefName: string
  headRefOid: string; headRepository?: { nameWithOwner: string }; url: string
}
const searchQuery = `query($search: String!, $cursor: String) {
  search(query: $search, type: ISSUE, first: 30, after: $cursor) {
    issueCount pageInfo { hasNextPage endCursor }
    nodes { ... on PullRequest { number title state isDraft headRefName baseRefName headRefOid headRepository { nameWithOwner } url } }
  }
}`

export function githubDiscovery(api: Api) {
  async function branches(repository: string, query: RevisionQuery): Promise<RevisionPage> {
    const page = Number(query.cursor ?? 1)
    const entry = (branch: Branch): RevisionEntry => ({
      id: entryId(repository, 'branch', branch.name), title: branch.name, sha: branch.commit.sha, detail: repository,
    })
    if (!query.search) {
      const entries = await api<Branch[]>('repos/' + repository + '/branches?per_page=50&page=' + page)
      return { entries: entries.map(entry), ...(entries.length === 50 ? { cursor: String(page + 1) } : {}) }
    }
    // Branch REST has no name search. Read every page before filtering; never call page one complete.
    const all: Branch[] = []
    for (let index = 1; ; index++) {
      const rows = await api<Branch[]>('repos/' + repository + '/branches?per_page=100&page=' + index)
      all.push(...rows)
      if (rows.length < 100) break
    }
    const matches = all.filter(branch => branch.name.toLowerCase().includes(query.search!.toLowerCase()))
    const offset = (page - 1) * 50
    return { entries: matches.slice(offset, offset + 50).map(entry), ...(offset + 50 < matches.length ? { cursor: String(page + 1) } : {}) }
  }
  async function reviews(repository: string, query: RevisionQuery): Promise<RevisionPage> {
    const states: Record<string, string> = { open: 'is:open', closed: 'is:closed is:unmerged', merged: 'is:merged', all: '' }
    const term = query.search?.trim()
    const search = ['repo:' + repository, 'is:pr', states[query.state ?? 'open'], term ? JSON.stringify(term) : ''].filter(Boolean).join(' ')
    const result = await api<{ data: { search: { issueCount: number; nodes: Review[]; pageInfo: { hasNextPage: boolean; endCursor: string } } }; errors?: { message: string }[] }>(
      'graphql', { query: searchQuery, search, ...(query.cursor ? { cursor: query.cursor } : {}) })
    if (result.errors?.length) throw new Error(result.errors.map(error => error.message).join('\n'))
    const found = result.data.search
    if (found.issueCount > 1000) throw new Error('More than 1,000 pull requests match. Narrow the search to see complete results.')
    return {
      entries: found.nodes.map(review => ({
        id: entryId(repository, 'pull', String(review.number)), title: '#' + review.number + ' ' + review.title,
        state: review.isDraft ? 'Draft' : review.state.toLowerCase(), sha: review.headRefOid, url: review.url,
        detail: (review.headRepository?.nameWithOwner ?? repository) + ':' + review.headRefName + ' → ' + review.baseRefName,
      })),
      ...(found.pageInfo.hasNextPage ? { cursor: found.pageInfo.endCursor } : {}),
    }
  }
  return { branches, reviews }
}
