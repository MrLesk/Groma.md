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
const privateInstall = process.env.GROMA_CSHARP_TEST_INSTALL === '1'
const env = privateInstall ? { ...process.env, DOTNET_HOST_PATH: undefined, DOTNET_ROOT: undefined, GROMA_CSHARP_CACHE: path.join(workspace, 'private SDK') } : process.env

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
  const invoke = (args: string[]) => run(binary, args, { cwd: root, env, timeoutSeconds: 300 })
  await invoke(['init', '--directory', 'groma', 'CSharp evidence fixture'])
  await invoke(['scanner', 'add', plugin])
  const setup = ['scanner', 'setup', 'csharp', '--']
  if (privateInstall) setup.push('--install-sdk')
  console.log((await invoke(setup)).stdout.trim())
  const before = performance.now()
  await invoke(['scan'])
  const scanSeconds = (performance.now() - before) / 1000
  const first = await markdownHash(path.join(root, 'groma'))
  await invoke(['scan'])
  assert.equal(await markdownHash(path.join(root, 'groma')), first, 'repeated scan changed architecture')
  await writeFile(path.join(root, 'App/Broken.cs'), 'public class Broken { MissingType field = new(); }')
  await assert.rejects(invoke(['scan']), /Compilation failed/)
  assert.equal(await markdownHash(path.join(root, 'groma')), first, 'failed scan altered the complete map')
  await rm(path.join(root, 'App/Broken.cs'))
  const adapter = await import(pathToFileURL(path.join(plugin, 'dist/index.js')).href)
  // Import the relocated package in a separate process when private SDK environment differs.
  const script = path.join(workspace, 'evidence.mjs')
  await writeFile(script, `import scanner from ${JSON.stringify(pathToFileURL(path.join(plugin, 'dist/index.js')).href)}; console.log(JSON.stringify(await scanner.scan(${JSON.stringify(root)})))`)
  const result = await run(script, [], { cwd: root, env: { ...env, BUN_BE_BUN: '1' }, timeoutSeconds: 120 })
  const observation = parseScanObservation(result.stdout)
  assert.ok(adapter.default && observation.operations?.length)
  assert.ok(observation.files.some(file => file.file === 'Core/Providers.cs'))
  const report = { platform: process.platform, arch: process.arch, privateInstall, scanSeconds, files: observation.files.length, scopes: observation.scopes.length, operations: observation.operations?.length, invocations: observation.invocations?.length, repeatedMapEqual: true, failedScanPreservedMap: true }
  await mkdir('dist', { recursive: true })
  await writeFile('dist/csharp-package-validation.json', `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report))
} finally { await rm(workspace, { recursive: true, force: true }) }
