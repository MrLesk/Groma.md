import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

test.concurrent('scanner assembly keeps Swift workers and runtime libraries from every release host', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-scanner-release-'))
  const input = path.join(temporary, 'hosts'), output = path.join(temporary, 'packages')
  const hosts = ['darwin-arm64', 'linux-arm64', 'linux-x64', 'win32-arm64', 'win32-x64']
  const workers = { go: 'worker', rust: 'groma-rust-scanner', typescript: 'tsc',
    java: 'runtime/bin/java', swift: 'worker' }
  try {
    for (const host of hosts) {
      for (const [id, name] of Object.entries(workers)) {
        const directory = path.join(input, host, id)
        const worker = path.join(directory, id === 'rust' ? 'dist/bin' : 'dist', host,
          name + (host.startsWith('win32-') ? '.exe' : ''))
        await mkdir(path.dirname(worker), { recursive: true })
        await writeFile(worker, host, { mode: 0o600 })
        await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: `@groma/scanner-${id}`,
          os: [host.split('-')[0]], cpu: [host.split('-')[1]] }))
      }
      const name = `@groma/scanner-csharp-${host}`
      const runtime = path.join(input, host, 'csharp/node_modules', name)
      const [system, arch] = host.split('-')
      await mkdir(path.join(runtime, 'worker'), { recursive: true })
      await writeFile(path.join(runtime, 'package.json'), JSON.stringify({ name, version: '0.1.3', os: [system], cpu: [arch] }))
      await writeFile(path.join(runtime, 'worker', `Groma.CSharpScanner${system === 'win32' ? '.exe' : ''}`), host)
      await writeFile(path.join(input, host, 'csharp/package.json'), JSON.stringify({
        name: '@groma/scanner-csharp', version: '0.1.3', optionalDependencies: { [name]: '0.1.3' },
      }))
      await writeFile(path.join(input, host, 'swift/dist', host, 'runtime-library'), `runtime for ${host}`)
    }
    const child = Bun.spawn([process.execPath, path.resolve(import.meta.dir, '../scripts/scanner-release.ts'),
      'assemble', input, output], { stdout: 'pipe', stderr: 'pipe' })
    const error = await new Response(child.stderr).text()
    expect(await child.exited, error).toBe(0)
    const manifest = JSON.parse(await readFile(path.join(output, 'swift/package.json'), 'utf8'))
    expect(manifest.os.sort()).toEqual(['darwin', 'linux', 'win32'])
    expect(manifest.cpu.sort()).toEqual(['arm64', 'x64'])
    for (const host of hosts) {
      const directory = path.join(output, 'swift/dist', host)
      const worker = path.join(directory, host.startsWith('win32-') ? 'worker.exe' : 'worker')
      expect(await readFile(worker, 'utf8')).toBe(host)
      expect(await readFile(path.join(directory, 'runtime-library'), 'utf8')).toBe(`runtime for ${host}`)
      if (process.platform !== 'win32') expect((await stat(worker)).mode & 0o111).toBe(0o111)
    }
  } finally { await rm(temporary, { recursive: true, force: true }) }
})
