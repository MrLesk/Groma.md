import assert from 'node:assert/strict'
import { test } from 'bun:test'
import { EMPTY_WORK_SOURCE } from '@groma/work-source'
import type { RevisionSource } from '@groma/revision-source'
import { comparisonRepository } from './comparison-fixture.ts'
import { createWebMapSession } from '../src/viewers/web/map-session.ts'
import { createComparisonSession } from '../src/viewers/web/comparison/session.ts'
import type { WebPayload } from '../src/viewers/web/payload.ts'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

test.concurrent('ordinary dirty and historical maps stay plain; explicit comparison and injected discovery use the same host', async () => {
  const repo = await comparisonRepository()
  let closed = false
  const source: RevisionSource = {
    id: 'example',
    readiness: async () => ({ id: 'example', label: 'Example', ready: true, enabled: true, collections: [{ id: 'branches', label: 'Branches' }] }),
    list: async () => ({ entries: [{ id: 'opaque', title: 'Example branch' }] }),
    resolve: async () => ({ target: { sha: repo.base, label: 'Example branch' } }),
    close: async () => { closed = true },
  }
  let session: Awaited<ReturnType<typeof createWebMapSession>> | undefined
  try {
    await repo.changed()
    const profilePath = path.join(repo.root, 'groma/project.md')
    await writeFile(profilePath, (await readFile(profilePath, 'utf8')).replace('title: Order service', 'title: Current project'))
    session = await createWebMapSession(repo.root, { scan: false, workSource: EMPTY_WORK_SOURCE, revisionSources: [source] })
    const get = (url: string) => session!.fetch(new Request('http://localhost' + url))
    const current = await (await get('/world.json')).json() as WebPayload
    assert.equal(current.revision, null)
    assert.equal(current.comparison, undefined)
    const historic = await (await get('/world.json?revision=' + repo.base)).json() as WebPayload
    assert.equal(historic.revision?.id, repo.base)
    assert.equal(historic.comparison, undefined)
    assert.ok(historic.world.elements.some(element => element.id === 'legacy'))
    const compared = await (await get('/world.json?base=' + repo.base)).json() as WebPayload
    assert.equal(compared.comparison?.range.base, repo.base)
    assert.equal(compared.comparison?.range.target.kind, 'working-tree')
    assert.ok(compared.world.elements.some(element => element.id === 'legacy'))
    assert.ok(compared.world.elements.some(element => element.id === 'notify'))
    const sources = await (await get('/revision-sources')).json() as { id: string }[]
    assert.equal(sources[0]?.id, 'example')
    const selected = await (await get('/revision-resolve?source=example&id=opaque')).json() as { target: { sha: string } }
    assert.equal(selected.target.sha, repo.base)
    const normal = await (await get('/world.json')).json() as WebPayload
    assert.equal(normal.comparison, undefined)
    const fixed = await (await get('/world.json?base=' + repo.base + '&revision=' + repo.base)).json() as WebPayload
    assert.notDeepEqual(current.project, historic.project)
    assert.deepEqual(fixed.project, historic.project)
    assert.deepEqual(compared.comparison?.projects, { before: historic.project, after: current.project })
    await writeFile(path.join(repo.root, 'outside-scanner.txt'), 'new\n')
    assert.equal(fixed.comparison?.files.length, 0)
    const lifecycle = createComparisonSession(repo.root, () => current, () => current.work)
    const committedRead = lifecycle.read({ base: repo.base, target: { kind: 'commit', sha: repo.base } })
    lifecycle.invalidate()
    assert.equal((await committedRead).comparison?.files.length, 0)
    const liveRead = lifecycle.read({ base: repo.base, target: { kind: 'working-tree' } })
    lifecycle.invalidate()
    await assert.rejects(liveRead, /Working tree changed/)
    const applied = (await lifecycle.read({ base: repo.base, target: { kind: 'working-tree' } })).comparison!
    lifecycle.invalidate()
    await assert.rejects(lifecycle.file(applied.id, 'src/orders.ts'), /Working tree changed/)
    lifecycle.close()
    assert.equal((await get('/world.json?base=missing')).status, 422)
  } finally {
    await session?.close()
    await repo.close()
  }
  assert.equal(closed, true)
})
