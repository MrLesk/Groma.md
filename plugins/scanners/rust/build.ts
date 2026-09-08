import { execFile } from 'node:child_process'
import { chmod, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { writeNotices } from './notices.ts'

const execute = promisify(execFile)
const directory = path.dirname(fileURLToPath(import.meta.url))
const manifest = path.join(directory, 'native/Cargo.toml')
export const workerName = `groma-rust-scanner${process.platform === 'win32' ? '.exe' : ''}`

/** Maintainer build. Consumers use the native worker and a bundled ESM adapter. */
export async function buildPackage(output: string): Promise<void> {
  const target = process.env.CARGO_TARGET_DIR ?? path.join(directory, 'native/target')
  await execute('cargo', ['build', '--release', '--locked', '--manifest-path', manifest], {
    env: { ...process.env, CARGO_TARGET_DIR: target }, maxBuffer: 16 * 1024 * 1024,
  })
  await mkdir(path.join(output, 'dist/bin'), { recursive: true })
  const bundle = await Bun.build({
    entrypoints: [path.join(directory, 'src/index.ts')], outdir: path.join(output, 'src'),
    target: 'node', format: 'esm', naming: 'index.js',
  })
  if (!bundle.success) throw new AggregateError(bundle.logs, 'Rust scanner adapter build failed')
  const binary = path.join(output, 'dist/bin', workerName)
  await copyFile(path.join(target, 'release', workerName), binary)
  await chmod(binary, 0o755)
  const source = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
  await writeFile(path.join(output, 'package.json'), `${JSON.stringify({
    name: source.name, version: source.version, private: true, type: 'module', license: 'MIT',
    os: [process.platform], cpu: [process.arch],
    groma: { scanner: { id: 'rust', entry: './src/index.js' } },
    files: ['src', 'dist/bin', 'LICENSE', 'THIRD_PARTY_NOTICES.md'],
  }, null, 2)}\n`)
  await copyFile(path.join(directory, '../../../LICENSE'), path.join(output, 'LICENSE'))
  await writeNotices(manifest, output)
}

if (import.meta.main) {
  const output = path.join(directory, 'dist/package')
  await buildPackage(output)
  await mkdir(path.join(directory, 'dist/bin'), { recursive: true })
  await copyFile(path.join(output, 'dist/bin', workerName), path.join(directory, 'dist/bin', workerName))
  console.log(output)
}
