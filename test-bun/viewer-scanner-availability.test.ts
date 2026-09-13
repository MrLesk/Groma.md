import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { writeScannerConfig } from '../src/scanner/modules/config.ts'
import { scanRepository } from '../src/scanner.ts'
import { canRefreshViewerSources, scanForViewer, watchViewerSources } from '../src/viewers/source/scanning.ts'

async function setup() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-saved-view-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/flows'), root, { recursive: true })
  return root
}

async function snapshot(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  async function read(directory: string) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, item.name)
      if (item.isDirectory()) await read(file)
      else if (file.endsWith('.md')) result[path.relative(root, file)] = await readFile(file, 'utf8')
    }
  }
  await read(path.join(root, 'groma'))
  return result
}

async function plugin(root: string, id: string) {
  const directory = path.join(root, 'plugins', id)
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: id, version: '1.0.0',
    groma: { scanner: { id, entry: './index.ts' } } }))
  await writeFile(path.join(directory, 'index.ts'), 'throw new Error("Viewing saved architecture must not import an incomplete scanner selection")')
  return { id, source: directory }
}

for (const missing of [false, true]) {
  test.concurrent(`saved architecture is preserved with TypeScript ${missing ? 'missing' : 'unconfigured'} and another plugin installed`, async () => {
    const root = await setup()
    try {
      const other = await plugin(root, 'other')
      await writeScannerConfig(root, { scanners: [other, ...(missing ? [{ id: 'typescript', source: path.join(root, 'missing') }] : [])] })
      const records = await snapshot(root)
      const before = await loadAnnotatedArchitecture(root)
      expect(before.elements.some(element => element.code.some(code => code.scanner === 'typescript'))).toBe(true)
      expect(before.relationships.length).toBeGreaterThan(0)
      expect(await canRefreshViewerSources(root)).toBe(false)
      await scanForViewer(root)
      expect(await watchViewerSources(root, {})).toBeUndefined()
      await mkdir(path.join(root, 'src'), { recursive: true })
      await writeFile(path.join(root, 'src/entry.ts'), 'export const changed = true')
      expect(await snapshot(root)).toEqual(records)
      const after = await loadAnnotatedArchitecture(root)
      expect(after.relationships).toEqual(before.relationships)
      expect(after.elements.map(element => [element.id, element.code.map(code => [code.file, code.scanner])]))
        .toEqual(before.elements.map(element => [element.id, element.code.map(code => [code.file, code.scanner])]))
      if (missing) await expect(scanRepository(root)).rejects.toThrow('scanner typescript is missing')
    } finally { await rm(root, { recursive: true, force: true }) }
  })
}

test.concurrent('an empty selection preserves saved data and restoring its scanner enables source refresh', async () => {
  const root = await setup()
  try {
    await writeScannerConfig(root, { scanners: [] })
    const records = await snapshot(root)
    await scanForViewer(root)
    expect(await snapshot(root)).toEqual(records)
    expect(await canRefreshViewerSources(root)).toBe(false)
    const scanner = await plugin(root, 'typescript')
    await writeScannerConfig(root, { scanners: [scanner] })
    expect(await canRefreshViewerSources(root)).toBe(true)
  } finally { await rm(root, { recursive: true, force: true }) }
})
