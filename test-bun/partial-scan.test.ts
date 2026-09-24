import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import manifest from '../plugins/scanners/typescript/package.json'
import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'
import { scannerFiles } from '../src/scanner/modules/selection.ts'

/** The files Groma hands the TypeScript scanner with its package defaults. */
const typescriptFiles = (root: string) => scannerFiles(root, manifest.groma.scanner)

for (const mixed of [false, true]) {
  test.concurrent(`partial scans retain ${mixed ? 'mixed' : 'unavailable'} scanner relationships and Code until a complete refresh`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'groma-partial-'))
    try {
      await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
      await mkdir(path.join(root, 'src'))
      await cp(path.resolve(import.meta.dir, '../test/fixtures/operation-wiring'), path.join(root, 'src'), { recursive: true })
      await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', bin: 'src/caller.ts' }))
      const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
      expect(await git.exited).toBe(0)
      const observation = (await scanTypeScriptSource(root, await typescriptFiles(root)))!
      const second = { ...observation, scanner: { ...observation.scanner, id: 'second' } }
      await reconcileScanObservations(root, mixed ? [observation, second] : [second])
      const before = await loadAnnotatedArchitecture(root)
      expect(before.relationships).toHaveLength(1)
      await rm(path.join(root, 'src/worker.ts'))
      const changed = { ...observation, files: observation.files.filter(file => file.file !== 'src/worker.ts'), operations: [], invocations: [] }
      await reconcileScanObservations(root, [changed])
      const partial = await loadAnnotatedArchitecture(root)
      expect(partial.relationships).toEqual(before.relationships)
      const owner = partial.elements.find(element => element.code.some(code => code.file === 'src/worker.ts'))!
      expect(owner.code.some(code => code.scanner === 'second')).toBe(true)
      if (mixed) expect(owner.code.some(code => code.scanner === observation.scanner.id)).toBe(true)
      await reconcileScanObservations(root, [changed, { ...changed, scanner: second.scanner }])
      const complete = await loadAnnotatedArchitecture(root)
      expect(complete.relationships).toHaveLength(0)
      expect(complete.elements.some(element => element.code.some(code => code.file === 'src/worker.ts'))).toBe(false)
    } finally { await rm(root, { recursive: true, force: true }) }
  })
}
