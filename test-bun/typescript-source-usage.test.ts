import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { buildImportGraph } from '../plugins/scanners/typescript/src/graph.ts'

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
    const graph = await buildImportGraph(root)
    expect(graph.files.find(file => file.file === 'classes.ts')?.symbols).toEqual([
      { id: 'classes.ts#Concrete', name: 'Concrete', kind: 'class' },
      { id: 'classes.ts#Abstract', name: 'Abstract', kind: 'class' },
    ])
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
    const graph = await buildImportGraph(root)
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
