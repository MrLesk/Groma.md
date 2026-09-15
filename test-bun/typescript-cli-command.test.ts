import { expect, test } from 'bun:test'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { editArchitecture } from '../src/edit.ts'

const fixture: {
  initial: Record<string, string>
  added: Record<string, string>
  independent: Record<string, string>
  cases: { name: string; manifest: Record<string, unknown>; independent?: boolean }[]
} = JSON.parse(await readFile(path.resolve(import.meta.dir, '../test/fixtures/typescript-cli-command.json'), 'utf8'))

for (const scenario of fixture.cases) {
  test.concurrent(`adding an imported helper preserves ownership with ${scenario.name}`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'groma-cli-command-'))
    try {
      await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
      for (const [file, source] of Object.entries(fixture.initial)) await writeFile(path.join(root, file), source)
      await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'command-fixture', ...scenario.manifest }))
      if (scenario.independent) {
        for (const [file, source] of Object.entries(fixture.independent)) await writeFile(path.join(root, file), source)
      }
      const git = Bun.spawn(['git', 'init', '--quiet', root], { stderr: 'pipe' })
      expect(await git.exited).toBe(0)
      await reconcileScanObservations(root, [(await scanTypeScriptSource(root))!])
      const initial = await loadAnnotatedArchitecture(root)
      const entry = initial.elements.find(element => element.code.some(code => code.file === 'main.ts'))!
      await editArchitecture(root, { id: entry.id, overview: 'Runs the selected operation.' })
      const curated = await loadAnnotatedArchitecture(root)

      for (const [file, source] of Object.entries(fixture.added)) await writeFile(path.join(root, file), source)
      const scan = (await scanTypeScriptSource(root))!
      const modules = scan.roots.filter(candidate => candidate.kind === 'module')
      expect(modules.map(candidate => candidate.file).sort()).toEqual(scenario.independent ? ['main.ts', 'worker.ts'] : ['main.ts'])
      const mainRoot = modules.find(candidate => candidate.file === 'main.ts')!.id
      expect(scan.files.find(file => file.file === 'command.ts')!.roots).toEqual([mainRoot])
      expect((await reconcileScanObservations(root, [scan])).created).toBe(1)
      const updated = await loadAnnotatedArchitecture(root)
      const commands = updated.elements.filter(element => element.code.some(code => code.file === 'command.ts'))
      expect(commands).toHaveLength(1)
      expect(commands[0]!.parent).toBe(entry.parent)
      expect(updated.elements.filter(element => element.kind === 'container'))
        .toEqual(curated.elements.filter(element => element.kind === 'container').map(container => ({
          ...container, children: container.id === entry.parent
            ? [...container.children, commands[0]!.id].sort() : container.children,
        })))
      for (const previous of curated.elements.filter(element => element.kind === 'component')) {
        expect(updated.elements.find(element => element.id === previous.id)).toEqual(previous)
      }

      for (let pass = 0; pass < 2; pass++) {
        expect((await reconcileScanObservations(root, [(await scanTypeScriptSource(root))!])).created).toBe(0)
        expect(await loadAnnotatedArchitecture(root)).toEqual(updated)
      }
    } finally { await rm(root, { recursive: true, force: true }) }
  })
}
