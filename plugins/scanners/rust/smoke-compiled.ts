import assert from 'node:assert/strict'
import { copyFile, cp, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { loadAnnotatedArchitecture } from '../../../src/core.ts'
import { execute, projectRoot, snapshot, staged } from './test/helpers.ts'

if (process.platform !== 'linux') throw new Error('This isolated PATH smoke test currently targets Linux')
const root = await mkdtemp(path.join(os.tmpdir(), 'groma-rust-compiled-'))
try {
  await cp(path.join(projectRoot, 'test/fixtures/rust-scanner'), root, { recursive: true })
  await execute('git', ['init', '--quiet'], { cwd: root })
  await execute('git', ['add', '-A'], { cwd: root })
  const tools = path.join(root, '.tools')
  const home = path.join(root, '.home')
  const temporary = path.join(root, '.temp')
  await Promise.all([tools, home, temporary].map(directory => mkdir(directory)))
  const git = (await execute('which', ['git'])).stdout.trim()
  await symlink(git, path.join(tools, 'git'))
  const groma = path.join(tools, 'groma')
  await copyFile(path.join(projectRoot, 'dist/groma'), groma)
  await cp(staged, path.join(root, '.scanner-package'), { recursive: true })
  const env = { PATH: tools, HOME: home, TMPDIR: temporary, XDG_CACHE_HOME: path.join(home, '.cache') }
  const run = async (...args: string[]) => (await execute(groma, args, { cwd: root, env, timeout: 120_000 })).stdout
  console.log(await run('scanner', 'add', './.scanner-package'))
  console.log(await run('scanner', 'list'))
  console.log(await run('scan'))
  await run('add', 'relation', 'frontend/index.ts', 'backend/src/provider.rs', '--description', 'Requests a view', '--technology', 'HTTPS')
  await run('scan')
  const before = await snapshot(root)
  await run('scan')
  assert.deepEqual(await snapshot(root), before, 'Compiled rescan changed stable Markdown')
  const world = await loadAnnotatedArchitecture(root)
  const files = new Set(world.elements.flatMap(element => element.code.map(reference => reference.file)))
  for (const file of ['frontend/index.ts', 'frontend/transport.ts', 'backend/src/provider.rs', 'backend/src/worker.rs']) {
    if (!files.has(file)) throw new Error(`Compiled scan lost ${file}`)
  }
  if (!world.relationships.some(relation => relation.description?.includes('Invokes supplied opened callback'))) throw new Error('Compiled callback inference missing')
  if (!world.relationships.some(relation => relation.description === 'Requests a view')) throw new Error('Compiled rescan lost authored cross-language relation')
  console.log(JSON.stringify({ result: 'pass', sourceFiles: files.size, pathContains: ['git', 'groma'], cargo: false, rustc: false, node: false, npm: false, bun: false, standaloneScanner: true, freshTypeScriptWorkerCache: true }, null, 2))
} finally {
  await rm(root, { recursive: true, force: true })
}
