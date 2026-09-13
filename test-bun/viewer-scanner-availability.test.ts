import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { writeScannerConfig } from '../src/scanner/modules/config.ts'
import { scanRepository, watchScan } from '../src/scanner.ts'
import { createScannerSession } from '../src/scanner/session.ts'

async function setup() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-saved-view-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/flows'), root, { recursive: true })
  const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
  expect(await git.exited).toBe(0)
  return root
}

async function snapshot(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  for (const file of await readdir(path.join(root, 'groma'), { recursive: true })) {
    if (file.endsWith('.md')) result[file] = await readFile(path.join(root, 'groma', file), 'utf8')
  }
  return result
}

async function plugin(root: string, id: string, fail = false) {
  const directory = path.join(root, 'plugins', id)
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: id, version: '1.0.0',
    groma: { scanner: { id, entry: './index.ts' } } }))
  await writeFile(path.join(directory, 'index.ts'), `import { writeFile } from 'node:fs/promises'
export default { id: '${id}', watch: { include: ['**/*.fixture'], exclude: [] }, async scan(root) {
  await writeFile(root + '/${id}.called', 'scanned')
  ${fail ? "throw new Error('Project tooling failed')" : 'return undefined'}
} }`)
  return { id, source: directory }
}

for (const missing of [false, true]) {
  test.concurrent(`saved architecture survives an available scanner with TypeScript ${missing ? 'missing' : 'unselected'}`, async () => {
    const root = await setup()
    try {
      const other = await plugin(root, 'other')
      await writeScannerConfig(root, { scanners: [other, ...(missing ? [{ id: 'typescript', source: path.join(root, 'missing') }] : [])] })
      const records = await snapshot(root)
      const before = await loadAnnotatedArchitecture(root)
      expect(before.relationships.length).toBeGreaterThan(0)
      await scanRepository(root)
      expect(await readFile(path.join(root, 'other.called'), 'utf8')).toBe('scanned')
      expect(await snapshot(root)).toEqual(records)
      expect((await loadAnnotatedArchitecture(root)).relationships).toEqual(before.relationships)
    } finally { await rm(root, { recursive: true, force: true }) }
  })
}

test.concurrent('empty scanning does not write saved data or start scan callbacks', async () => {
  const root = await setup()
  try {
    await writeScannerConfig(root, { scanners: [] })
    const before = await snapshot(root)
    expect(await scanRepository(root)).toEqual({ created: 0, refreshed: 0, matched: 0 })
    const watcher = await watchScan(root, { onFold() { throw new Error('empty scanner selection ran') } })
    await watcher.close()
    expect(await snapshot(root)).toEqual(before)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a live session reports failed tooling without preventing saved architecture access', async () => {
  const root = await setup()
  let session: Awaited<ReturnType<typeof createScannerSession>> | undefined
  try {
    const scanner = await plugin(root, 'broken', true)
    await writeScannerConfig(root, { scanners: [scanner] })
    const before = await snapshot(root)
    session = await createScannerSession(root)
    await session.reconfigure()
    expect(session.state.notice.tone).toBe('error')
    expect(session.state.scanners[0]?.status).toBe('blocked')
    expect(await snapshot(root)).toEqual(before)
    expect((await loadAnnotatedArchitecture(root)).relationships.length).toBeGreaterThan(0)
    await session.change({ action: 'remove', id: scanner.id })
    expect(session.state.scanners.some(item => item.id === scanner.id)).toBe(false)
    expect(await snapshot(root)).toEqual(before)
  } finally { await session?.close(); await rm(root, { recursive: true, force: true }) }
})
