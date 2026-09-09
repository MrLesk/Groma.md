import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import type { AnnotatedArchitectureModel } from '../src/types.ts'
import { scannerArtifactRegistry } from './scanner-artifact-registry.ts'

const [binaryArg, projectArg, outputArg, ...packages] = process.argv.slice(2)
if (!binaryArg || !projectArg || !outputArg || packages.length !== 2) {
  throw new Error('Usage: bun scripts/validate-callforpapers-artifacts.ts <compiled-groma> <disposable-prepared-callforpapers> <evidence-output> <java-package> <angular-package>')
}
const execute = promisify(execFile)
const binary = path.resolve(binaryArg)
const root = path.resolve(projectArg)
const output = path.resolve(outputArg)
const registry = await scannerArtifactRegistry(packages, path.join(output, 'artifacts'))
const prefix = 'src/main/webapp/app/callforpaper/companies/'
const emitter = `${prefix}company-merge-dialog.component.ts`
const emitterTemplate = `${prefix}company-merge-dialog.component.html`
const host = `${prefix}company-list.component.ts`
const template = `${prefix}company-list.component.html`
const originals = new Map<string, string>()
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
  const files = (await readdir(directory, { recursive: true })).filter(file => file.endsWith('.md')).sort()
  const hash = createHash('sha256')
  for (const file of files) { hash.update(file); hash.update(await readFile(path.join(directory, file))) }
  return hash.digest('hex')
}

function owner(world: AnnotatedArchitectureModel, file: string) {
  const owners = world.elements.filter(element => element.code.some(reference => reference.file === file))
  assert.equal(owners.length, 1, `${file} must have one physical owner`)
  return owners[0]!
}

async function curatePair(source: string, html: string, overview: string) {
  const world = await loadAnnotatedArchitecture(root)
  const selected = owner(world, source)
  const other = owner(world, html)
  if (selected.id !== other.id) await cli('edit', selected.id, '--combine', other.id)
  await cli('edit', selected.id, '--overview', overview)
  return selected.id
}

function selectedConnections(world: AnnotatedArchitectureModel) {
  return world.relationships.flatMap(item => item.connections ?? [])
    .filter(item => item.source === emitter && item.target === host)
}

try {
  await mkdir(output, { recursive: true })
  for (const file of [emitter, template]) originals.set(file, await readFile(path.join(root, file), 'utf8'))
  const discovery = JSON.parse(await cli('scanner', 'discover', '--json'))
  for (const technology of ['java', 'angular', 'typescript']) {
    assert.ok(discovery.findings.some((item: { technology: string }) => item.technology === technology))
  }
  await cli('init', 'Callforpapers artifact consumer', '--directory', 'groma')
  for (const artifact of registry.artifacts) await cli('scanner', 'add', `${artifact.name}@${artifact.version}`)
  await cli('scanner', 'install')
  await cli('scanner', 'check')
  for (const artifact of registry.artifacts) assert.ok(registry.downloads.has(artifact.name), `${artifact.name} must be downloaded from the packed artifact`)
  await cli('scan')
  const initial = await loadAnnotatedArchitecture(root)
  assert.deepEqual(new Set(owner(initial, emitter).code.filter(item => item.file === emitter).map(item => item.scanner)), new Set(['angular', 'typescript']))
  assert.ok(initial.elements.some(element => element.code.some(item => item.file.endsWith('.java'))))
  assert.ok(selectedConnections(initial).length > 0, 'Angular must supply the selected output callback')
  const emitterId = await curatePair(emitter, emitterTemplate, 'Merges the selected company and emits the completed result.')
  const hostId = await curatePair(host, template, 'Lists companies and applies the completed merge result.')
  await cli('scan')
  const curated = await markdown()
  await cli('scan')
  assert.equal(await markdown(), curated, 'Repeat scan must preserve the curated map')
  await writeFile(path.join(root, emitter), `${originals.get(emitter)}\n// Release consumer source edit.\n`)
  await writeFile(path.join(root, template), originals.get(template)!.replace('(merged)="onMergeComplete($event)"', ''))
  await cli('scan')
  const edited = await loadAnnotatedArchitecture(root)
  assert.equal(owner(edited, emitter).id, emitterId)
  assert.equal(owner(edited, emitterTemplate).id, emitterId)
  assert.equal(owner(edited, host).id, hostId)
  assert.equal(owner(edited, template).id, hostId)
  assert.notDeepEqual(selectedConnections(edited), selectedConnections(initial), 'Removing the merged binding must update the derived interaction while retaining other callbacks')
  const beforeFailure = await markdown()
  await writeFile(path.join(root, template), '<invalid-tag (merged)="onMergeComplete(" />\n')
  await assert.rejects(cli('scan'), /ANGULAR|Angular|angular/)
  assert.equal(await markdown(), beforeFailure, 'Enabled scanner failure must preserve the complete map')
  for (const [file, source] of originals) await writeFile(path.join(root, file), source)
  await cli('scan')
  assert.deepEqual(selectedConnections(await loadAnnotatedArchitecture(root)), selectedConnections(initial))
  const added = path.join(root, 'release-discovery-example')
  await cp(path.resolve(import.meta.dir, '../test/fixtures/go-module'), added, { recursive: true })
  try {
    const rediscovered = JSON.parse(await cli('scanner', 'discover', '--json'))
    assert.ok(rediscovered.findings.some((item: { technology: string; file: string }) => item.technology === 'go' && item.file === 'release-discovery-example/go.mod'))
  } finally { await rm(added, { recursive: true, force: true }) }
  await cli('export', path.join(output, 'map'))
  const tools = await Promise.all([['java', '-version'], ['node', '--version'], ['bun', '--version']].map(async ([command, ...args]) => {
    const result = await execute(command!, args, { cwd: root })
    return { command, version: `${result.stdout}${result.stderr}`.trim() }
  }))
  await writeFile(path.join(output, 'validation.json'), `${JSON.stringify({
    platform: process.platform, arch: process.arch, artifacts: registry.artifacts, tools,
    compiledBinarySha256: createHash('sha256').update(await readFile(binary)).digest('hex'),
    discovery, downloadedArtifacts: [...registry.downloads],
    curatedOwnershipPreserved: true, complementaryEvidence: true, sourceAndTemplateRescan: true,
    failedScanPreservedMap: true, rediscovery: true, publicPublication: false,
  }, null, 2)}\n`)
  console.log(`Artifact consumer passed on ${process.platform}-${process.arch}: ${output}`)
} finally {
  for (const [file, source] of originals) await writeFile(path.join(root, file), source)
  await writeFile(path.join(output, 'commands.json'), `${JSON.stringify(transcript, null, 2)}\n`)
  await registry.close()
}
