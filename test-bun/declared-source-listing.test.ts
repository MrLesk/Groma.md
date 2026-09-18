import { expect, test } from 'bun:test'
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { buildWorker } from '../plugins/scanners/java/build.ts'
import java from '../plugins/scanners/java/src/index.ts'
import { readJavaInput } from '../plugins/scanners/java/src/java-input.ts'
import { javaCommand } from '../plugins/scanners/java/src/process.ts'
import rust from '../plugins/scanners/rust/src/index.ts'

async function repository(fixture: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-declared-listing-'))
  await cp(path.resolve(import.meta.dir, `../test/fixtures/${fixture}`), root, { recursive: true })
  const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
  expect(await git.exited, await new Response(git.stderr).text()).toBe(0)
  return root
}

test.concurrent('the Java listing reads each Maven source root the way the scan does', async () => {
  const [root, top] = await Promise.all([repository('java-declared-roots'), repository('java-root-source')])
  try {
    // basedir, property, entity and CDATA roots and a root inside a build directory are read; an aggregator has none.
    expect(await java.listSourceFiles(root)).toEqual([
      'basedir/source/A.java', 'cdata/src/cd/D.java', 'entity/src/a&b/E.java', 'gen/build/generated/java/G.java',
      'property/code/B.java',
    ])
    expect(await java.listSourceFiles(top)).toEqual(['Root.java'])
  } finally { await Promise.all([root, top].map(directory => rm(directory, { recursive: true, force: true }))) }
})

test.concurrent('the Java scan reads the files its listing names', async () => {
  const [root, build] = await Promise.all([
    repository('java-declared-roots'), mkdtemp(path.join(os.tmpdir(), 'groma-declared-worker-')),
  ])
  try {
    const worker = path.join(build, 'worker.jar')
    await buildWorker(worker)
    const scanned: string[] = []
    for (const project of await readdir(root)) {
      if (project === '.git') continue
      const input = await readJavaInput(path.join(root, project), javaCommand(), worker)
      scanned.push(...(input?.files ?? []).map(file => `${project}/${file}`))
    }
    expect(scanned.sort()).toEqual(await java.listSourceFiles(root))
  } finally { await Promise.all([root, build].map(directory => rm(directory, { recursive: true, force: true }))) }
}, 60000)

test.concurrent('the Rust listing follows the selected manifest to every target root module', async () => {
  const root = await repository('rust-declared-roots')
  try {
    expect(await rust.listSourceFiles(root, { manifest: 'app/Cargo.toml' }))
      .toEqual(['app/core/lib.rs', 'app/core/model.rs', 'app/src/bin/extra.rs', 'app/tools/cli.rs'])
  } finally { await rm(root, { recursive: true, force: true }) }
})
