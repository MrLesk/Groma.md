import assert from 'node:assert/strict'
import { test } from 'bun:test'
import { githubRevisionSource } from '../plugins/revision-sources/github/src/index.ts'
import { entryId, githubDiscovery, type Api } from '../plugins/revision-sources/github/src/discovery.ts'
import type { Run } from '../plugins/revision-sources/github/src/commands.ts'

const base = 'a'.repeat(40)
const head = 'b'.repeat(40)

function commands(options: { enabled?: boolean; authentication?: Error; mismatch?: boolean; multiple?: boolean } = {}) {
  const calls: { program: string; args: string[] }[] = []
  const refs = new Map<string, string>()
  let enabled = options.enabled !== false
  function config(args: string[]) {
    if (args[1] === '--get-regexp') return 'remote.upstream.url git@github.com:owner/project.git\n' + (options.multiple ? 'remote.origin.url https://github.com/fork/project.git\n' : '')
    if (args[2] === '--get') return args[3]?.endsWith('enabled') ? String(enabled) : ''
    enabled = args.at(-1) === 'true'
    return ''
  }
  function gh(args: string[]) {
    if (args[0] === 'auth') {
      if (options.authentication) throw options.authentication
      return ''
    }
    const endpoint = args.find(value => value.startsWith('repos/'))!
    if (endpoint.includes('/pulls/')) return JSON.stringify({
      number: 7, html_url: 'https://github.com/owner/project/pull/7',
      head: { sha: head, ref: 'feature', repo: { full_name: 'contributor/project' } },
      base: { sha: 'c'.repeat(40), ref: 'main', repo: { full_name: 'owner/project' } },
    })
    return JSON.stringify({ name: 'main', commit: { sha: base } })
  }
  const resolvedRef = (args: string[]) => options.mismatch ? 'd'.repeat(40) : refs.get(args.at(-1)!.replace('^{commit}', ''))!
  function git(args: string[]) {
    if (args[0] === 'config') return config(args)
    if (args[0] === 'cat-file') throw new Error('Missing object')
    if (args.includes('fetch')) {
      const refspec = args.at(-1)!
      const ref = refspec.slice(refspec.indexOf(':') + 1)
      refs.set(ref, refspec.includes('refs/pull/') ? head : base)
      return ''
    }
    if (args[0] === 'rev-parse') return resolvedRef(args)
    if (args[0] === 'update-ref') { refs.delete(args.at(-1)!); return '' }
    throw new Error('Unexpected command ' + args.join(' '))
  }
  const run: Run = async (program, args) => {
    calls.push({ program, args })
    return program === 'gh' ? gh(args) : git(args)
  }
  return { run, calls, refs }
}

test.concurrent('fork PR resolution acquires the documented head ref and current base tip without checking out or updating user refs', async () => {
  const driver = commands()
  const source = githubRevisionSource('/unused', driver.run)
  try {
    const pair = await source.resolve(entryId('owner/project', 'pull', '7'))
    assert.equal(pair.base?.sha, base)
    assert.equal(pair.target.sha, head)
    const fetches = driver.calls.filter(call => call.args.includes('fetch'))
    assert.equal(fetches.length, 2)
    assert.ok(fetches[0]!.args.at(-1)?.startsWith('+refs/heads/main:refs/groma/revisions/'))
    assert.ok(fetches[1]!.args.at(-1)?.startsWith('+refs/pull/7/head:refs/groma/revisions/'))
    assert.ok(fetches.every(call => call.args.includes('--no-write-fetch-head')))
    assert.ok(!driver.calls.some(call => ['checkout', 'switch', 'reset'].includes(call.args[0]!)))
  } finally { await source.close() }
  assert.equal(driver.refs.size, 0)
  assert.ok(driver.calls.filter(call => call.args[0] === 'update-ref').every(call => call.args[2]?.startsWith('refs/groma/revisions/')))
})


test.concurrent('closing the source aborts an in-flight fetch and cleans its owned ref', async () => {
  const driver = commands()
  let started!: () => void
  const fetching = new Promise<void>(resolve => { started = resolve })
  const run: Run = (program, args, signal) => args.includes('fetch')
    ? new Promise<string>((_resolve, reject) => {
        signal!.addEventListener('abort', () => reject(new Error('Fetch aborted')), { once: true })
        started()
      })
    : driver.run(program, args, signal)
  const source = githubRevisionSource('/unused', run)
  const result = assert.rejects(source.resolve(entryId('owner/project', 'branch', 'main')), /aborted/)
  await fetching
  await source.close()
  await result
  assert.equal(driver.calls.filter(call => call.args[0] === 'update-ref').length, 1)
})

test.concurrent('a moving provider ref cannot silently substitute a different selected commit', async () => {
  const driver = commands({ mismatch: true })
  const source = githubRevisionSource('/unused', driver.run)
  try { await assert.rejects(source.resolve(entryId('owner/project', 'branch', 'main')), /changed while loading/) }
  finally { await source.close() }
})

test.concurrent('disabled sources need neither gh nor credentials; multiple remotes require explicit repository choice', async () => {
  const driver = commands({ enabled: false })
  const source = githubRevisionSource('/unused', driver.run)
  assert.equal((await source.readiness()).enabled, false)
  assert.ok(driver.calls.every(call => call.program === 'git'))
  await source.close()
  const multiple = githubRevisionSource('/unused', commands({ multiple: true }).run)
  assert.equal((await multiple.readiness()).repository, undefined)
  assert.equal((await multiple.readiness()).ready, false)
  await multiple.close()
})

test.concurrent('authentication, permission and rate-limit failures stay with the source', async () => {
  const source = githubRevisionSource('/unused', commands({ authentication: new Error('Sign in with gh auth login') }).run)
  const state = await source.readiness()
  assert.equal(state.ready, false)
  assert.match(state.message!, /gh auth login/)
  await source.close()
  const discovery = githubDiscovery(async () => { throw new Error('API rate limit exceeded') })
  await assert.rejects(discovery.branches('owner/project', { collection: 'branches' }), /rate limit/)
})

test.concurrent('branch search traverses every provider page before reporting complete matches', async () => {
  const endpoints: string[] = []
  const api: Api = async <T>(endpoint: string) => {
    endpoints.push(endpoint)
    return (endpoint.endsWith('page=1') ? Array.from({ length: 100 }, (_, index) => ({ name: 'branch-' + index, commit: { sha: base } }))
      : [{ name: 'wanted', commit: { sha: head } }]) as T
  }
  const page = await githubDiscovery(api).branches('owner/project', { collection: 'branches', search: 'wanted' })
  assert.equal(endpoints.length, 2)
  assert.equal(page.entries.length, 1)
  assert.equal(page.entries[0]?.sha, head)
  assert.equal(page.cursor, undefined)
})

test.concurrent('PR search preserves repository, explicit state and opaque page cursor', async () => {
  const fields: Record<string, string>[] = []
  const api: Api = async <T>(_endpoint: string, input?: Record<string, string>) => {
    fields.push(input!)
    return { data: { search: { issueCount: 31, nodes: [{
      number: 7, title: 'Change', state: 'CLOSED', isDraft: false, headRefName: 'feature', baseRefName: 'main',
      headRefOid: head, headRepository: { nameWithOwner: 'contributor/project' }, url: 'https://github.com/owner/project/pull/7',
    }], pageInfo: { hasNextPage: true, endCursor: 'opaque-next' } } } } as T
  }
  const discovery = githubDiscovery(api)
  const first = await discovery.reviews('owner/project', { collection: 'pulls', state: 'closed', search: 'cache' })
  await discovery.reviews('owner/project', { collection: 'pulls', state: 'closed', search: 'cache', cursor: first.cursor })
  assert.match(fields[0]!.search!, /repo:owner\/project/)
  assert.match(fields[0]!.search!, /is:closed is:unmerged/)
  assert.equal(fields[1]!.cursor, 'opaque-next')
  assert.equal(first.entries[0]?.sha, head)
  assert.match(first.entries[0]!.detail!, /contributor\/project/)
})
