import assert from 'node:assert/strict'
import { writeFile, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'bun:test'
import { comparisonRepository } from './comparison-fixture.ts'
import { readComparison, readChangeFile } from '../src/comparison/read.ts'
import { comparisonWorld, projectChanges } from '../src/comparison/project.ts'
import { scopeChanges } from '../src/comparison/model.ts'
import { readGitChanges, resolveRange } from '../src/history/git-state.ts'
import { listGitRevisions } from '../src/history/revisions.ts'
import { localRevisionSource } from '../src/history/local-source.ts'
import { readTaskDiff, taskRange } from '../src/viewers/source/diff.ts'
import type { WorkItem, WorkSnapshot } from '../src/types.ts'

test.concurrent('net working-tree changes preserve both owners, removals, binaries, untracked files and user Git state', async () => {
  const repo = await comparisonRepository()
  try {
    const range = { base: repo.base, target: { kind: 'working-tree' as const } }
    await repo.git(['rm', '--cached', 'src/orders.ts'])
    assert.equal((await readGitChanges(repo.root, range)).some(file => file.file === 'src/orders.ts'), false)
    await writeFile(path.join(repo.root, 'src/orders.ts'), 'export const total = 12\n')
    const indexOnly = await repo.git(['status', '--porcelain=v1'])
    const net = (await readGitChanges(repo.root, range)).find(file => file.file === 'src/orders.ts')!
    assert.equal(net.status, 'modified')
    assert.equal(net.additions, 1)
    assert.equal(net.deletions, 3)
    assert.equal(await repo.git(['status', '--porcelain=v1']), indexOnly)
    await repo.changed()
    await repo.git(['add', '.'])
    await writeFile(path.join(repo.root, 'src/orders.ts'), 'export const total = 99\n')
    await writeFile(path.join(repo.root, 'new.bin'), Buffer.from([0, 1, 2]))
    const status = await repo.git(['status', '--porcelain=v1'])
    const compared = await readComparison(repo.root, { base: repo.base, target: { kind: 'working-tree' } })
    const renamed = compared.files.find(file => file.previousFile === 'src/view.ts')!
    assert.equal(renamed.file, 'src/screen.ts')
    assert.equal(renamed.beforeOwner, 'orders')
    assert.equal(renamed.afterOwner, 'notify')
    assert.equal(compared.files.find(file => file.file === 'src/old.ts')?.beforeOwner, 'legacy')
    assert.equal(compared.files.find(file => file.file === 'new.bin')?.binary, true)
    assert.equal(compared.elements.find(element => element.id === 'orders')?.status, 'edited')
    assert.equal(compared.elements.find(element => element.id === 'notify')?.status, 'added')
    assert.equal(compared.elements.find(element => element.id === 'legacy')?.status, 'removed')
    const diff = await readChangeFile(repo.root, compared.range, compared.files.find(file => file.file === 'src/orders.ts')!)
    assert.ok(diff.hunks.flatMap(hunk => hunk.lines).some(line => line.kind === 'added' && line.text.includes('99')))
    assert.equal(await repo.git(['status', '--porcelain=v1']), status)
    assert.equal(await repo.git(['rev-parse', 'HEAD']), repo.base)
  } finally { await repo.close() }
})

test.concurrent('union keeps removed elements and target containment without mutating either snapshot', async () => {
  const repo = await comparisonRepository()
  try {
    await repo.changed()
    const compared = await readComparison(repo.root, { base: repo.base, target: { kind: 'working-tree' } })
    const original = JSON.stringify(compared)
    const world = comparisonWorld(compared)
    assert.equal(new Set(world.elements.map(element => element.id)).size, world.elements.length)
    assert.equal(world.elements.find(element => element.id === 'orders')?.parent, 'jobs')
    assert.equal(world.elements.find(element => element.id === 'legacy')?.parent, 'jobs')
    assert.deepEqual(compared.relationships.map(change => change.status).sort(), ['added', 'removed'])
    assert.equal(JSON.stringify(compared), original)
    const same = projectChanges(compared.range, compared.before, { ...compared.before, relationships: [...compared.before.relationships].reverse() }, [])
    assert.equal(same.relationships.length, 0)
    assert.equal(same.elements.length, 0)
  } finally { await repo.close() }
})

test.concurrent('removing the last file of a surviving component edits its code instead of deleting its identity', async () => {
  const repo = await comparisonRepository()
  try {
    await rm(path.join(repo.root, 'src/old.ts'))
    const compared = await readComparison(repo.root, { base: repo.base, target: { kind: 'working-tree' } })
    assert.deepEqual(compared.elements.map(element => [element.id, element.status]), [['legacy', 'edited']])
    const removed = await readChangeFile(repo.root, compared.range, compared.files[0]!)
    assert.equal(removed.status, 'deleted')
    assert.equal(removed.after, undefined)
    assert.ok(removed.before?.includes('legacy'))
  } finally { await repo.close() }
})

test.concurrent('branch comparison uses both tips even when the base advanced after divergence', async () => {
  const repo = await comparisonRepository()
  try {
    await repo.git(['checkout', '-b', 'feature'])
    await writeFile(path.join(repo.root, 'feature.txt'), 'feature\n')
    const target = await repo.commit()
    await repo.git(['checkout', 'main'])
    await writeFile(path.join(repo.root, 'base-only.txt'), 'base\n')
    const base = await repo.commit()
    const range = await resolveRange(repo.root, { base: 'main', target: { kind: 'commit', sha: 'feature' } })
    assert.deepEqual(range, { base, target: { kind: 'commit', sha: target } })
    const files = await readGitChanges(repo.root, range)
    assert.equal(files.find(file => file.file === 'base-only.txt')?.status, 'deleted')
    const ancestorFiles = await readGitChanges(repo.root, { base: repo.base, target: range.target })
    assert.ok(!ancestorFiles.some(file => file.file === 'base-only.txt'))
    const history = await listGitRevisions(repo.root)
    assert.equal(history[0]?.id, base)
    const source = localRevisionSource(repo.root)
    assert.equal((await source.readiness()).ready, true)
    assert.equal((await source.resolve('feature')).target.sha, target)
    assert.ok((await source.list({ collection: 'branches', search: 'feature' })).entries.some(entry => entry.sha === target))
    await source.close()
  } finally { await repo.close() }
})

function task(files: string[], overrides: Partial<WorkItem> = {}): WorkItem {
  return { id: 'TASK-1', title: 'Review orders', status: 'In Progress', assignees: [], references: ['legacy'], modifiedFiles: files,
    acceptanceCriteriaCompleted: 0, acceptanceCriteriaCount: 0, updatedAt: '', ...overrides }
}

test.concurrent('task and Git review share file meaning, while scope keeps endpoints and ignores references and unchanged files', async () => {
  const repo = await comparisonRepository()
  try {
    await writeFile(path.join(repo.root, 'src/orders.ts'), 'export const total = 42\n')
    const item = task(['src/orders.ts', 'src/old.ts'])
    const work: WorkSnapshot = { statuses: ['In Progress', 'Done'], defaultStatus: 'In Progress', items: [item, task(['src/orders.ts'], { id: 'TASK-2' })] }
    const range = await taskRange(repo.root, item, work)
    const compared = await readComparison(repo.root, range)
    const taskDiff = await readTaskDiff(repo.root, item, work)
    const file = compared.files.find(file => file.file === 'src/orders.ts')!
    const gitDiff = await readChangeFile(repo.root, range, file)
    assert.deepEqual(taskDiff.files[0], { ...gitDiff, shared: true })
    assert.equal(taskDiff.files[1]?.status, 'unchanged')
    const scoped = scopeChanges(compared, item.modifiedFiles)
    assert.deepEqual(scoped.range, range)
    assert.deepEqual(scoped.elements.map(element => element.id), ['orders'])
    assert.equal(scopeChanges(compared, []).elements.length, 0)
    await repo.commit(item.id + ' - ' + item.title)
    item.status = 'Done'
    const done = await taskRange(repo.root, item, work)
    assert.equal(done.target.kind, 'commit')
    assert.equal(done.base, repo.base)
    assert.notDeepEqual(done.target, range.target)
  } finally { await repo.close() }
})

test.concurrent('architecture-only edits are evidence, but unavailable snapshots are never empty worlds', async () => {
  const repo = await comparisonRepository()
  try {
    const file = path.join(repo.root, 'groma/systems/shop/containers/api/components/orders.md')
    await writeFile(file, (await readFile(file, 'utf8')).replace('title: Order processing', 'title: Processing'))
    const compared = await readComparison(repo.root, { base: repo.base, target: { kind: 'working-tree' } })
    assert.deepEqual(compared.elements.find(element => element.id === 'orders')?.reasons, ['Name'])
    assert.equal(scopeChanges(compared, ['src/orders.ts']).elements.length, 0)
    await repo.git(['rm', '-rf', 'groma'])
    const empty = await repo.commit()
    await assert.rejects(readComparison(repo.root, { base: repo.base, target: { kind: 'commit', sha: empty } }), /Architecture snapshot unavailable/)
  } finally { await repo.close() }
})
