import assert from 'node:assert/strict'
import path from 'node:path'

import { test } from 'bun:test'

import { loadArchitectureViewModel } from '../src/core.ts'
import { sheetScene } from '../src/sheet/scene.ts'
import { renderPage } from '../src/viewers/web/page.ts'
import { repositoryRoot, viewerFixtureRoot } from './helpers.ts'

test.concurrent('the page embeds the world and its sheet and mounts one SVG map', async () => {
  const { world } = await loadArchitectureViewModel(viewerFixtureRoot)
  const page = renderPage({ generation: 1, world, sheet: sheetScene(world) })
  assert.match(page, /<div id="map"><\/div>/)
  assert.match(page, /"sheet":\{"sheet":/)
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
