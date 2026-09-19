import { randomUUID } from 'node:crypto'
import type { RevisionSource, RevisionSourceState, RevisionSourceSettings, RevisionSelection } from '@groma/revision-source'
import { commandRunner, type Run } from './commands.ts'
import { githubDiscovery, type Api } from './discovery.ts'

const enabledKey = 'groma.github.enabled'
const repositoryKey = 'groma.github.repository'
const collections = [
  { id: 'branches', label: 'Branches' },
  { id: 'pulls', label: 'Pull requests', states: ['open', 'closed', 'merged', 'all'] },
] as const

interface PullRequest {
  number: number; html_url: string
  head: { sha: string; ref: string; repo: { full_name: string } | null }
  base: { ref: string; repo: { full_name: string } }
}

/** GitHub.com discovery only. The application never sees gh commands or PR refs. */
export function githubRevisionSource(root: string, driver: Run = commandRunner(root)): RevisionSource {
  const controller = new AbortController()
  const pending = new Set<Promise<string>>()
  const ownedRefs = new Set<string>()
  const namespace = 'refs/groma/revisions/' + randomUUID()
  let closed = false

  function run(program: string, args: string[]): Promise<string> {
    if (closed) return Promise.reject(new Error('Revision source is closed'))
    const promise = driver(program, args, controller.signal)
    pending.add(promise)
    void promise.then(() => pending.delete(promise), () => pending.delete(promise))
    return promise
  }
  const git = (args: string[]) => run('git', args)
  const api: Api = async <T>(endpoint: string, fields?: Record<string, string>) => {
    const args = ['api', '--hostname', 'github.com', '-H', 'X-GitHub-Api-Version: 2026-03-10', endpoint]
    for (const [name, value] of Object.entries(fields ?? {})) args.push('-f', name + '=' + value)
    return JSON.parse(await run('gh', args)) as T
  }
  const discovery = githubDiscovery(api)
  async function config(key: string) { return (await git(['config', '--local', '--get', key]).catch(() => '')).trim() }
  async function repositories() {
    const output = await git(['config', '--get-regexp', '^remote\\..*\\.url$']).catch(() => '')
    const rows = new Map<string, string[]>()
    for (const line of output.trim().split('\n')) {
      const [key, url] = line.split(/\s+/)
      const match = url?.match(/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([^/]+\/[^/]+?)(?:\.git)?\/?$/)
      if (!match) continue
      const name = match[1]!
      rows.set(name, [...(rows.get(name) ?? []), key!.replace(/^remote\.|\.url$/g, '')])
    }
    return [...rows].map(([id, names]) => ({ id, label: id + ' · ' + names.join(', ') }))
  }
  async function settings() {
    const [enabled, selected, available] = await Promise.all([config(enabledKey), config(repositoryKey), repositories()])
    const repository = available.find(repo => repo.id === selected)?.id ?? (available.length === 1 ? available[0]!.id : undefined)
    return { enabled: enabled === 'true', repository, repositories: available }
  }
  async function readiness(): Promise<RevisionSourceState> {
    const state = await settings()
    const base = { id: 'github', label: 'GitHub', configurable: true, collections, ...state }
    if (!state.enabled) return { ...base, ready: false }
    if (!state.repository) return { ...base, ready: false, message: state.repositories.length ? 'Choose a repository.' : 'Add a github.com remote to this checkout.' }
    try {
      await run('gh', ['auth', 'status', '--hostname', 'github.com'])
      return { ...base, ready: true, context: state.repository }
    } catch (error) {
      return { ...base, ready: false, message: error instanceof Error ? error.message : 'Run gh auth login.' }
    }
  }
  async function repository() {
    const state = await settings()
    if (!state.enabled || !state.repository) throw new Error('Enable GitHub and choose a repository in Plugins.')
    return state.repository
  }
  async function acquire(repo: string, ref: string, sha: string, role: string) {
    const exists = await git(['cat-file', '-e', sha + '^{commit}']).then(() => true, () => false)
    if (exists) return
    const owned = namespace + '/' + role + '/' + randomUUID()
    ownedRefs.add(owned)
    await git(['-c', 'credential.https://github.com.helper=', '-c', 'credential.https://github.com.helper=!gh auth git-credential',
      'fetch', '--no-tags', '--no-recurse-submodules', '--no-write-fetch-head', 'https://github.com/' + repo + '.git', '+' + ref + ':' + owned])
    const actual = (await git(['rev-parse', '--verify', owned + '^{commit}'])).trim()
    if (actual !== sha) throw new Error('This selection changed while loading. Refresh and select it again.')
  }
  async function branch(repo: string, name: string) {
    return api<{ name: string; commit: { sha: string } }>('repos/' + repo + '/branches/' + encodeURIComponent(name))
  }
  async function resolve(id: string): Promise<RevisionSelection> {
    const selected = JSON.parse(id) as { repository: string; kind: string; name: string }
    const repo = await repository()
    if (selected.repository !== repo) throw new Error('The repository changed. Refresh the selection.')
    if (selected.kind === 'branch') {
      const chosen = await branch(repo, selected.name)
      await acquire(repo, 'refs/heads/' + chosen.name, chosen.commit.sha, 'branch')
      return { target: { sha: chosen.commit.sha, label: repo + ':' + chosen.name } }
    }
    const pull = await api<PullRequest>('repos/' + repo + '/pulls/' + selected.name)
    const base = await branch(pull.base.repo.full_name, pull.base.ref)
    await acquire(pull.base.repo.full_name, 'refs/heads/' + pull.base.ref, base.commit.sha, 'base')
    await acquire(repo, 'refs/pull/' + pull.number + '/head', pull.head.sha, 'head')
    return {
      base: { sha: base.commit.sha, label: pull.base.ref },
      target: { sha: pull.head.sha, label: (pull.head.repo?.full_name ?? repo) + ':' + pull.head.ref },
      url: pull.html_url,
    }
  }
  return {
    id: 'github', readiness, resolve,
    async list(query) {
      const repo = await repository()
      return query.collection === 'branches' ? discovery.branches(repo, query) : discovery.reviews(repo, query)
    },
    async configure(input: RevisionSourceSettings) {
      if (input.repository && !(await repositories()).some(repo => repo.id === input.repository)) throw new Error('Choose a repository from this checkout.')
      await git(['config', '--local', enabledKey, String(input.enabled)])
      if (input.repository) await git(['config', '--local', repositoryKey, input.repository])
    },
    async close() {
      closed = true
      controller.abort()
      await Promise.allSettled([...pending])
      for (const ref of ownedRefs) await driver('git', ['update-ref', '-d', ref])
      ownedRefs.clear()
    },
  }
}
