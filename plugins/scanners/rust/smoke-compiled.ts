import { createHash } from 'node:crypto'
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execute } from './src/project.ts'
import { loadAnnotatedArchitecture } from '../../../src/core.ts'

const directory = path.dirname(fileURLToPath(import.meta.url))
const groma = path.resolve(process.argv[2] ?? 'dist/groma')
const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-rust-package-'))
const root = path.join(temporary, 'project')

function requireResult(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function markdown() {
  const files = (await readdir(path.join(root, 'groma'), { recursive: true })).filter(file => file.endsWith('.md')).sort()
  return JSON.stringify(await Promise.all(files.map(async file => [file, await readFile(path.join(root, 'groma', file), 'utf8')])))
}

async function cli(...args: string[]) {
  return execute(groma, args, { cwd: root, maxBuffer: 16 * 1024 * 1024 })
}

try {
  const packed = await execute('npm', ['pack', path.join(directory, 'dist/package'), '--ignore-scripts',
    '--json', '--pack-destination', temporary])
  const archive = JSON.parse(packed.stdout)[0].filename as string
  await execute('tar', ['-xzf', path.join(temporary, archive), '-C', temporary])
  await cp(path.join(directory, '../../../test/fixtures/rust-semantic'), root, { recursive: true })
  await execute('cargo', ['generate-lockfile', '--offline'], { cwd: root })
  await execute('git', ['init', '--quiet'], { cwd: root })
  await execute('git', ['add', '-A'], { cwd: root })
  await cli('scanner', 'add', path.join(temporary, 'package'))
  await cli('scanner', 'check')
  await cli('scan')
  const world = await loadAnnotatedArchitecture(root)
  const provider = world.elements.find(element => element.code.some(code => code.file === 'src/provider.rs'))!
  const api = world.elements.find(element => element.code.some(code => code.file === 'src/api.rs'))!
  requireResult(provider && api, 'Packaged scan omitted supported files')
  await cli('edit', provider.id, '--combine', api.id)
  await cli('edit', provider.id, '--overview', 'Owns execution.')
  await cli('scan')
  const before = await markdown()
  await cli('scan')
  requireResult(await markdown() === before, 'Repeat scan changed curated Markdown')
  await writeFile(path.join(root, 'src/provider.rs'), 'pub fn broken(')
  let failed = false
  try { await cli('scan') } catch { failed = true }
  requireResult(failed && await markdown() === before, 'Failed scan did not preserve Markdown')
  const result = {
    platform: process.platform, arch: process.arch,
    packageSha256: createHash('sha256').update(await readFile(path.join(temporary, archive))).digest('hex'),
    compiledBinarySha256: createHash('sha256').update(await readFile(groma)).digest('hex'),
    readiness: 'ready', curatedRepeat: true, failedScanPreserved: true,
  }
  await writeFile(path.join(directory, 'dist/compiled-validation.json'), `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
} finally { await rm(temporary, { recursive: true, force: true }) }
