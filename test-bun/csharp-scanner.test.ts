import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { findCSharpInput, isCSharpScanFile, readCSharpConfig } from '../plugins/scanners/csharp/src/config.ts'
import { checkCSharpReadiness, scanCSharpSource } from '../plugins/scanners/csharp/src/adapter.ts'
import { run } from '../plugins/scanners/csharp/src/process.ts'

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
  const hostSource = (worker: string) => `
    if (process.argv[2] === '--version') console.log('10.0.400');
    else if (process.argv[2] === '--list-runtimes') console.log('Microsoft.NETCore.App 10.0.11 [/sdk]');
    else { ${worker} }
  `
  await withTree({ 'App.csproj': '', 'worker.dll': '', 'host.mjs': hostSource('console.log("{broken")') }, async root => {
    const host = path.join(root, 'host.mjs')
    await expect(scanCSharpSource(root, host, path.join(root, 'worker.dll'))).rejects.toThrow('JSON')
    await writeFile(host, hostSource('console.log(JSON.stringify({ complete: false }))'))
    await expect(scanCSharpSource(root, host, path.join(root, 'worker.dll'))).rejects.toThrow()
    await writeFile(host, hostSource('console.error("worker failed"); process.exit(7)'))
    await expect(scanCSharpSource(root, host, path.join(root, 'worker.dll'))).rejects.toThrow('worker failed')
  })
})

test.concurrent('worker output limits and deadlines fail rather than accept truncated responses', async () => {
  await withTree({ 'output.mjs': 'console.log("x".repeat(1000))', 'wait.mjs': 'setInterval(() => {}, 1000)' }, async root => {
    await expect(run(path.join(root, 'output.mjs'), [], { cwd: root, maxOutputBytes: 100 })).rejects.toThrow('output limit')
    await expect(run(path.join(root, 'wait.mjs'), [], { cwd: root, timeoutSeconds: 1 })).rejects.toThrow('exceeded 1 seconds')
  })
})


test.concurrent('readiness checks the selected SDK and worker runtime without scanning or restoring', async () => {
  const hostSource = (runtime: string) => `
    if (process.argv[2] === '--version') console.log('9.0.317');
    else if (process.argv[2] === '--list-runtimes') console.log(${JSON.stringify(runtime)});
    else throw Error('readiness must not scan or restore');
  `
  await withTree({ 'App.csproj': '', 'worker.dll': '', 'host.mjs': hostSource('Microsoft.NETCore.App 9.0.1 [/sdk]') }, async root => {
    const host = path.join(root, 'host.mjs')
    const worker = path.join(root, 'worker.dll')
    await expect(checkCSharpReadiness(root, host, worker)).rejects.toThrow('.NET 10 runtime')
    await expect(scanCSharpSource(root, host, worker)).rejects.toThrow('.NET 10 runtime')
    await writeFile(host, hostSource('Microsoft.NETCore.App 10.0.1 [/sdk]'))
    expect(await checkCSharpReadiness(root, host, worker)).toEqual({ input: path.join(root, 'App.csproj'), sdkVersion: '9.0.317' })
  })
})
