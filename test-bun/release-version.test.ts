import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'bun:test'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))

async function run(command: string[], cwd: string): Promise<string> {
  const child = Bun.spawn(command, { cwd, stdout: 'pipe', stderr: 'pipe' })
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  assert.equal(code, 0, `${command.join(' ')}\n${stdout}\n${stderr}`)
  return stdout.trim()
}

test.concurrent('a release binary keeps the prepared manifest version without its build checkout', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-release-version-'))
  try {
    const checkout = path.join(root, 'checkout')
    const isolated = path.join(root, 'isolated')
    await mkdir(checkout)
    await mkdir(isolated)
    for (const file of ['package.json', 'src', 'scripts/build.ts', 'docs']) {
      await cp(path.join(repositoryRoot, file), path.join(checkout, file), { recursive: true })
    }
    await symlink(path.join(repositoryRoot, 'node_modules'), path.join(checkout, 'node_modules'), 'junction')
    const manifest = JSON.parse(await readFile(path.join(checkout, 'package.json'), 'utf8'))
    assert.equal(await run([process.execPath, 'src/cli.ts', '--version'], checkout), manifest.version)

    const releaseVersion = `${Number(manifest.version.split('.')[0]) + 1}.0.0`
    manifest.version = releaseVersion
    await writeFile(path.join(checkout, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    assert.equal(await run([process.execPath, 'src/cli.ts', '--version'], checkout), releaseVersion)
    const binary = path.join(root, process.platform === 'win32' ? 'groma.exe' : 'groma')
    await run([process.execPath, 'run', 'build', binary], checkout)
    await rm(checkout, { recursive: true, force: true })

    assert.equal(await run([binary, '--version'], isolated), releaseVersion)
    await cp(path.join(repositoryRoot, 'test/fixtures/validate/groma'), path.join(isolated, 'groma'), { recursive: true })
    const welcome = await run([binary, '--plain'], isolated)
    assert.ok(welcome.includes(`v${releaseVersion}`), welcome)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}, 20000)
