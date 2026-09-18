import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { CodeSymbol } from '@groma/scanner'
import { buildPackage } from '../plugins/scanners/java/build.ts'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { addScanner } from '../src/scanner/modules/inventory.ts'
import { readCodeStructure } from '../src/viewers/source/structure.ts'

test.concurrent('a component outlines its Java file beside a TypeScript file under the Java visibility rules', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-java-outline-'))
  try {
    const root = path.join(temporary, 'project')
    const artifact = path.join(temporary, 'scanner')
    await buildPackage(artifact)
    await cp(path.resolve(import.meta.dir, '../test/fixtures/java-outline'), root, { recursive: true })
    const git = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
    expect(await git.exited, await new Response(git.stderr).text()).toBe(0)
    await addScanner(root, artifact)
    await addScanner(root, path.resolve(import.meta.dir, '../plugins/scanners/typescript'))
    const world = await loadAnnotatedArchitecture(root)
    const component = world.elements.find(element => element.kind === 'component')!
    const files = await readCodeStructure(root, world, null, component.representationId) ?? []
    expect(files.map(file => file.file)).toEqual([...new Set(component.code.map(reference => reference.file))])
    const symbol = ({ name, line, visibility, entry }: CodeSymbol) => [name, line, visibility, entry]
    const outline = (file: string) => files.find(candidate => candidate.file.endsWith(file))!.declarations.map(declaration => [
      declaration.kind, ...symbol(declaration), declaration.kind === 'type' ? declaration.members.map(symbol) : [],
    ])
    // Fields, initializers, nested and anonymous types, and enum constant bodies are absent.
    // Code links name the type as Orders and a method as Orders.place; constructors share the type's name.
    // The first place has a comment naming it after its return type; the name's own line still counts.
    expect(outline('Orders.java')).toEqual([
      ['type', 'Orders', 7, 'public', true, [
        ['Orders', 14, 'public', false],
        ['Orders', 17, 'internal', false],
        ['place', 21, 'public', true],
        ['place', 25, 'public', true],
        ['first', 29, 'protected', false],
        ['audit', 33, 'private', false],
        ['count', 40, 'internal', false],
      ]],
      ['type', 'Pricing', 50, 'internal', false, [
        ['price', 51, 'public', false],
        ['discounted', 53, 'public', false],
        ['base', 57, 'private', false],
        ['none', 61, 'public', false],
      ]],
      ['type', 'Status', 66, 'internal', false, [['Status', 73, 'private', false], ['open', 76, 'public', false]]],
      ['type', 'Audited', 81, 'internal', false, [['value', 82, 'public', false]]],
      ['type', 'Base', 85, 'internal', false, [['apply', 86, 'internal', false]]],
    ])
    // Without a modifier the compact constructor, commented before its body, takes the record's access; the other one keeps package access.
    // The last constructor's name follows an annotation written after its type parameters.
    expect(outline('Receipt.java')).toEqual([
      ['type', 'Receipt', 3, 'public', true, [
        ['Receipt', 4, 'public', false],
        ['Receipt', 7, 'internal', false],
        ['label', 11, 'public', false],
        ['Receipt', 17, 'public', false],
      ]],
    ])
    // A compact source file's class has no name in the source, so it stays at its start even where the file name appears.
    expect(outline('Greeting.java')).toEqual([['type', 'Greeting', 1, 'internal', false, [['main', 1, 'internal', false]]]])
  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 60000)
