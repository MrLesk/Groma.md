import assert from 'node:assert/strict'
import { test } from 'bun:test'
import { EMPTY_WORK_SNAPSHOT } from '@groma/work-source'
import { comparisonRepository } from './comparison-fixture.ts'
import { loadMapRoot } from '../src/viewers/web/runtime.ts'
import { createComparisonSession } from '../src/viewers/web/comparison/session.ts'
import { createRevisionSession } from '../src/viewers/web/revision/session.ts'
import type { WebPayload } from '../src/viewers/web/payload.ts'

test.concurrent('leaving comparison wins over an older in-flight comparison response and a live refresh', async () => {
  const repo = await comparisonRepository()
  try {
    const normal: WebPayload = { ...await loadMapRoot(repo.root), generation: 1, revision: null, work: EMPTY_WORK_SNAPSHOT, workGeneration: 0, pins: [] }
    const comparison = createComparisonSession(repo.root, () => normal, () => EMPTY_WORK_SNAPSHOT)
    const compared = await comparison.read({ base: repo.base, target: { kind: 'working-tree' } })
    const session = createRevisionSession()
    let finish!: (payload: WebPayload) => void
    const old = session.load(() => new Promise(resolve => { finish = resolve }), true)
    session.begin()
    let backgroundRead = false
    assert.equal(await session.load(async () => { backgroundRead = true; return compared }, false), undefined)
    assert.equal(backgroundRead, false)
    const current = await session.load(async () => normal, true)
    finish(compared)
    assert.equal(await old, undefined)
    assert.equal(current?.comparison, undefined)
    comparison.close()
  } finally { await repo.close() }
})

test.concurrent('cancelled revision selection cannot apply its eventual result or report its late failure', async () => {
  const session = createRevisionSession()
  let reject!: (reason: Error) => void
  const pending = session.load(() => new Promise((_resolve, failed) => { reject = failed }), true)
  session.cancel()
  reject(new Error('Late provider failure'))
  assert.equal(await pending, undefined)
  assert.equal(session.pending, false)
})
