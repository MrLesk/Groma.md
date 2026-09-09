import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { loadAnnotatedArchitecture } from '../../../src/core.ts'
import type { AnnotatedArchitectureModel } from '../../../src/types.ts'
import { scannerArtifactRegistry } from '../../../scripts/scanner-artifact-registry.ts'

const examples = {
  fixture: { emitter: 'Emitter.vue', host: 'Host.vue', overlap: 'receiver.ts',
    emission: "emit('saved', value)", binding: '@saved="onSaved"',
    sourceOverview: 'Emits the completed value.', hostOverview: 'Receives the saved value.' },
  repl: { emitter: 'src/codemirror/CodeMirror.vue', host: 'src/editor/CodeMirrorEditor.vue', overlap: 'src/utils.ts',
    emission: "emit('change', editor.getValue())", binding: '@change="onChange"',
    sourceOverview: 'Edits source text with CodeMirror and emits changed text.',
    hostOverview: 'Adapts the CodeMirror editor to the REPL editor interface.' },
}
const [binaryArg, rootArg, outputArg, exampleArg] = process.argv.slice(2)
if (!binaryArg || !rootArg || !outputArg || (exampleArg !== 'fixture' && exampleArg !== 'repl')) {
  throw new Error('Usage: bun plugins/scanners/vue/smoke-compiled.ts <compiled-groma> <disposable-prepared-project> <output> <fixture|repl>')
}
const example = examples[exampleArg]
const binary = path.resolve(binaryArg)
const root = path.resolve(rootArg)
const output = path.resolve(outputArg)
const execute = promisify(execFile)
const registry = await scannerArtifactRegistry([path.join(import.meta.dir, 'dist/package')], path.join(output, 'artifacts'))
const originals = new Map<string, string>()
const transcript: { args: string[]; stdout: string; stderr: string }[] = []

async function cli(...args: string[]) {
  const result = await execute(binary, args, { cwd: root, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, BUN_CONFIG_REGISTRY: registry.url, BUN_INSTALL_CACHE_DIR: path.join(output, 'bun-cache') },
  })
  transcript.push({ args, stdout: result.stdout, stderr: result.stderr })
  return result.stdout
}

async function markdown() {
  const files = (await readdir(path.join(root, 'groma'), { recursive: true })).filter(file => file.endsWith('.md')).sort()
  const hash = createHash('sha256')
  for (const file of files) { hash.update(file); hash.update(await readFile(path.join(root, 'groma', file))) }
  return { count: files.length, sha256: hash.digest('hex') }
}

function owner(world: AnnotatedArchitectureModel, file: string) {
  const owners = world.elements.filter(element => element.code.some(reference => reference.file === file))
  assert.equal(owners.length, 1, `${file} must have one physical owner`)
  return owners[0]!
}

function selected(world: AnnotatedArchitectureModel) {
  return world.relationships.flatMap(item => item.connections ?? [])
    .filter(item => item.source === example.emitter && item.target === example.host)
}

try {
  await mkdir(output, { recursive: true })
  for (const file of [example.emitter, example.host]) originals.set(file, await readFile(path.join(root, file), 'utf8'))
  const discovery = JSON.parse(await cli('scanner', 'discover', '--json'))
  assert.ok(discovery.findings.some((item: { technology: string }) => item.technology === 'vue'))
  await cli('init', 'Vue artifact consumer', '--directory', 'groma')
  const artifact = registry.artifacts[0]!
  await cli('scanner', 'add', `${artifact.name}@${artifact.version}`)
  await cli('scanner', 'install')
  await cli('scanner', 'check')
  assert.ok(registry.downloads.has(artifact.name), 'Consumer must download the npm-packed artifact')
  await cli('scan')
  const initial = await loadAnnotatedArchitecture(root)
  assert.ok(selected(initial).length > 0, 'The selected event must establish the supplied callback')
  assert.deepEqual(new Set(owner(initial, example.overlap).code.filter(item => item.file === example.overlap).map(item => item.scanner)), new Set(['typescript', 'vue']))
  const emitter = owner(initial, example.emitter)
  const host = owner(initial, example.host)
  await cli('edit', emitter.id, '--overview', example.sourceOverview)
  await cli('edit', host.id, '--overview', example.hostOverview)
  await cli('scan')
  const curated = await markdown()
  await cli('scan')
  assert.deepEqual(await markdown(), curated, 'Repeat scan must retain curated documents')
  await writeFile(path.join(root, example.emitter), originals.get(example.emitter)!.replace(example.emission, 'void 0'))
  await cli('scan')
  assert.equal(selected(await loadAnnotatedArchitecture(root)).length, 0, 'Removing the source emission must remove its callback')
  await writeFile(path.join(root, example.emitter), originals.get(example.emitter)!)
  await writeFile(path.join(root, example.host), originals.get(example.host)!.replace(example.binding, ''))
  await cli('scan')
  const edited = await loadAnnotatedArchitecture(root)
  assert.equal(selected(edited).length, 0, 'Removing the template binding must remove its callback')
  assert.equal(owner(edited, example.emitter).id, emitter.id)
  assert.equal(owner(edited, example.host).id, host.id)
  const beforeFailure = await markdown()
  await writeFile(path.join(root, example.host), '<template><Broken></template>')
  await assert.rejects(cli('scan'), /VUE_PROJECT_PREPARATION/)
  assert.deepEqual(await markdown(), beforeFailure, 'Failed scanner must preserve all map documents')
  for (const [file, source] of originals) await writeFile(path.join(root, file), source)
  await cli('scan')
  assert.deepEqual(selected(await loadAnnotatedArchitecture(root)), selected(initial))
  await cli('export', path.join(output, 'map'))
  await writeFile(path.join(output, 'validation.json'), `${JSON.stringify({
    platform: process.platform, arch: process.arch, binarySha256: createHash('sha256').update(await readFile(binary)).digest('hex'),
    artifacts: registry.artifacts, downloadedArtifacts: [...registry.downloads], discovery,
    curatedDocuments: curated, selected: selected(initial), overlap: example.overlap,
    sourceAndTemplateRescan: true, failedScanPreservedMap: true, publicPublication: false,
  }, null, 2)}\n`)
  console.log(`Vue ${exampleArg} packed consumer passed: ${output}`)
} finally {
  for (const [file, source] of originals) await writeFile(path.join(root, file), source)
  await writeFile(path.join(output, 'commands.json'), `${JSON.stringify(transcript, null, 2)}\n`)
  await registry.close()
}
