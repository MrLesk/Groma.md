import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ScanObservation } from '@groma/scanner'

const packages = process.env.GROMA_TEST_PACKAGES
const packageTest = packages ? test.concurrent : test.skip
const examples = {
  typescript: 'operation-wiring', python: 'python-project', java: 'java-maven', go: 'go-module',
  rust: 'rust-semantic', csharp: 'csharp-operations', angular: 'angular-output', react: 'react-callback', vue: 'vue-output',
}

async function prepareFiles(root: string): Promise<void> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name)
    if (entry.isDirectory()) await prepareFiles(file)
    else if (entry.name.endsWith('.fixture')) await rename(file, file.slice(0, -'.fixture'.length))
  }
}

async function snapshot(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === '.git') continue
    const file = path.join(root, entry.name)
    if (entry.isDirectory()) {
      for (const [nested, contents] of Object.entries(await snapshot(file))) result[`${entry.name}/${nested}`] = contents
    } else result[entry.name] = (await readFile(file)).toString('base64')
  }
  return result
}

for (const [id, fixture] of Object.entries(examples)) {
  packageTest(`${id} package scans a fresh checkout with no project dependencies or language tools`, async () => {
    const temporary = await mkdtemp(path.join(os.tmpdir(), `groma-packaged-${id}-`))
    try {
      const root = path.join(temporary, 'project')
      const artifact = path.join(temporary, 'scanner')
      await cp(path.resolve(import.meta.dir, '../test/fixtures', fixture), root, { recursive: true })
      await prepareFiles(root)
      await cp(path.join(path.resolve(packages!), id), artifact, { recursive: true })
      const git = Bun.which('git')!
      const init = Bun.spawn([git, 'init', '--quiet', root], { stderr: 'pipe' })
      expect(await init.exited, await new Response(init.stderr).text()).toBe(0)
      const before = await snapshot(root)
      const home = path.join(temporary, 'home')
      const bin = path.join(temporary, 'bin')
      await mkdir(home)
      await mkdir(bin)
      await symlink(git, path.join(bin, process.platform === 'win32' ? 'git.exe' : 'git'))
      const manifest = JSON.parse(await readFile(path.join(artifact, 'package.json'), 'utf8'))
      const runner = path.join(temporary, 'scan.mjs')
      await writeFile(runner, `
        globalThis.fetch = () => { throw new Error('Scanning must not use the network') };
        const scanner = (await import(${JSON.stringify(path.join(artifact, manifest.groma.scanner.entry))})).default;
        await scanner.checkReadiness?.(${JSON.stringify(root)}, {});
        const first = await scanner.scan(${JSON.stringify(root)}, {});
        const second = await scanner.scan(${JSON.stringify(root)}, {});
        if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('Scan evidence changed on repetition');
        console.log(JSON.stringify(first));
      `)
      const child = Bun.spawn([process.execPath, runner], { cwd: temporary, stdout: 'pipe', stderr: 'pipe',
        env: { PATH: bin, HOME: home, USERPROFILE: home, SystemRoot: process.env.SystemRoot ?? '',
          TMPDIR: temporary, TEMP: temporary, TMP: temporary, DOTNET_SYSTEM_GLOBALIZATION_INVARIANT: '1' } })
      const [output, error, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      expect(code, error).toBe(0)
      const observation: ScanObservation = JSON.parse(output)
      expect(observation.files.length).toBeGreaterThan(0)
      expect(observation.operations!.length).toBeGreaterThan(0)
      expect(observation.invocations!.length).toBeGreaterThan(0)
      if (id !== 'python') expect(observation.invocations!.some(call => !call.unresolved && call.targets.length > 0)).toBe(true)
      expect(new Set(observation.files.map(file => file.file)).size).toBe(observation.files.length)
      expect(await snapshot(root)).toEqual(before)
    } finally { await rm(temporary, { recursive: true, force: true }) }
  }, 60000)
}
