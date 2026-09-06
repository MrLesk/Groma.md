import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'bun:test'

const probe = fileURLToPath(new URL('../test/fixtures/parcel-watch/probe.ts', import.meta.url))

async function run(command: string[], cwd: string): Promise<void> {
  const child = Bun.spawn(command, { cwd, stdout: 'pipe', stderr: 'pipe' })
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  assert.equal(code, 0, `${command.join(' ')}\n${stdout}\n${stderr}`)
}

test.concurrent('the same Parcel import receives native events in source and standalone bytecode', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-parcel-bytecode-'))
  try {
    const isolated = path.join(root, 'isolated')
    await mkdir(isolated)
    const binary = path.join(isolated, process.platform === 'win32' ? 'watch.exe' : 'watch')
    await run([process.execPath, probe], isolated)
    await run([
      process.execPath, 'build', '--compile', '--bytecode', '--format=esm',
      '--minify', '--sourcemap', probe, '--outfile', binary,
    ], root)
    // Only the executable is placed here; no source or node_modules accompany it.
    await run([binary], isolated)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}, 20000)
