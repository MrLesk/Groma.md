import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { addScanner } from '../src/scanner/modules/inventory.ts'
import { writeScannerConfig } from '../src/scanner/modules/config.ts'

const cli = path.resolve(import.meta.dir, '../src/cli.ts')
const fixtures = path.resolve(import.meta.dir, '../test/fixtures')

async function command(root: string, ...args: string[]) {
  const child = Bun.spawn([process.execPath, cli, ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  const [code, out, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  return { code, out, error }
}

async function snapshot(root: string) {
  const files = await readdir(root, { recursive: true, withFileTypes: true })
  const names = files.filter(file => file.isFile()).map(file => path.join(file.parentPath, file.name)).sort()
  return Promise.all(names.map(async filename => {
    return [path.relative(root, filename), await readFile(filename, 'utf8')]
  }))
}

test.concurrent('lint checks fresh scanner evidence and reports failures without changing saved architecture', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-lint-'))
  try {
    await cp(path.join(fixtures, 'empty-project'), root, { recursive: true })
    await mkdir(path.join(root, 'src'))
    for (const file of ['ready-a.ts', 'ready-b.ts', 'ready-c.ts']) {
      await cp(path.join(fixtures, 'duplicated-logic', file), path.join(root, 'src', file))
    }
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'lint-fixture', bin: 'src/ready-a.ts' }))
    const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
    expect(await git.exited).toBe(0)
    await addScanner(root, path.resolve(import.meta.dir, '../plugins/scanners/typescript'))
    const before = await snapshot(path.join(root, 'groma'))
    const duplicates = await command(root, 'lint')
    expect(duplicates.code, duplicates.error).toBe(1)
    // Small identical copies are reported; a small near-duplicate is not.
    for (const file of ['ready-a', 'ready-b']) expect(duplicates.out).toMatch(new RegExp(`src/${file}\\.ts:\\d+`))
    expect(duplicates.out).not.toContain('src/ready-c.ts')
    expect(await snapshot(path.join(root, 'groma'))).toEqual(before)

    await rm(path.join(root, 'src/ready-b.ts'))
    await rm(path.join(root, 'src/ready-c.ts'))
    expect((await command(root, 'lint')).code).toBe(0)
    expect(await snapshot(path.join(root, 'groma'))).toEqual(before)

    const plugin = path.join(root, 'broken')
    await mkdir(plugin)
    await writeFile(path.join(plugin, 'package.json'), JSON.stringify({ name: 'broken', version: '1.0.0', groma: { scanner: { id: 'broken', entry: './index.js' } } }))
    await writeFile(path.join(plugin, 'index.js'), `export default { id: 'broken', watch: { include: [], exclude: [] }, scan() { throw new Error('lint-fixture-failure') } }`)
    await addScanner(root, plugin)
    const withFailure = await snapshot(path.join(root, 'groma'))
    const failed = await command(root, 'lint')
    expect(failed.code).toBe(1)
    expect(failed.error).toContain('lint-fixture-failure')
    expect(await snapshot(path.join(root, 'groma'))).toEqual(withFailure)

    await writeScannerConfig(root, { scanners: [] })
    const empty = await snapshot(path.join(root, 'groma'))
    expect((await command(root, 'lint')).code).toBe(0)
    expect((await command(root, 'duplicates')).code).toBe(1)
    expect(await snapshot(path.join(root, 'groma'))).toEqual(empty)
  } finally { await rm(root, { recursive: true, force: true }) }
})
