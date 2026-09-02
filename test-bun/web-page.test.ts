import assert from 'node:assert/strict'
import path from 'node:path'

import { test } from 'bun:test'

import { repositoryRoot } from './helpers.ts'

test.concurrent('the browser bundle only projects and paints', async () => {
  const build = await Bun.build({
    entrypoints: [path.join(repositoryRoot, 'src', 'viewers', 'web', 'render.ts')],
    target: 'browser',
  })
  assert.equal(build.success, true)
  const source = await build.outputs[0]!.text()
  assert.match(source, /createElementNS/)
  assert.doesNotMatch(source, /semanticView|sheetScene|routeAll/)
})
