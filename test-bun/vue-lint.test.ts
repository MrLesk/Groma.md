import { expect, test } from 'bun:test'
import type { ScanOperation } from '@groma/scanner'
import { cp, mkdtemp, readFile, rename, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildPackage } from '../plugins/scanners/vue/build.ts'
import { VueEvidence } from '../plugins/scanners/vue/src/evidence.ts'
import { scanVue } from '../plugins/scanners/vue/src/index.ts'
import { addComparedOperations } from '../plugins/scanners/vue/src/operations.ts'
import { vueProject } from '../plugins/scanners/vue/src/project.ts'
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
    const compared = (operations: ScanOperation[], file: string) => operations
      .filter(operation => operation.file === file && operation.tokens)
      .sort((left, right) => left.startLine! - right.startLine!)

    // The fixture repeats a function and a constructor in a script and in a module. The bodies use an `as`
    // assertion, postfix `++`, parentheses, `typeof`, `else` and an index.
    const component = compared(vue.operations!, 'Totals.vue')
    expect(component.map(operation => operation.tokens)).toEqual(compared(typescript.operations!, 'totals.ts').map(operation => operation.tokens))
    expect(component.map(operation => operation.name)).toEqual(['total', 'constructor'])
    expect(component[0]!.startLine).toBe(4)
    expect(component[0]!.endLine).toBe(16)
  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 120000)

test.concurrent('a template binding keeps the compared body of the function it names, whichever is recorded first', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-vue-order-'))
  const root = path.join(temporary, 'project')
  try {
    await cp(path.resolve(import.meta.dir, '../test/fixtures/vue-output'), root, { recursive: true })
    await rename(path.join(root, 'receiver.ts.fixture'), path.join(root, 'receiver.ts'))
    await rename(path.join(root, 'logic.ts.fixture'), path.join(root, 'logic.ts'))
    const git = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
    expect(await git.exited, await new Response(git.stderr).text()).toBe(0)
    const { project } = vueProject(root)!
    const evidence = new VueEvidence(project)
    // The compared bodies are recorded before the template bindings name the same functions.
    addComparedOperations(project, evidence.operations)
    for (const source of project.files) {
      const sfc = project.sfc(source.fileName)
      if (sfc) evidence.inspect(source.fileName, sfc)
    }
    const host = await readFile(path.join(root, 'Host.vue'), 'utf8')
    const handler = `Host.vue#${host.indexOf('(value: string) =>')}`
    expect(evidence.invocations.some(invocation => invocation.targets.includes(handler))).toBe(true)
    expect(evidence.operations.get(handler)?.tokens).toBeDefined()
  } finally { await rm(temporary, { recursive: true, force: true }) }
})
