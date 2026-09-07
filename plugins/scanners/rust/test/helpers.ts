import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { scanRustSource } from '../src/index.ts'

export const execute = promisify(execFile)
export const projectRoot = path.resolve(import.meta.dir, '../../../..')
export const staged = path.resolve(import.meta.dir, '../dist')
export const executable = path.join(staged, 'bin', `groma-rust-scanner${process.platform === 'win32' ? '.exe' : ''}`)
export const manifest = '[package]\nname="sample"\nversion="0.1.0"\nedition="2024"\n'

export async function writeTree(root: string, files: Record<string, string>): Promise<void> {
  for (const [file, text] of Object.entries(files)) {
    const target = path.join(root, file)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, text)
  }
}

export async function fixture<T>(files: Record<string, string>, run: (root: string) => Promise<T>, mixed = false): Promise<T> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-rust-'))
  try {
    if (mixed) await cp(path.join(projectRoot, 'test/fixtures/rust-scanner'), root, { recursive: true })
    await writeTree(root, files)
    return await run(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

export async function scan(root: string) {
  const result = await scanRustSource(root, executable)
  if (result === undefined) throw new Error('expected Rust observation')
  return result
}

export async function cli(root: string, ...arguments_: string[]): Promise<string> {
  const result = await execute(process.execPath, [path.join(projectRoot, 'src/cli.ts'), ...arguments_], { cwd: root })
  return result.stdout
}

export async function snapshot(root: string, prefix = 'groma'): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  for (const file of (await readdir(path.join(root, prefix), { recursive: true, withFileTypes: true }))) {
    if (!file.isFile()) continue
    const absolute = path.join(file.parentPath, file.name)
    result[path.relative(root, absolute)] = await readFile(absolute, 'utf8')
  }
  return result
}
