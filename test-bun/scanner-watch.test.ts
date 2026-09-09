import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import { loadAnnotatedArchitecture } from '../src/core.ts'
import { watchScan } from '../src/scanner.ts'

test.concurrent('the first source edit immediately after watch startup reaches the map', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-source-watch-'))
  let watcher: Awaited<ReturnType<typeof watchScan>> | undefined
  try {
    const fixtures = path.resolve(import.meta.dir, '../test/fixtures')
    await cp(path.join(fixtures, 'empty-project'), root, { recursive: true })
    await mkdir(path.join(root, 'src'))
    const source = await readFile(path.join(fixtures, 'startup-source/src/main.ts'), 'utf8')
    const git = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
    assert.equal(await git.exited, 0, await new Response(git.stderr).text())
    const folded = Promise.withResolvers<void>()
    watcher = await watchScan(root, { onFold: () => folded.resolve(), onError: folded.reject })
    await writeFile(path.join(root, 'src/main.ts'), source)
    await folded.promise
    const model = await loadAnnotatedArchitecture(root)
    const owners = model.elements.filter(element => element.code.some(code => code.file === 'src/main.ts'))
    assert.equal(owners.length, 1)
  } finally {
    await watcher?.close()
    await rm(root, { recursive: true, force: true })
  }
})
