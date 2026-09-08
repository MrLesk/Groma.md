import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseScanObservation } from '@groma/scanner'
import { run } from '../plugins/scanners/csharp/src/process.ts'

const [binaryArg, packageArg] = process.argv.slice(2)
if (!binaryArg || !packageArg) throw new Error('usage: bun scripts/validate-csharp-package.ts <groma binary> <scanner package>')
const workspace = await mkdtemp(path.join(tmpdir(), 'groma relocated CSharp '))
const root = path.join(workspace, 'project')
const plugin = path.join(workspace, 'scanner package')
const binary = path.join(workspace, process.platform === 'win32' ? 'groma.exe' : 'groma')

async function markdownHash(directory: string): Promise<string> {
  const hash = createHash('sha256')
  const files = await readdir(directory, { recursive: true })
  for (const file of files.filter(file => file.endsWith('.md')).sort()) {
    hash.update(file); hash.update(await readFile(path.join(directory, file)))
  }
  return hash.digest('hex')
}

try {
  await cp(path.resolve(binaryArg), binary)
  await cp(path.resolve(packageArg), plugin, { recursive: true })
  await cp(fileURLToPath(new URL('../test/fixtures/csharp-operations', import.meta.url)), root, { recursive: true })
  await writeFile(path.join(root, 'groma.csharp.json'), JSON.stringify({ input: 'App/App.csproj' }))
  const invoke = (args: string[]) => run(binary, args, { cwd: root, timeoutSeconds: 300 })
  await invoke(['init', '--directory', 'groma', 'CSharp evidence fixture'])
  await invoke(['scanner', 'add', plugin])
  await run(process.env.DOTNET_HOST_PATH ?? 'dotnet', ['restore', 'Example.slnx', '--nologo'], { cwd: root })
  const before = performance.now()
  await invoke(['scan'])
  const scanSeconds = (performance.now() - before) / 1000
  const owner = async (file: string) => {
    const record = (await invoke(['view', file])).stdout
    const id = record.match(/\n {2}id: ([^\n]+)/)?.[1]
    assert.ok(id, `No owner for ${file}`)
    return id
  }
  const declaration = 'Core/Partial.Declaration.cs'
  const implementation = 'Core/Partial.Implementation.cs'
  const curatedOwner = await owner(declaration)
  await invoke(['edit', curatedOwner, '--combine', await owner(implementation)])
  await invoke(['edit', curatedOwner, '--overview', 'Owns the partial operation.'])
  assert.equal(await owner(implementation), curatedOwner)
  const first = await markdownHash(path.join(root, 'groma'))
  await invoke(['scan'])
  assert.equal(await markdownHash(path.join(root, 'groma')), first, 'repeated scan changed architecture')
  await writeFile(path.join(root, implementation), `${await readFile(path.join(root, implementation), 'utf8')}\npublic class AddedDeclaration { }\n`)
  await invoke(['scan'])
  assert.equal(await owner(declaration), curatedOwner, 'edit changed curated declaration ownership')
  assert.equal(await owner(implementation), curatedOwner, 'edit changed curated implementation ownership')
  const edited = await markdownHash(path.join(root, 'groma'))
  await writeFile(path.join(root, 'App/Broken.cs'), 'public class Broken { MissingType field = new(); }')
  await assert.rejects(invoke(['scan']), /Compilation failed/)
  assert.equal(await markdownHash(path.join(root, 'groma')), edited, 'failed scan altered the complete map')
  await rm(path.join(root, 'App/Broken.cs'))
  // Read evidence through the relocated package in a fresh process.
  const script = path.join(workspace, 'evidence.mjs')
  await writeFile(script, `import scanner from ${JSON.stringify(pathToFileURL(path.join(plugin, 'dist/index.js')).href)}; console.log(JSON.stringify(await scanner.scan(${JSON.stringify(root)})))`)
  const result = await run(script, [], { cwd: root, env: { ...process.env, BUN_BE_BUN: '1' }, timeoutSeconds: 120 })
  const observation = parseScanObservation(result.stdout)
  assert.ok(observation.operations?.length)
  assert.ok(observation.files.some(file => file.file === 'Core/Providers.cs'))
  const report = { platform: process.platform, arch: process.arch, scanSeconds, files: observation.files.length, scopes: observation.scopes.length, operations: observation.operations?.length, invocations: observation.invocations?.length, repeatedMapEqual: true, curatedOwnershipPreserved: true, failedScanPreservedMap: true }
  await mkdir('dist', { recursive: true })
  await writeFile('dist/csharp-package-validation.json', `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report))
} finally { await rm(workspace, { recursive: true, force: true }) }
