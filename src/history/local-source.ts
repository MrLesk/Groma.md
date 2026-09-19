import type { RevisionSource, RevisionQuery, RevisionPage } from '@groma/revision-source'
import { listGitRevisions, runGit } from './revisions.ts'
import { resolveCommit } from './git-state.ts'

const collections = [{ id: 'branches', label: 'Local branches' }, { id: 'history', label: 'History' }] as const

export function localRevisionSource(root: string): RevisionSource {
  async function list(query: RevisionQuery): Promise<RevisionPage> {
    const entries = query.collection === 'history'
      ? (await listGitRevisions(root, true)).map(commit => ({ id: commit.id, title: commit.subject, sha: commit.id, detail: commit.date }))
      : (await runGit(['for-each-ref', '--format=%(refname)%00%(objectname)', 'refs/heads', 'refs/remotes'], root))
        .trim().split('\n').filter(line => line !== '' && !line.includes('/HEAD\0'))
        .map(line => {
          const [id, sha] = line.split('\0') as [string, string]
          return { id, sha, title: id.replace(/^refs\/(heads|remotes)\//, ''), detail: id.startsWith('refs/remotes/') ? 'Remote-tracking branch · locally fetched' : 'Local branch' }
        })
    const filtered = entries.filter(entry => (entry.title + ' ' + entry.sha).toLowerCase().includes((query.search ?? '').toLowerCase()))
    const start = Number(query.cursor ?? 0)
    return { entries: filtered.slice(start, start + 50), ...(start + 50 < filtered.length ? { cursor: String(start + 50) } : {}) }
  }
  return {
    id: 'git',
    async readiness() {
      try {
        const [head, branch, status] = await Promise.all([
          resolveCommit(root, 'HEAD'),
          runGit(['branch', '--show-current'], root),
          runGit(['status', '--porcelain=v1', '-z', '--untracked-files=all'], root),
        ])
        // Rename records have a second NUL field without a status.
        const count = status.split('\0').filter(field => /^.{2} /.test(field)).length
        return { id: 'git', label: 'Git', enabled: true, ready: true, collections,
          context: (branch.trim() || 'Detached HEAD') + ' · ' + head.slice(0, 8) + ' · ' + count + ' local files' }
      } catch (error) {
        return { id: 'git', label: 'Git', enabled: true, ready: false, collections, message: error instanceof Error ? error.message : String(error) }
      }
    },
    list,
    async resolve(id) { return { target: { sha: await resolveCommit(root, id), label: id.replace(/^refs\/(heads|remotes)\//, '') } } },
    async close() {},
  }
}
