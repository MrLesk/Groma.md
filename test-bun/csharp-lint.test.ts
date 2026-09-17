import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { addScanner } from '../src/scanner/modules/inventory.ts'

const artifact = process.env.GROMA_TEST_CSHARP_PACKAGE
const packaged = artifact ? test.concurrent : test.skip
const cli = path.resolve(import.meta.dir, '../src/cli.ts')

/** Each finding starts on an unindented line; its other copies and match note are indented below it. */
function findings(output: string): string[] {
  return output.split(/\n(?=\S)/)
}

packaged('groma lint reports identical and near-duplicate C# bodies, but not callbacks or small near-duplicates', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-csharp-lint-'))
  try {
    await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
    await cp(path.resolve(import.meta.dir, '../test/fixtures/csharp-duplicates'), root, { recursive: true })
    const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
    expect(await git.exited).toBe(0)
    await addScanner(root, artifact!)
    const lint = Bun.spawn([process.execPath, cli, 'lint'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    const [code, out, error] = await Promise.all([lint.exited, new Response(lint.stdout).text(), new Response(lint.stderr).text()])
    expect(code, error).toBe(1)
    const renamed = findings(out).find(finding => finding.includes('Readiness.cs:'))
    expect(renamed).toContain('Runner.cs:')
    expect(renamed).not.toContain('not identical')
    const near = findings(out).find(finding => finding.includes('Pricing.cs:'))
    expect(near).toContain('Quote.cs:')
    expect(near).toContain('not identical')
    expect(out).not.toContain('Callbacks.cs')
    expect(out).not.toContain('Checks.cs')
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)
