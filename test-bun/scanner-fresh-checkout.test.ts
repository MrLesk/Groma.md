import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ScanObservation } from '@groma/scanner'

const packages = process.env.GROMA_TEST_PACKAGES
const packageTest = packages ? test.concurrent : test.skip
const examples = {
  typescript: 'operation-wiring', python: 'python-project', java: 'java-maven', go: 'go-module',
  javascript: 'javascript-source',
  rust: 'rust-semantic', csharp: 'csharp-operations', angular: 'angular-output', react: 'react-callback', vue: 'vue-output', php: 'php-source',
  swift: 'swift-source',
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

/** Exercise the published split: install two tarballs, with the runtime outside the adapter. */
async function installCSharpPackage(staged: string, temporary: string): Promise<string> {
  const value = JSON.parse(await readFile(path.join(staged, 'package.json'), 'utf8'))
  const dependencies: Record<string, string> = {}
  const packages = [staged, ...Object.keys(value.optionalDependencies).map(name => path.join(staged, 'node_modules', name))]
  for (const directory of packages) {
    const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
    const tarball = path.join(temporary, `${path.basename(directory)}.tgz`)
    const pack = Bun.spawn([process.execPath, 'pm', 'pack', '--ignore-scripts', '--filename', tarball], {
      cwd: directory, stdout: 'ignore', stderr: 'pipe',
    })
    expect(await pack.exited, await new Response(pack.stderr).text()).toBe(0)
    // The rejected combined archive was 214.6 MB; each host package must fit comfortably below it.
    expect((await stat(tarball)).size).toBeLessThan(100 * 1024 * 1024)
    dependencies[manifest.name] = `file:${tarball}`
  }
  const installed = path.join(temporary, 'installed')
  await mkdir(installed)
  await writeFile(path.join(installed, 'package.json'), JSON.stringify({ private: true, dependencies }))
  const install = Bun.spawn([process.execPath, 'install', '--ignore-scripts'], {
    cwd: installed, stdout: 'ignore', stderr: 'pipe',
  })
  expect(await install.exited, await new Response(install.stderr).text()).toBe(0)
  return path.join(installed, 'node_modules', value.name)
}

for (const [id, fixture] of Object.entries(examples)) {
  packageTest(`${id} package scans a fresh checkout with no project dependencies or language tools`, async () => {
    const temporary = await mkdtemp(path.join(os.tmpdir(), `groma-packaged-${id}-`))
    try {
      const root = path.join(temporary, 'project')
      const staged = path.join(path.resolve(packages!), id)
      const artifact = id === 'csharp' ? await installCSharpPackage(staged, temporary) : path.join(temporary, 'scanner')
      await cp(path.resolve(import.meta.dir, '../test/fixtures', fixture), root, { recursive: true })
      await prepareFiles(root)
      if (id !== 'csharp') await cp(staged, artifact, { recursive: true })
      const git = Bun.which('git')!
      const init = Bun.spawn([git, 'init', '--quiet', root], { stderr: 'pipe' })
      expect(await init.exited, await new Response(init.stderr).text()).toBe(0)
      const before = await snapshot(root)
      const home = path.join(temporary, 'home')
      const bin = path.join(temporary, 'bin')
      await mkdir(home)
      await mkdir(bin)
      // Windows Git locates its DLLs relative to its executable; relocating it breaks startup.
      if (process.platform !== 'win32') await symlink(git, path.join(bin, 'git'))
      const executablePath = process.platform === 'win32' ? path.dirname(git) : bin
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
        env: { PATH: executablePath, HOME: home, USERPROFILE: home, SystemRoot: process.env.SystemRoot ?? '',
          TMPDIR: temporary, TEMP: temporary, TMP: temporary, DOTNET_SYSTEM_GLOBALIZATION_INVARIANT: '1' } })
      const [output, error, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      expect(code, error).toBe(0)
      const observation: ScanObservation = JSON.parse(output)
      expect(observation.files.length).toBeGreaterThan(0)
      expect(observation.operations!.length).toBeGreaterThan(0)
      expect(observation.invocations!.length).toBeGreaterThan(0)
      if (!['python', 'php', 'swift', 'javascript'].includes(id)) expect(observation.invocations!.some(call => !call.unresolved && call.targets.length > 0)).toBe(true)
      expect(new Set(observation.files.map(file => file.file)).size).toBe(observation.files.length)
      expect(await snapshot(root)).toEqual(before)
    } finally { await rm(temporary, { recursive: true, force: true }) }
  }, 60000)
}
