import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { installScanners } from '../src/scanner/modules/inventory.ts'
import { writeScannerConfig } from '../src/scanner/modules/config.ts'
import { loadAnnotatedArchitecture } from '../src/core.ts'

for (const present of [false, true]) {
  test.concurrent(`bulk restore ${present ? 'accepts an available' : 'reports a missing'} local scanner without changing project data`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'groma-local-restore-'))
    try {
      await cp(path.resolve(import.meta.dir, '../test/fixtures/flows'), root, { recursive: true })
      const source = './plugin'
      if (present) {
        await mkdir(path.join(root, source))
        await writeFile(path.join(root, source, 'package.json'), JSON.stringify({ name: 'local', version: '1.0.0',
          groma: { scanner: { id: 'local', entry: './index.js' } } }))
        await writeFile(path.join(root, source, 'index.js'), 'throw new Error("Restore must not execute the scanner")')
      }
      await writeScannerConfig(root, { scanners: [{ id: 'local', source }] })
      const selection = await readFile(path.join(root, 'groma/scanners.json'), 'utf8')
      const architecture = await loadAnnotatedArchitecture(root)
      if (present) expect(await installScanners(root)).toBe(0)
      else await expect(installScanners(root)).rejects.toThrow('local scanner directory: ./plugin')
      expect(await readFile(path.join(root, 'groma/scanners.json'), 'utf8')).toBe(selection)
      const after = await loadAnnotatedArchitecture(root)
      expect(after.elements).toEqual(architecture.elements)
      expect(after.relationships).toEqual(architecture.relationships)
    } finally { await rm(root, { recursive: true, force: true }) }
  })
}
