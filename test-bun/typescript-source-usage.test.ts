import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import manifest from '../plugins/scanners/typescript/package.json'
import { buildImportGraph } from '../plugins/scanners/typescript/src/graph.ts'
import { scannerFiles } from '../src/scanner/modules/selection.ts'

const cases = [
  ['unused', "import { Value } from './target.ts'; export const answer = 1", false],
  ['value', "import { Value } from './target.ts'; export const answer = new Value()", true],
  ['js-specifier', "import { Value } from './target.js'; export const answer = new Value()", true],
  ['import-type', "export type Result = import('./target.ts').Value", true],
  ['type', "import type { Value } from './target.ts'; export type Result = Value", true],
  ['parameter', "import { Value } from './target.ts'; export function run(Value: number) { return Value }", false],
  ['generic', "import { Value } from './target.ts'; export function run<Value>() { return null as Value }", false],
  ['property', "import { Value } from './target.ts'; export const answer = { Value: 1 }", false],
  ['shorthand', "import { Value } from './target.ts'; export const answer = { Value }", true],
  ['export', "import { Value } from './target.ts'; export { Value as Renamed }", true],
  ['reexport', "export { Value } from './target.ts'", true],
  ['namespace', "import * as target from './target.ts'; export const answer = new target.Value()", true],
  ['initialize', "import './target.ts'", true],
  ['empty', "import {} from './target.ts'", true],
  ['empty-type', "import type {} from './target.ts'", false],
  ['dynamic', "export const load = () => import('./target.ts')", true],
  ['comment', "// import { Value } from './target.ts'\nexport const answer = 1", false],
  // Augmenting a package the checkout lacks declares that module here; the file does not import itself.
  ['augmented', "import { Value } from 'absent'; declare module 'absent' { interface Extra {} }\nexport const answer = Value", false],
] as const

test.concurrent('exported abstract classes retain class symbol identity', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-ts-symbols-'))
  try {
    await writeFile(path.join(root, 'classes.ts'), [
      'export class Concrete {}',
      'export abstract class Abstract {}',
    ].join('\n'))
    const git = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stderr: 'pipe' })
    expect(await git.exited).toBe(0)
    const graph = await buildImportGraph(root, await scannerFiles(root, manifest.groma.scanner))
    expect(graph.files.find(file => file.file === 'classes.ts')?.symbols).toEqual([
      { id: 'classes.ts#Concrete', name: 'Concrete', kind: 'class' },
      { id: 'classes.ts#Abstract', name: 'Abstract', kind: 'class' },
    ])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('export symbols come from declarations rather than generated source text', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-ts-exports-'))
  try {
    await writeFile(path.join(root, 'source.ts'), [
      'const generated = `',
      'export const Imaginary = {}',
      '`',
      'export async function run() {}',
      'export default class Service {}',
      'export interface Input {}',
      'export type Output = string',
      'export enum Mode { One }',
      'export const fixed = 1',
      'export let mutable = 2',
      'export var older = 3',
      'export declare class Declared {}',
      // An export list names a declaration of the file, and a destructured export declares each name.
      'const listed = 1',
      'function named() {}',
      'type Listed = string',
      'export { listed as renamed, named }',
      'export type { Listed }',
      'export const { left, right: [inner] } = { left: 1, right: [2] }',
    ].join('\n'))
    const git = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stderr: 'pipe' })
    expect(await git.exited).toBe(0)
    const graph = await buildImportGraph(root, await scannerFiles(root, manifest.groma.scanner))
    expect(graph.files.find(file => file.file === 'source.ts')?.symbols).toEqual([
      ['run', 'function'], ['Service', 'class'], ['Input', 'interface'],
      ['Output', 'type'], ['Mode', 'enum'], ['fixed', 'const'],
      ['mutable', 'let'], ['older', 'var'], ['Declared', 'class'],
      ['listed', 'const'], ['named', 'function'], ['Listed', 'type'], ['left', 'const'], ['inner', 'const'],
    ].map(([name, kind]) => ({ id: `source.ts#${name}`, name, kind })))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('source dependencies follow bindings and explicit module execution', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-ts-usage-'))
  try {
    await writeFile(path.join(root, 'target.ts'), 'export class Value {}')
    await Promise.all(cases.map(([name, source]) => writeFile(path.join(root, `${name}.ts`), source)))
    const git = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stderr: 'pipe' })
    expect(await git.exited).toBe(0)
    const graph = await buildImportGraph(root, await scannerFiles(root, manifest.groma.scanner))
    for (const [name, , used] of cases) {
      const node = graph.files.find(file => file.file === `${name}.ts`)
      expect(node?.imports, name).toEqual(used ? ['target.ts'] : [])
    }
    expect(graph.files.find(file => file.file === 'target.ts')?.importedBy)
      .toEqual(cases.filter(([, , used]) => used).map(([name]) => `${name}.ts`).sort())
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
