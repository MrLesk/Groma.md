import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ScanObservation } from '@groma/scanner'
import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { editArchitecture } from '../src/edit.ts'

const variants = [
  ['domain', 'atoms'], ['domain', 'molecules'], ['domain', 'organisms'],
  ['service', 'paint'], ['service', 'types'], ['serve', 'drawTicket'],
] as const

async function project(parent: string, name: string, rename: (text: string) => string) {
  const root = path.join(parent, name)
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  const files: Record<string, string> = JSON.parse(await readFile(
    path.resolve(import.meta.dir, '../test/fixtures/typescript-placement.json'), 'utf8'))
  for (const [file, source] of Object.entries(files)) {
    const target = path.join(root, rename(file))
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, rename(source))
  }
  const git = Bun.spawn(['git', 'init', '--quiet', root], { stderr: 'pipe' })
  expect(await git.exited).toBe(0)
  return root
}

function membership(scan: ScanObservation, normalize: (text: string) => string) {
  const roots = new Map(scan.roots.map(root => [root.id, root.file]))
  return scan.files.map(file => ({
    file: normalize(file.file),
    scopes: file.roots.map(root => normalize(roots.get(root)!)).sort(),
    declarations: file.symbols.length,
    operations: scan.operations!.filter(operation => operation.file === file.file).length,
  })).sort((left, right) => left.file.localeCompare(right.file))
}

for (const [neutral, special] of variants) {
  test.concurrent(`TypeScript placement treats ${special} like equivalent neutral source`, async () => {
    const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-ts-placement-'))
    const rename = (text: string) => text.replaceAll(neutral, special)
    const normalize = (text: string) => text.replaceAll(special, neutral)
    try {
      const baselineRoot = await project(temporary, 'neutral', text => text)
      const root = await project(temporary, 'renamed', rename)
      const baseline = (await scanTypeScriptSource(baselineRoot))!
      const scan = (await scanTypeScriptSource(root))!
      expect(membership(scan, normalize)).toEqual(membership(baseline, text => text))
      expect(scan.files).toHaveLength(3)
      expect(scan.files.every(file => file.symbols.length > 0)).toBe(true)
      expect(scan.operations).toHaveLength(3)
      const service = scan.files.find(file => file.file === rename('domain/service.ts'))!
      expect(scan.roots.find(root => root.id === service.roots[0])?.file).toBe('main.ts')
      await reconcileScanObservations(root, [scan])
      const before = await loadAnnotatedArchitecture(root)
      const component = before.elements.find(element => element.code.some(code => code.file === service.file))!
      await editArchitecture(root, { id: component.id, title: 'Curated responsibility' })
      const curated = await loadAnnotatedArchitecture(root)
      expect((await reconcileScanObservations(root, [(await scanTypeScriptSource(root))!])).created).toBe(0)
      expect(await loadAnnotatedArchitecture(root)).toEqual(curated)
    } finally { await rm(temporary, { recursive: true, force: true }) }
  })
}
