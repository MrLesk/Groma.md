import assert from 'node:assert/strict'
import path from 'node:path'

import { test } from 'bun:test'

import { loadArchitectureViewModel } from '../src/core.ts'
import { sheetScene } from '../src/sheet/scene.ts'
import { renderPage } from '../src/viewers/web/page.ts'
import { repositoryRoot, viewerFixtureRoot } from './helpers.ts'

test.concurrent('the page embeds the world and its sheet and mounts one SVG map', async () => {
  const { world } = await loadArchitectureViewModel(viewerFixtureRoot)
  const page = renderPage({
    generation: 1,
    project: null,
    revision: null,
    revisions: [
      { id: 'a'.repeat(40), shortId: 'aaaaaaa', date: '2026-08-27T16:42:00+02:00', subject: 'Map history', body: 'Full map notes.', tag: 'v2.0.0', compatible: true },
      { id: 'b'.repeat(40), shortId: 'bbbbbbb', date: '2026-07-27T11:20:00+02:00', subject: 'Old contract', body: '', compatible: false },
    ],
    workGeneration: 0,
    world,
    sheet: sheetScene(world),
    work: { statuses: [], defaultStatus: '', items: [] },
    pins: [],
  })
  assert.match(page, /<div id="map"><\/div>/)
  assert.match(page, /"project":null/)
  assert.match(page, /"sheet":\{"sheet":/)
  assert.match(page, /<details id="revision">/)
})

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
