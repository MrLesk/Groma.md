import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { writes } from '../src/authoring.ts'
import { removalBlocker } from '../src/removable.ts'
import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-remove-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/flows'), root, { recursive: true })
  await cp(path.resolve(import.meta.dir, '../test/fixtures/removal/obsolete.md'),
    path.join(root, 'groma/systems/service/containers/api/components/obsolete.md'))
  await mkdir(path.join(root, 'src'))
  await writeFile(path.join(root, 'src/entry.ts'), 'export function enter() {}')
  await writeFile(path.join(root, 'src/obsolete.ts'), 'export function obsolete() {}')
  const git = Bun.spawn(['git', 'init', '--quiet', root], { stderr: 'pipe' })
  expect(await git.exited).toBe(0)
  return root
}

test.concurrent('deleted source requires a scan before its empty component can be removed', async () => {
  const root = await fixture()
  try {
    const before = await loadAnnotatedArchitecture(root)
    await expect(writes.remove(root, { id: 'obsolete' })).rejects.toThrow()
    await rm(path.join(root, 'src/obsolete.ts'))
    await expect(writes.remove(root, { id: 'obsolete' })).rejects.toThrow()
    const observation = await scanTypeScriptSource(root)
    expect(observation).toBeDefined()
    await reconcileScanObservations(root, [observation!])
    const scanned = await loadAnnotatedArchitecture(root)
    const empty = scanned.elements.find(element => element.id === 'obsolete')!
    expect(empty.code).toEqual([])
    expect(empty.overview).toBe(before.elements.find(element => element.id === 'obsolete')!.overview)
    await writes.remove(root, { id: 'obsolete' })
    const after = await loadAnnotatedArchitecture(root)
    expect(after.elements).toEqual(scanned.elements.filter(element => element.id !== 'obsolete')
      .map(element => ({ ...element, children: element.children.filter(id => id !== 'obsolete') })))
    expect(after.relationships).toEqual(scanned.relationships)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('empty Code does not bypass flow, relationship, or scanned-container protection', async () => {
  const root = await fixture()
  try {
    const world = await loadAnnotatedArchitecture(root)
    const empty = { ...world, elements: world.elements.map(element => ({ ...element, code: [] })) }
    expect(removalBlocker(empty, 'obsolete')).toBeUndefined()
    expect(removalBlocker(empty, 'entry')).toContain('flows')
    expect(removalBlocker({ ...empty, flows: [] }, 'entry')).toContain('relate to it')
    expect(removalBlocker(empty, 'api')).toBeDefined()
    expect(removalBlocker(empty, 'service')).toBeDefined()
  } finally { await rm(root, { recursive: true, force: true }) }
})
