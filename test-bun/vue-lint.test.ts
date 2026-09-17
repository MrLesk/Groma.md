import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildPackage } from '../plugins/scanners/vue/build.ts'
import { scanVue } from '../plugins/scanners/vue/src/index.ts'
import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'
import { addScanner } from '../src/scanner/modules/inventory.ts'

const cli = path.resolve(import.meta.dir, '../src/cli.ts')

async function fixture() {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-vue-lint-'))
  const root = path.join(temporary, 'project')
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  await cp(path.resolve(import.meta.dir, '../test/fixtures/vue-duplicates'), root, { recursive: true })
  const git = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
  expect(await git.exited, await new Response(git.stderr).text()).toBe(0)
  return { temporary, root }
}

/** Each finding starts on an unindented line; its other copies and match note are indented below it. */
function findings(output: string): string[] {
  return output.split(/\n(?=\S)/)
}

test.concurrent('groma lint reports identical and near-duplicate Vue bodies, but not callbacks or small bodies', async () => {
  const { temporary, root } = await fixture()
  try {
    await buildPackage(path.join(temporary, 'scanner'))
    await addScanner(root, path.join(temporary, 'scanner'))
    const lint = Bun.spawn([process.execPath, cli, 'lint'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    const [code, out, error] = await Promise.all([
      lint.exited, new Response(lint.stdout).text(), new Response(lint.stderr).text(),
    ])

    expect(code, error).toBe(1)
    // Renamed locals are slots, so the script setup functions are identical copies.
    const renamed = findings(out).find(finding => finding.includes('Readiness.vue:'))
    expect(renamed).toContain('Runner.vue:')
    expect(renamed).not.toContain('not identical')
    const near = findings(out).find(finding => finding.includes('Pricing.vue:'))
    expect(near).toContain('Quote.vue:')
    expect(near).toContain('not identical')
    expect(out).not.toContain('Callbacks.vue')
    expect(out).not.toContain('Checks.vue')
    expect(out).not.toContain('Depth.vue')
    expect(out).not.toContain('Head.vue')
  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 120000)

test.concurrent('the Vue scanner and the TypeScript scanner report the same tokens for one body', async () => {
  const { temporary, root } = await fixture()
  try {
    const vue = (await scanVue(root))!
    const typescript = (await scanTypeScriptSource(root))!
    const component = vue.operations!.find(operation => operation.file === 'Totals.vue')!
    const module = typescript.operations!.find(operation => operation.file === 'totals.ts' && operation.tokens)!

    // The fixture repeats one body, including an `as` type assertion, in a script and in a module.
    expect(component.tokens).toEqual(module.tokens)
    expect(component.startLine).toBe(4)
    expect(component.endLine).toBe(10)
  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 120000)

test.concurrent('a recursive call keeps the called name and an index keeps its bounds', async () => {
  const { temporary, root } = await fixture()
  try {
    const vue = (await scanVue(root))!
    const tokens = (file: string) => vue.operations!.find(operation => operation.file === file)!.tokens

    // Two recursive bodies differ by the name they call; two indexed bodies differ by their bounds.
    expect(tokens('Depth.vue')).toContain('depth')
    expect(tokens('Depth.vue')).not.toEqual(tokens('Height.vue'))
    expect(tokens('Head.vue')).toEqual(expect.arrayContaining(['0', '2']))
    expect(tokens('Head.vue')).not.toEqual(tokens('Tail.vue'))
  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 120000)
