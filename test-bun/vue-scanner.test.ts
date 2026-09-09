import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { ScannerPlugin } from '@groma/scanner'
import { buildPackage } from '../plugins/scanners/vue/build.ts'
import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { editArchitecture } from '../src/edit.ts'
import { addRelation } from '../src/relation.ts'
import { inferRelationships } from '../src/relationship-inference.ts'
import { scanRepository, watchScan } from '../src/scanner.ts'
import { addScanner } from '../src/scanner/modules/inventory.ts'
import type { AnnotatedArchitectureModel } from '../src/types.ts'

async function setup() {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-vue-test-'))
  const root = path.join(temporary, 'project')
  const artifact = path.join(temporary, 'scanner')
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  await cp(path.resolve(import.meta.dir, '../test/fixtures/vue-output'), root, { recursive: true })
  await rename(path.join(root, 'receiver.ts.fixture'), path.join(root, 'receiver.ts'))
  await mkdir(path.join(root, 'node_modules'))
  const require = createRequire(new URL('../plugins/scanners/vue/package.json', import.meta.url))
  await symlink(path.dirname(require.resolve('vue/package.json')), path.join(root, 'node_modules/vue'), 'dir')
  const child = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
  expect(await child.exited, await new Response(child.stderr).text()).toBe(0)
  await buildPackage(artifact)
  const scanner: ScannerPlugin = (await import(path.join(artifact, 'dist/index.js'))).default
  return { temporary, root, artifact, scanner }
}

function owner(model: AnnotatedArchitectureModel, file: string) {
  const matches = model.elements.filter(element => element.code.some(reference => reference.file === file))
  expect(matches).toHaveLength(1)
  return matches[0]!
}

async function documents(root: string) {
  const records = await loadArchitecture(root)
  return new Map(await Promise.all(records.documents.map(async document => [
    document.sourceFilename, await readFile(path.join(root, document.sourceFilename), 'utf8'),
  ] as const)))
}

test.concurrent('packaged Vue resolves SFC events and original UTF-16 positions beyond TypeScript', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const vue = (await scanner.scan(root))!
    expect(await scanner.scan(root)).toEqual(vue)
    const typescript = (await scanTypeScriptSource(root))!
    const owners = new Map(vue.files.map(file => [file.file, file.file]))
    expect(inferRelationships([typescript], owners)).toEqual([])
    expect(inferRelationships([typescript, vue], owners)).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'Emitter.vue', target: 'Host.vue', technology: 'vue' }),
      expect.objectContaining({ source: 'Emitter.vue', target: 'receiver.ts', technology: 'vue' }),
    ]))
    expect(vue.invocations).toHaveLength(2)
    const source = await readFile(path.join(root, 'Emitter.vue'), 'utf8')
    const host = await readFile(path.join(root, 'Host.vue'), 'utf8')
    const invocation = vue.invocations!.find(item => item.binding?.position === host.indexOf('@saved'))!
    expect(vue.operations!.find(item => item.id === invocation.source)?.position).toBe(source.indexOf('(value: string) =>'))
    expect(vue.operations!.find(item => item.id === invocation.targets[0])?.position).toBe(host.indexOf('(value: string) =>'))
    expect(invocation.position).toBe(source.indexOf("emit('saved'"))
    expect(invocation.binding).toEqual({ file: 'Host.vue', line: 7, position: host.indexOf('@saved') })
    const receiver = vue.operations!.find(item => item.file === 'receiver.ts')!
    expect(typescript.operations!.some(item => item.file === receiver.file && item.position === receiver.position)).toBe(true)
    await writeFile(path.join(root, 'Host.vue'), host.replaceAll('@saved="onSaved"', '@saved="onSaved($event)"').replaceAll('@saved="receive"', '@saved="receive($event)"'))
    const unsupported = (await scanner.scan(root))!
    expect(unsupported.invocations).toEqual([])
    expect(unsupported.diagnostics.some(item => item.code === 'unsupported-vue-binding' && item.message.startsWith('Host.vue:'))).toBe(true)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Vue overlap retains one curated physical owner and authored interaction', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const typescript = (await scanTypeScriptSource(root))!
    await reconcileScanObservations(root, [typescript])
    const before = await loadAnnotatedArchitecture(root)
    const receiver = owner(before, 'receiver.ts')
    await editArchitecture(root, { id: receiver.id, overview: 'Accepts completed values.' })
    const vue = (await scanner.scan(root))!
    await reconcileScanObservations(root, [typescript, vue])
    await addRelation(root, { source: 'Emitter.vue', target: 'receiver.ts', description: 'Delivers the saved value', technology: 'Event' })
    const authored = (await loadAnnotatedArchitecture(root)).relationships
    await reconcileScanObservations(root, [vue, typescript])
    expect((await loadAnnotatedArchitecture(root)).relationships).toEqual(authored)
    const snapshot = await documents(root)
    await reconcileScanObservations(root, [typescript, vue])
    expect(await documents(root)).toEqual(snapshot)
    const after = await loadAnnotatedArchitecture(root)
    expect(owner(after, 'receiver.ts').id).toBe(receiver.id)
    expect(new Set(owner(after, 'receiver.ts').code.map(reference => reference.scanner))).toEqual(new Set(['typescript', 'vue']))
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('SFC source and template edits rescan and failed enabled Vue scans preserve the map', async () => {
  const started = performance.now()
  const stage = (name: string) => console.error(`[vue-watch ${Math.round(performance.now() - started)}ms] ${name}`)
  stage('setup start')
  const { temporary, root, artifact } = await setup()
  stage('setup complete')
  let watcher: Awaited<ReturnType<typeof watchScan>> | undefined
  try {
    await addScanner(root, path.relative(root, artifact))
    stage('scanner added')
    await scanRepository(root)
    stage('direct scan 1 complete')
    const source = await readFile(path.join(root, 'Emitter.vue'), 'utf8')
    await writeFile(path.join(root, 'Emitter.vue'), source.replace("emit('saved', value)", 'void value'))
    await scanRepository(root)
    stage('direct scan 2 complete')
    expect((await loadAnnotatedArchitecture(root)).relationships.flatMap(item => item.connections ?? [])).toEqual([])
    await writeFile(path.join(root, 'Emitter.vue'), source)
    await scanRepository(root)
    stage('direct scan 3 complete')
    let folded!: () => void
    let failed!: (error: unknown) => void
    const rescanned = new Promise<void>((resolve, reject) => { folded = resolve; failed = reject })
    stage('watch start')
    watcher = await watchScan(root, { onFold: () => { stage('fold received'); folded() }, onError: error => { stage(`watch error: ${String(error)}`); failed(error) } })
    stage('watch ready')
    const host = await readFile(path.join(root, 'Host.vue'), 'utf8')
    await writeFile(path.join(root, 'Host.vue'), host.replaceAll(/ @saved="[^"]+"/g, ''))
    stage('template written; waiting for fold')
    await rescanned
    stage('fold wait complete')
    stage('close start')
    await watcher.close()
    stage('close complete')
    watcher = undefined
    expect((await loadAnnotatedArchitecture(root)).relationships.flatMap(item => item.connections ?? [])).toEqual([])
    const previous = await documents(root)
    await writeFile(path.join(root, 'Host.vue'), '<template><Emitter></template>')
    stage('failed scan start')
    await expect(scanRepository(root)).rejects.toThrow('VUE_PROJECT_PREPARATION')
    stage('failed scan complete')
    expect(await documents(root)).toEqual(previous)
  } finally {
    stage('cleanup start')
    await watcher?.close()
    await rm(temporary, { recursive: true, force: true })
    stage('cleanup complete')
  }
})

test.concurrent('Vue readiness identifies missing dependency preparation', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    await rm(path.join(root, 'node_modules'), { recursive: true })
    await expect(scanner.checkReadiness!(root)).rejects.toThrow('Install project dependencies')
  } finally { await rm(temporary, { recursive: true, force: true }) }
})
