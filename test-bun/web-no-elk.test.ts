import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'bun:test'

import { repositoryRoot } from './helpers.ts'

test.concurrent('the web server bundle excludes the ELK layout path', async () => {
  const build = await Bun.build({
    entrypoints: [path.join(repositoryRoot, 'src/viewers/web/server.ts')],
    target: 'bun',
  })
  assert.equal(build.success, true)
  const source = (await Promise.all(build.outputs.map(output => output.text()))).join('\n')
  assert.doesNotMatch(source, /elkjs|elk-worker|world-layout/)
})
