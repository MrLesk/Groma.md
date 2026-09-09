import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { scannerArtifactRegistry } from './scanner-artifact-registry.ts'

const examples = {
  csharp: { file: 'src/FluentValidation/AbstractValidator.cs', tool: 'dotnet', version: ['--info'], broken: 'public class Broken { MissingType value; }' },
  go: { file: 'mux.go', tool: 'go', version: ['version'], broken: 'package chi\nfunc Broken() { absent() }' },
  rust: { file: 'crates/globset/src/lib.rs', tool: 'rustc', version: ['--version'], broken: 'pub fn broken(' },
}
const [idArg, binaryArg, rootArg, packageArg, outputArg] = process.argv.slice(2)
if (!idArg || !(idArg in examples) || !binaryArg || !rootArg || !packageArg || !outputArg) {
  throw new Error('Usage: bun scripts/validate-native-scanner-artifact.ts <csharp|go|rust> <compiled-groma> <disposable-prepared-example> <built-package> <evidence-output>')
}
const id = idArg as keyof typeof examples
const example = examples[id]
const execute = promisify(execFile)
const binary = path.resolve(binaryArg)
const root = path.resolve(rootArg)
const output = path.resolve(outputArg)
const source = path.join(root, example.file)
const original = await readFile(source, 'utf8')
const registry = await scannerArtifactRegistry([packageArg], path.join(output, 'artifacts'))
const transcript: { args: string[]; stdout: string; stderr: string }[] = []

async function cli(...args: string[]) {
  const result = await execute(binary, args, {
    cwd: root, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, BUN_CONFIG_REGISTRY: registry.url, BUN_INSTALL_CACHE_DIR: path.join(output, 'bun-cache') },
  })
  transcript.push({ args, stdout: result.stdout, stderr: result.stderr })
  return result.stdout
}

async function markdown() {
  const directory = path.join(root, 'groma')
  const hash = createHash('sha256')
  for (const file of (await readdir(directory, { recursive: true })).filter(file => file.endsWith('.md')).sort()) {
    hash.update(file); hash.update(await readFile(path.join(directory, file)))
  }
  return hash.digest('hex')
}

async function owner() {
  const world = await loadAnnotatedArchitecture(root)
  const owners = world.elements.filter(element => element.code.some(code => code.file === example.file))
  assert.equal(owners.length, 1, 'The selected physical source must have one owner')
  return owners[0]!
}

try {
  const discovery = JSON.parse(await cli('scanner', 'discover', '--json'))
  assert.ok(discovery.findings.some((item: { technology: string }) => item.technology === id))
  await cli('init', `${id} artifact consumer`, '--directory', 'groma')
  const artifact = registry.artifacts[0]!
  assert.equal(artifact.id, id)
  await cli('scanner', 'add', `${artifact.name}@${artifact.version}`)
  await cli('scanner', 'install')
  await cli('scanner', 'check')
  assert.ok(registry.downloads.has(artifact.name), 'The installer must download the packed artifact')
  await cli('scan')
  const selected = await owner()
  await cli('edit', selected.id, '--overview', 'Owns the selected implementation in the supported example.')
  await cli('scan')
  const curated = await markdown()
  await cli('scan')
  assert.equal(await markdown(), curated, 'Repeated scans must preserve curated architecture')
  await writeFile(source, `${original}\n// Release consumer source edit.\n`)
  await cli('scan')
  assert.equal((await owner()).id, selected.id, 'Source changes must preserve curated ownership')
  const beforeFailure = await markdown()
  await writeFile(source, example.broken)
  await assert.rejects(cli('scan'))
  assert.equal(await markdown(), beforeFailure, 'Scanner failure must preserve the previous complete map')
  await writeFile(source, original)
  await cli('scan')
  await cli('export', path.join(output, 'map'))
  const tool = await execute(example.tool, example.version, { cwd: root })
  const revision = await execute('git', ['rev-parse', 'HEAD'], { cwd: root })
  await mkdir(output, { recursive: true })
  await writeFile(path.join(output, 'validation.json'), `${JSON.stringify({
    platform: process.platform, arch: process.arch, artifacts: registry.artifacts,
    projectCommit: revision.stdout.trim(), toolVersion: `${tool.stdout}${tool.stderr}`.trim(),
    compiledBinarySha256: createHash('sha256').update(await readFile(binary)).digest('hex'),
    discovery, curatedOwnershipPreserved: true, sourceRescan: true, failedScanPreservedMap: true,
    publicPublication: false,
  }, null, 2)}\n`)
  console.log(`${id} artifact consumer passed on ${process.platform}-${process.arch}: ${output}`)
} finally {
  await writeFile(source, original)
  await writeFile(path.join(output, 'commands.json'), `${JSON.stringify(transcript, null, 2)}\n`)
  await registry.close()
}
