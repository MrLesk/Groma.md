import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { assembleCSharpPackages } from '../scripts/package-csharp-scanner.ts'

test.concurrent('C# assembly preserves separate host runtimes and links the small adapter to each exact package', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-csharp-packaging-'))
  try {
    const hosts: string[] = []
    for (const platform of ['linux-arm64', 'win32-x64']) {
      const host = path.join(root, platform)
      const name = `@groma/scanner-csharp-${platform}`
      const runtime = path.join(host, 'csharp', 'node_modules', name)
      const [system, arch] = platform.split('-')
      await mkdir(path.join(runtime, 'worker'), { recursive: true })
      await writeFile(path.join(runtime, 'package.json'), JSON.stringify({ name, version: '0.1.3', os: [system], cpu: [arch] }))
      const executable = system === 'win32' ? 'Groma.CSharpScanner.exe' : 'Groma.CSharpScanner'
      await writeFile(path.join(runtime, 'worker', executable), platform, { mode: 0o644 })
      await writeFile(path.join(host, 'csharp', 'package.json'), JSON.stringify({
        name: '@groma/scanner-csharp', version: '0.1.3', os: [system], cpu: [arch], optionalDependencies: { [name]: '0.1.3' },
      }))
      hosts.push(host)
    }
    const output = path.join(root, 'output')
    await cp(path.join(hosts[0]!, 'csharp'), path.join(output, 'csharp'), { recursive: true })
    await assembleCSharpPackages(hosts, output)
    const wrapper = JSON.parse(await readFile(path.join(output, 'csharp', 'package.json'), 'utf8'))
    expect(Object.keys(wrapper.optionalDependencies)).toHaveLength(2)
    expect(wrapper.os.sort()).toEqual(['linux', 'win32'])
    expect(wrapper.cpu.sort()).toEqual(['arm64', 'x64'])
    expect(await stat(path.join(output, 'csharp', 'node_modules')).catch(() => null)).toBeNull()
    const binaries: string[] = []
    for (const [name, version] of Object.entries(wrapper.optionalDependencies)) {
      const platform = name.slice('@groma/scanner-csharp-'.length)
      const runtime = path.join(output, 'csharp-runtimes', platform)
      const packaged = JSON.parse(await readFile(path.join(runtime, 'package.json'), 'utf8'))
      expect([packaged.name, packaged.version]).toEqual([name, version])
      const executable = path.join(runtime, 'worker', `Groma.CSharpScanner${platform.startsWith('win32') ? '.exe' : ''}`)
      binaries.push(await readFile(executable, 'utf8'))
      if (process.platform !== 'win32') expect((await stat(executable)).mode & 0o111).not.toBe(0)
    }
    expect(new Set(binaries).size).toBe(2)
  } finally { await rm(root, { recursive: true, force: true }) }
})
