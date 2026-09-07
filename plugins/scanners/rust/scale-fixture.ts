import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { execute, manifest, writeTree } from './test/helpers.ts'

const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-rust-scale-'))
const root = path.join(temporary, 'scale')
try {
  await mkdir(root)
  const files: Record<string, string> = { 'Cargo.toml': manifest }
  const moduleName = (index: number) => `m${index.toString().padStart(4, '0')}`
  files['src/lib.rs'] = Array.from({ length: 1000 }, (_, index) => `mod ${moduleName(index)};`).join('\n')
  for (let module = 0; module < 1000; module++) {
    files[`src/${moduleName(module)}.rs`] = Array.from({ length: 10 }, (_, operation) => {
      return `pub fn f${operation}() { crate::${moduleName((module + 1) % 1000)}::f${operation}(); }`
    }).join('\n')
  }
  await writeTree(root, files)
  const { stdout } = await execute(process.execPath, [path.join(import.meta.dir, 'benchmark.ts'), root], { timeout: 120_000 })
  console.log(stdout)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
