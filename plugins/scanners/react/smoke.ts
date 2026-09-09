import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { loadAnnotatedArchitecture } from '../../../src/core.ts'
import { scannerArtifactRegistry } from '../../../scripts/scanner-artifact-registry.ts'

const examples = {
  fixture: { source: 'editor.tsx', target: 'host.tsx', call: "saved('ready')", replacement: "console.log('ready')" },
  backlog: { source: 'src/web/components/CleanupModal.tsx', target: 'src/web/components/TaskList.tsx',
    call: 'onSuccess(result.movedCount)', replacement: 'void onSuccess; console.log(result.movedCount)' },
}
const [mode, binaryArgument, rootArgument, packageArgument, outputArgument] = process.argv.slice(2)
if (!mode || !(mode in examples) || !binaryArgument || !rootArgument || !packageArgument || !outputArgument) {
  throw new Error('Usage: bun plugins/scanners/react/smoke.ts <fixture|backlog> <compiled-groma> <prepared-disposable-project> <built-package> <output>')
}
const example = examples[mode as keyof typeof examples]
const root = path.resolve(rootArgument)
const output = path.resolve(outputArgument)
const binary = path.resolve(binaryArgument)
const execute = promisify(execFile)
const original = await readFile(path.join(root, example.source), 'utf8')
const registry = await scannerArtifactRegistry([packageArgument], path.join(output, 'artifacts'))
const transcript: { args: string[]; stdout: string; stderr: string }[] = []

async function cli(...args: string[]) {
  const result = await execute(binary, args, { cwd: root, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, BUN_CONFIG_REGISTRY: registry.url, BUN_INSTALL_CACHE_DIR: path.join(output, 'bun-cache') } })
  transcript.push({ args, stdout: result.stdout, stderr: result.stderr })
  return result.stdout
}

async function markdown() {
  const hash = createHash('sha256')
  for (const file of (await readdir(path.join(root, 'groma'), { recursive: true })).filter(file => file.endsWith('.md')).sort()) {
    hash.update(file); hash.update(await readFile(path.join(root, 'groma', file)))
  }
  return hash.digest('hex')
}

async function owner(file: string) {
  const model = await loadAnnotatedArchitecture(root)
  const owners = model.elements.filter(element => element.code.some(code => code.file === file))
  assert.equal(owners.length, 1)
  return owners[0]!
}

async function selectedInteraction() {
  const model = await loadAnnotatedArchitecture(root)
  return model.relationships.flatMap(relationship => relationship.connections ?? [])
    .find(connection => connection.source === example.source && connection.target === example.target && !connection.authored)
}

try {
  const discovery = JSON.parse(await cli('scanner', 'discover', '--json'))
  assert.ok(discovery.findings.some((item: { technology: string }) => item.technology === 'react'))
  await cli('init', 'React callback consumer', '--directory', 'groma')
  const artifact = registry.artifacts[0]!
  await cli('scanner', 'add', `${artifact.name}@${artifact.version}`)
  await cli('scanner', 'install')
  await cli('scanner', 'check')
  assert.ok(registry.downloads.has(artifact.name), 'Installer downloads the actual packed artifact')
  await cli('scan')
  const selected = await owner(example.source)
  assert.deepEqual(new Set(selected.code.map(code => code.scanner)), new Set(['typescript', 'react']))
  assert.ok(await selectedInteraction(), 'The supplied callback establishes the selected source pair')
  await cli('edit', selected.id, '--overview', 'Completes the requested work and reports its result to the supplied callback.')
  await cli('add', 'relation', example.target, example.source, '--description', 'Presents the work to complete', '--technology', 'React')
  await cli('scan')
  const snapshot = await markdown()
  await cli('scan')
  assert.equal(await markdown(), snapshot, 'Repeat preserves curated ownership and authored relationships')
  await writeFile(path.join(root, example.source), original.replace(example.call, example.replacement))
  await cli('scan')
  assert.equal((await owner(example.source)).id, selected.id)
  assert.equal(await selectedInteraction(), undefined, 'Source edit removes the supported callback evidence')
  const beforeFailure = await markdown()
  await writeFile(path.join(root, example.source), 'export function Broken(')
  await assert.rejects(cli('scan'), /REACT_PROJECT_PREPARATION/)
  assert.equal(await markdown(), beforeFailure, 'Enabled scanner failure preserves the complete map')
  await writeFile(path.join(root, example.source), original)
  await cli('scan')
  await cli('export', path.join(output, 'map'))
  await mkdir(output, { recursive: true })
  await writeFile(path.join(output, 'validation.json'), `${JSON.stringify({
    platform: process.platform, arch: process.arch, artifacts: registry.artifacts,
    source: example.source, sourceSha256: createHash('sha256').update(original).digest('hex'),
    sourceOwner: selected.id, targetOwner: (await owner(example.target)).id,
    compiledBinarySha256: createHash('sha256').update(await readFile(binary)).digest('hex'),
    discovery, curatedRepeat: true, sourceEdit: true, failedScanPreservedMap: true, publicPublication: false,
  }, null, 2)}\n`)
  console.log(`React ${mode} packed-artifact consumer passed: ${output}`)
} finally {
  await writeFile(path.join(root, example.source), original)
  await writeFile(path.join(output, 'commands.json'), `${JSON.stringify(transcript, null, 2)}\n`)
  await registry.close()
}
