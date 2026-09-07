import { chmod, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { writeNotices } from './notices.ts'

const directory = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(directory, '../../..')
const manifest = path.join(directory, 'native/Cargo.toml')
const build = Bun.spawn(['cargo', 'build', '--release', '--locked', '--manifest-path', manifest], {
  cwd: directory,
  env: { ...process.env, CARGO_TARGET_DIR: path.join(directory, 'native/target') },
  stdin: 'ignore',
  stdout: 'inherit',
  stderr: 'inherit',
})
if (await build.exited !== 0) throw new Error('Rust scanner build failed')

const output = path.join(directory, 'dist')
const executable = `groma-rust-scanner${process.platform === 'win32' ? '.exe' : ''}`
await mkdir(path.join(output, 'bin'), { recursive: true })
const bundle = await Bun.build({
  entrypoints: [path.join(directory, 'src/index.ts')],
  outdir: output,
  target: 'node',
  format: 'esm',
  minify: false,
})
if (!bundle.success) throw new AggregateError(bundle.logs, 'Rust scanner adapter build failed')
await copyFile(path.join(directory, 'native/target/release', executable), path.join(output, 'bin', executable))
await chmod(path.join(output, 'bin', executable), 0o755)
await writeFile(path.join(output, 'package.json'), `${JSON.stringify({
  name: '@groma/scanner-rust',
  version: '0.1.0',
  private: true,
  type: 'module',
  license: 'MIT',
  os: [process.platform],
  cpu: [process.arch],
  groma: { scanner: { id: 'rust', entry: './index.js' } },
  files: ['index.js', 'bin', 'LICENSE', 'THIRD_PARTY_NOTICES.md'],
}, null, 2)}\n`)
await writeFile(path.join(output, 'LICENSE'), await readFile(path.join(root, 'LICENSE'), 'utf8'))
await writeNotices(manifest, output)
console.log(`Staged ${process.platform}/${process.arch} scanner: ${output}`)
