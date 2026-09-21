import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createScanObservation, parseScanObservation } from '@groma/scanner'
import { combineObservations, relocateObservation } from '../plugins/scanners/observations.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { editArchitecture } from '../src/edit.ts'
import { addFlow } from '../src/flow-authoring.ts'
import { addRelation } from '../src/relation.ts'
import type { AnnotatedArchitectureModel } from '../src/types.ts'

function observation(id = 'compiler') {
  return createScanObservation({
    scanner: { id, technology: id, engine: 'fixture', engineVersion: '1' },
    roots: [{ id: 'source', kind: 'package', name: 'Workspace' }],
    files: ['a/main', 'a/handler', 'b/main', 'shared', 'library'].map(file => ({ file, roots: ['source'], symbols: [] })),
    entryPoints: [
      { file: 'a/main', declaration: 'build', name: 'Service', files: ['a/main', 'a/handler', 'shared'] },
      { file: 'b/main', declaration: 'build', name: 'Service', files: ['b/main', 'shared'] },
    ],
    diagnostics: [],
  })
}

async function repository() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-entrypoints-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  for (const { file } of observation().files) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), '')
  }
  return root
}

function owner(model: AnnotatedArchitectureModel, file: string) {
  const owners = model.elements.filter(element => element.code.some(reference => reference.file === file))
  expect(owners).toHaveLength(1)
  return owners[0]!
}

test.concurrent('execution facts survive parsing and nested, overlapping compiler contexts', () => {
  const scan = observation()
  const shifted = relocateObservation(parseScanObservation(JSON.stringify(scan)), 'nested')
  const combined = combineObservations([{ key: 'one', observation: shifted }, { key: 'two', observation: shifted }])!
  expect(combined.entryPoints).toHaveLength(2)
  expect(combined.entryPoints![0]).toMatchObject({ file: 'nested/a/main', declaration: 'nested/build' })
  expect(combined.entryPoints![0]!.files).toContain('nested/a/handler')
  expect(() => createScanObservation({ ...scan, entryPoints: [{ ...scan.entryPoints![0]!, files: ['missing'] }] })).toThrow('unknown file')
  expect(() => createScanObservation({ ...scan, entryPoints: [{ ...scan.entryPoints![0]!, files: ['a/handler'] }] })).toThrow('own source file')
})

test.concurrent('execution entries establish distinct containers across scanners, without claiming libraries or shared files', async () => {
  for (const reverse of [false, true]) {
    const root = await repository()
    try {
      const first = observation('language'), second = observation('framework')
      second.entryPoints = [{ ...first.entryPoints![0]!, declaration: 'another-build', files: ['a/main', 'a/handler'] }]
      const unknown = { ...observation('other'), entryPoints: undefined }
      const scans = [first, second, unknown]
      await reconcileScanObservations(root, reverse ? scans.reverse() : scans)
      const model = await loadAnnotatedArchitecture(root)
      const containers = model.elements.filter(element => element.kind === 'container')
      expect(containers).toHaveLength(2)
      const containerIds = new Set(containers.map(element => element.id))
      expect(containerIds.has(owner(model, 'a/main').parent!)).toBe(true)
      expect(owner(model, 'a/main').parent).toBe(owner(model, 'a/handler').parent)
      expect(owner(model, 'a/main').parent).not.toBe(owner(model, 'b/main').parent)
      expect(containerIds.has(owner(model, 'b/main').parent!)).toBe(true)
      for (const file of ['shared', 'library']) {
        expect(model.elements.find(element => element.id === owner(model, file).parent)?.kind).toBe('system')
      }
      expect((await reconcileScanObservations(root, [...scans].reverse())).created).toBe(0)
      expect((await loadAnnotatedArchitecture(root)).elements).toEqual(model.elements)
    } finally { await rm(root, { recursive: true, force: true }) }
  }
})

test.concurrent('a rescan completes unknown placement with meaning, links, flows and source owners preserved', async () => {
  const root = await repository()
  try {
    const scan = observation()
    await reconcileScanObservations(root, [{ ...scan, entryPoints: undefined }])
    const before = await loadAnnotatedArchitecture(root)
    const a = owner(before, 'a/main'), b = owner(before, 'b/main')
    const filename = async (id: string) => (await loadArchitecture(root)).documents.find(document =>
      (document.frontmatter.groma as { id?: string })?.id === id)!.sourceFilename
    const oldA = await filename(a.id), oldB = await filename(b.id)
    const guide = path.posix.relative(path.posix.dirname(oldA), 'docs/Guide Notes.md').replaceAll(' ', '%20')
    const example = '`[Example](guide.md)`\n\n```md\n[Example](guide.md)\n```'
    await editArchitecture(root, { id: a.id, title: 'Order intake', overview: `Runs the intake. [Partner](${path.posix.relative(path.posix.dirname(oldA), oldB)}#details) [Guide](${guide})\n\n${example}` })
    await editArchitecture(root, { id: 'project', overview: `Start with [Intake](${path.posix.relative('groma', oldA)}).` })
    await editArchitecture(root, { id: b.id, overview: `[Intake](${path.posix.relative(path.posix.dirname(oldB), oldA)})` })
    await addRelation(root, { source: 'a/main', target: 'b/main', description: 'Submits the request', technology: 'Call' })
    await addFlow(root, 'Submit', { overview: 'Submits a request.', steps: [
      '| From | To | Action |', '| --- | --- | --- |',
      `| [Intake](${path.posix.relative('groma/flows', oldA)}) | [Partner](${path.posix.relative('groma/flows', oldB)}) | Submit |`,
    ].join('\n') })
    const authored = await loadAnnotatedArchitecture(root)
    await reconcileScanObservations(root, [scan])
    const after = await loadAnnotatedArchitecture(root)
    expect(owner(after, 'a/main')).toMatchObject({ id: a.id, title: 'Order intake', code: owner(authored, 'a/main').code })
    expect(owner(after, 'b/main').id).toBe(b.id)
    expect(after.elements.find(element => element.id === owner(after, 'a/main').parent)?.kind).toBe('container')
    expect(after.relationships).toEqual(authored.relationships)
    expect(after.flows).toEqual(authored.flows)
    const newA = await filename(a.id), newB = await filename(b.id)
    expect(newA).not.toBe(oldA)
    const aSource = await readFile(path.join(root, newA), 'utf8')
    expect(aSource).toContain(`(${path.posix.relative(path.posix.dirname(newA), newB)}#details)`)
    expect(aSource).toContain(`(${path.posix.relative(path.posix.dirname(newA), 'docs/Guide Notes.md').replaceAll(' ', '%20')})`)
    expect(aSource).toContain(example)
    expect(await readFile(path.join(root, 'groma/project.md'), 'utf8')).toContain(`(${path.posix.relative('groma', newA)})`)
    expect(await readFile(path.join(root, newB), 'utf8')).toContain(`(${path.posix.relative(path.posix.dirname(newB), newA)})`)
    await editArchitecture(root, { id: owner(after, 'a/main').parent!, newId: 'curated-runtime' })
    await reconcileScanObservations(root, [scan])
    expect(owner(await loadAnnotatedArchitecture(root), 'a/main').parent).toBe('curated-runtime')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('distinct entries in one compilation unit stay distinct from an already assigned helper', async () => {
  for (const knownLaunchers of [false, true]) {
    const root = await repository()
    try {
      const scan = observation()
      await reconcileScanObservations(root, [{ ...scan,
        files: knownLaunchers ? scan.files : scan.files.filter(file => file.file === 'library'),
        entryPoints: [{ file: 'library', declaration: 'build', name: 'Existing', files: ['library'] }],
      }])
      scan.entryPoints = scan.entryPoints!.map(entry => ({ ...entry, files: ['a/main', 'b/main', 'shared', 'library'] }))
      await reconcileScanObservations(root, [scan])
      const after = await loadAnnotatedArchitecture(root)
      expect(after.elements.filter(element => element.kind === 'container')).toHaveLength(3)
      expect(owner(after, 'a/main').parent).not.toBe(owner(after, 'b/main').parent)
      expect(owner(after, 'library').parent).toBe('existing')
      expect(after.elements.find(element => element.id === owner(after, 'shared').parent)?.kind).toBe('system')
    } finally { await rm(root, { recursive: true, force: true }) }
  }
})
