import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { findCSharpInput, isCSharpScanFile, readCSharpConfig } from '../plugins/scanners/csharp/src/config.ts'
import { scanCSharpSource } from '../plugins/scanners/csharp/src/adapter.ts'
import { sdkArchive, sdkRid, sdkVersion, verifyArchiveDigest } from '../plugins/scanners/csharp/src/sdk.ts'
import { setupCSharp } from '../plugins/scanners/csharp/src/setup.ts'
import { run } from '../plugins/scanners/csharp/src/process.ts'
import { addScanner, scannerInventory } from '../src/scanner/modules/inventory.ts'
import { setupScanner } from '../src/scanner/registry.ts'

async function tree(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma csharp '))
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), content)
  }
  return root
}

async function withTree(files: Record<string, string>, action: (root: string) => Promise<void>): Promise<void> {
  const root = await tree(files)
  try { await action(root) } finally { await rm(root, { recursive: true, force: true }) }
}

test.concurrent('ambiguous inputs require explicit selection and nested selection retains the repository root', async () => {
  await withTree({ 'One.sln': '', 'Two.slnx': '', 'src/App.csproj': '' }, async root => {
    await expect(findCSharpInput(root)).rejects.toThrow('Several C# scan inputs')
    expect(await findCSharpInput(root, 'src/App.csproj')).toBe(path.join(root, 'src/App.csproj'))
    await expect(findCSharpInput(root, '../Outside.csproj')).rejects.toThrow('inside the repository')
  })
})

test.concurrent('one root solution takes precedence over projects without arbitrarily choosing between projects', async () => {
  await withTree({ 'Example.slnx': '', 'One.csproj': '', 'Two.csproj': '' }, async root => {
    expect(await findCSharpInput(root)).toBe(path.join(root, 'Example.slnx'))
    await rm(path.join(root, 'Example.slnx'))
    await expect(findCSharpInput(root)).rejects.toThrow('Several C# scan inputs')
  })
})

test.concurrent('config validates scope and deterministic resource budgets', async () => {
  await withTree({}, async root => {
    expect((await readCSharpConfig(root)).maxProjects).toBe(128)
    for (const config of [{ maxProjects: 0 }, { maxFiles: 1.5 }, { timeoutSeconds: -1 }, { input: '' }, { unknown: true }]) {
      await writeFile(path.join(root, 'groma.csharp.json'), JSON.stringify(config))
      await expect(readCSharpConfig(root)).rejects.toThrow()
    }
    await writeFile(path.join(root, 'groma.csharp.json'), JSON.stringify({ input: 'src/App.csproj', configuration: 'Release', maxFiles: 50 }))
    expect(await readCSharpConfig(root)).toMatchObject({ input: 'src/App.csproj', configuration: 'Release', maxFiles: 50 })
  })
})

test.concurrent('project configuration edits invalidate C# scans but generated output does not', () => {
  for (const file of ['Directory.Build.props', 'nested/Shared.targets', 'Directory.Packages.props', 'NuGet.Config', 'global.json', 'groma.csharp.json', 'packages.lock.json', 'Example.slnx', 'a.cs']) expect(isCSharpScanFile(file)).toBeTrue()
  for (const file of ['bin/a.cs', 'src/OBJ/generated.cs', 'readme.md']) expect(isCSharpScanFile(file)).toBeFalse()
})

test.concurrent('no selected input or missing worker cannot return a successful empty observation', async () => {
  await withTree({}, async root => {
    await expect(scanCSharpSource(root, 'unused', path.join(root, 'missing.dll'))).rejects.toThrow('No C# input')
    await writeFile(path.join(root, 'App.csproj'), '')
    await expect(scanCSharpSource(root, 'unused', path.join(root, 'missing.dll'))).rejects.toThrow('not prepared')
  })
})

test.concurrent('worker nonzero exit and invalid or incomplete JSON reject before core receives evidence', async () => {
  await withTree({ 'App.csproj': '', 'worker.dll': '', 'host.mjs': 'console.log("{broken")' }, async root => {
    const host = path.join(root, 'host.mjs')
    await expect(scanCSharpSource(root, host, path.join(root, 'worker.dll'))).rejects.toThrow()
    await writeFile(host, 'console.error("missing SDK"); process.exit(7)')
    await expect(scanCSharpSource(root, host, path.join(root, 'worker.dll'))).rejects.toThrow('missing SDK')
  })
})

test.concurrent('worker output limits and deadlines fail rather than accept truncated responses', async () => {
  await withTree({ 'output.mjs': 'console.log("x".repeat(1000))', 'wait.mjs': 'setInterval(() => {}, 1000)' }, async root => {
    await expect(run(path.join(root, 'output.mjs'), [], { cwd: root, maxOutputBytes: 100 })).rejects.toThrow('output limit')
    await expect(run(path.join(root, 'wait.mjs'), [], { cwd: root, timeoutSeconds: 1 })).rejects.toThrow('exceeded 1 seconds')
  })
})

test.concurrent('SDK archive selection is exact and checksum mismatches fail before extraction', () => {
  const archive = { rid: 'linux-x64', name: 'dotnet-sdk.tar.gz', url: 'https://builds.dotnet.microsoft.com/dotnet/Sdk/example.tar.gz', hash: 'a'.repeat(128) }
  const metadata = { releases: [{ sdk: { version: sdkVersion, files: [archive] } }] }
  expect(sdkArchive(metadata, 'linux-x64')).toEqual(archive)
  expect(() => sdkArchive(metadata, 'win-x64')).toThrow('No verified')
  expect(() => sdkArchive({ releases: [{ sdk: { version: '1.0.0', files: [archive] } }] }, 'linux-x64')).toThrow()
  expect(() => sdkArchive({ releases: [{ sdk: { version: sdkVersion, files: [{ ...archive, url: 'https://example.com/tool.zip' }] } }] }, 'linux-x64')).toThrow('origin')
  expect(() => verifyArchiveDigest('b'.repeat(128), archive.hash)).toThrow('SHA-512 mismatch')
  expect(sdkRid('darwin', 'arm64')).toBe('osx-arm64')
})

test.concurrent('restore requires explicit trust and unknown setup flags never trigger installation', async () => {
  await withTree({}, async root => {
    await expect(setupCSharp(root, ['--restore'])).rejects.toThrow('--trust-project')
    await expect(setupCSharp(root, ['--surprise'])).rejects.toThrow('setup options')
  })
})

test.concurrent('dependency setup loads only the requested configured scanner and list does not execute it', async () => {
  const manifest = (id: string) => JSON.stringify({ name: id, version: '1.0.0', type: 'module', groma: { scanner: { id, entry: './index.js' } } })
  await withTree({
    'groma/index.md': '---\nokf_version: "0.2"\n---\n',
    'chosen/package.json': manifest('chosen'),
    'chosen/index.js': `export default { id: 'chosen', matchesFile() { return false }, async scan() { throw Error('scan must not run') }, async setup(root, args) { await Bun.write(root + '/setup-result', JSON.stringify(args)) } }`,
    'other/package.json': manifest('other'),
    'other/index.js': `throw Error('unrequested scanner loaded')`,
  }, async root => {
    await addScanner(root, './chosen'); await addScanner(root, './other')
    expect((await scannerInventory(root)).length).toBe(3)
    await setupScanner(root, 'chosen', ['--example'])
    expect(JSON.parse(await readFile(path.join(root, 'setup-result'), 'utf8'))).toEqual(['--example'])
    await expect(setupScanner(root, 'absent', [])).rejects.toThrow('not configured')
  })
})
