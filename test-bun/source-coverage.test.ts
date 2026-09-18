import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createScanObservation } from '@groma/scanner'

import { reconcileScanObservations } from '../src/core.ts'
import { parseListWindow } from '../src/list-window.ts'
import { renderPlainRecord } from '../src/plain-world.ts'
import { readScannerConfig, writeScannerConfig } from '../src/scanner/modules/config.ts'
import { addScanner } from '../src/scanner/modules/inventory.ts'

const window = parseListWindow({}, [])
const sources = ['src/kept.ts', 'src/notes.txt', 'scripts/hidden.ts', 'src/keep.generated.ts']

async function write(root: string, file: string, content: string): Promise<void> {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true })
  await writeFile(path.join(root, file), content)
}

/** A generated plugin lists the files it would analyze, as official scanners do. */
async function plugin(root: string, id: string, files: readonly string[]): Promise<string> {
  const source = `./plugins/${id}`
  await write(root, `${source}/package.json`, JSON.stringify({
    name: `fixture-${id}`, version: '1.0.0', type: 'module', groma: { scanner: { id, entry: './index.js' } },
  }))
  await write(root, `${source}/index.js`, `export default {
    id: ${JSON.stringify(id)}, watch: { include: ['**/*'], exclude: [] },
    async listSourceFiles() { return ${JSON.stringify(files)} },
    async scan() { return undefined },
  }`)
  return source
}

async function repository(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-coverage-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  for (const file of sources) await write(root, file, 'export const value = 1\n')
  const child = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
  expect(await child.exited, await new Response(child.stderr).text()).toBe(0)
  const listed = ['src/kept.ts', 'scripts/hidden.ts', 'src/keep.generated.ts']
  for (const id of ['first', 'second']) await addScanner(root, await plugin(root, id, listed))
  return root
}

async function reason(root: string, target: string): Promise<string> {
  const result = await renderPlainRecord(root, target, true, window)
  expect(result.ok).toBeFalse()
  return result.ok ? '' : result.message
}

test.concurrent('a target outside the repository listing is reported as such, not as a coverage gap', async () => {
  const root = await repository()
  try {
    expect(await reason(root, 'src/kpet.ts')).toBe('unknown target: src/kpet.ts; not a repository file')
    expect(await reason(root, 'compnents')).toBe('unknown target: compnents; not a repository file')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('an excluded file names the configured pattern that hides it', async () => {
  const root = await repository()
  try {
    const config = await readScannerConfig(root)
    await writeScannerConfig(root, { ...config, exclude: ['**/*.md', '/scripts/'] })
    expect(await reason(root, 'scripts/hidden.ts')).toBe('no owner: scripts/hidden.ts; excluded by scanners.json pattern /scripts/')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a pattern decides with the whole list, so a later negation restores its file', async () => {
  const root = await repository()
  try {
    const config = await readScannerConfig(root)
    await writeScannerConfig(root, { ...config, exclude: ['**/*.generated.ts'] })
    expect(await reason(root, 'src/keep.generated.ts'))
      .toBe('no owner: src/keep.generated.ts; excluded by scanners.json pattern **/*.generated.ts')
    await writeScannerConfig(root, { ...config, exclude: ['**/*.generated.ts', '!src/keep.generated.ts'] })
    expect(await reason(root, 'src/keep.generated.ts'))
      .toBe('no owner: src/keep.generated.ts; read by first, second and not scanned yet, so run groma scan')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a repository file no scanner selects is separated from one waiting for a scan', async () => {
  const root = await repository()
  try {
    expect(await reason(root, 'src/notes.txt')).toBe('no owner: src/notes.txt; no enabled scanner reads it')
    expect(await reason(root, 'src/kept.ts'))
      .toBe('no owner: src/kept.ts; read by first, second and not scanned yet, so run groma scan')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a scanned file answers with its owner instead of a reason', async () => {
  const root = await repository()
  try {
    await reconcileScanObservations(root, [createScanObservation({
      scanner: { id: 'first', technology: 'fixture', engine: 'fixture', engineVersion: '1' },
      roots: [{ id: 'app', kind: 'project', name: 'App' }],
      files: [{ file: 'src/kept.ts', roots: ['app'], symbols: [] }],
      diagnostics: [],
    })])
    const result = await renderPlainRecord(root, 'src/kept.ts', true, window)
    expect(result.ok).toBeTrue()
    expect(result.ok && result.text).toContain('Owner')
  } finally { await rm(root, { recursive: true, force: true }) }
})
