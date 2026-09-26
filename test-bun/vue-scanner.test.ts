import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ScannerPlugin, SourceReference } from '@groma/scanner'
import { buildPackage } from '../plugins/scanners/vue/build.ts'
import manifest from '../plugins/scanners/vue/package.json'
import typescriptManifest from '../plugins/scanners/typescript/package.json'
import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'
import { readCodeStructure as readReferenceOutline } from '../plugins/scanners/typescript/src/structure.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { buildArchitectureModel } from '../src/architecture-model.ts'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { editArchitecture } from '../src/edit.ts'
import { addRelation } from '../src/relation.ts'
import { inferRelationships } from '../src/relationship-inference.ts'
import { scannerFiles } from '../src/scanner/modules/selection.ts'
import { createScannerSession } from '../src/scanner/session.ts'
import type { AnnotatedArchitectureModel } from '../src/types.ts'
import { readCodeStructure } from '../src/viewers/source/structure.ts'

/** The files Groma hands each scanner with its package defaults. */
const vueFiles = (root: string) => scannerFiles(root, manifest.groma.scanner)
const typescriptFiles = (root: string) => scannerFiles(root, typescriptManifest.groma.scanner)

async function setup() {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-vue-test-'))
  const root = path.join(temporary, 'project')
  const artifact = path.join(temporary, 'scanner')
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  await cp(path.resolve(import.meta.dir, '../test/fixtures/vue-output'), root, { recursive: true })
  await rename(path.join(root, 'receiver.ts.fixture'), path.join(root, 'receiver.ts'))
  await rename(path.join(root, 'logic.ts.fixture'), path.join(root, 'logic.ts'))
  const child = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
  expect(await child.exited, await new Response(child.stderr).text()).toBe(0)
  await buildPackage(artifact)
  const scanner: ScannerPlugin = (await import(path.join(artifact, 'dist/index.js'))).default
  return { temporary, root, artifact, scanner }
}

async function outlineSetup() {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-vue-outline-'))
  const root = path.join(temporary, 'project')
  const artifact = path.join(temporary, 'scanner')
  await cp(path.resolve(import.meta.dir, '../test/fixtures/vue-outline'), root, { recursive: true })
  await buildPackage(artifact)
  const scanner: ScannerPlugin = (await import(path.join(artifact, 'dist/index.js'))).default
  return { temporary, root, artifact, scanner }
}

function owner(model: AnnotatedArchitectureModel, file: string) {
  const matches = model.elements.filter(element => element.code.some(reference => reference.file === file))
  expect(matches).toHaveLength(1)
  return matches[0]!
}

async function storedArchitecture(root: string) {
  return buildArchitectureModel((await loadArchitecture(root)).documents)
}

test.concurrent('Vue resolves SFC events and original UTF-16 positions beyond TypeScript', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const vue = (await scanner.scan(root, {}, await vueFiles(root)))!
    expect(await scanner.scan(root, {}, await vueFiles(root))).toEqual(vue)
    expect(vue.diagnostics.some(item => item.file === 'Emitter.vue' && item.code === 'unsupported-vue-binding')).toBe(false)
    const typescript = (await scanTypeScriptSource(root, await typescriptFiles(root)))!
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
    await writeFile(path.join(root, 'Emitter.vue'), source.replace(
      'defineEmits<{ saved: [value: string] }>()', "defineEmits<(event: 'saved', value: string) => void>()",
    ))
    expect((await scanner.scan(root, {}, await vueFiles(root)))!.invocations).toHaveLength(2)
    await writeFile(path.join(root, 'Emitter.vue'), source.replace(
      'defineEmits<{ saved: [value: string] }>()', "defineEmits(['saved'])",
    ))
    expect((await scanner.scan(root, {}, await vueFiles(root)))!.invocations).toHaveLength(2)
    await writeFile(path.join(root, 'Host.vue'), host.replaceAll('@saved="onSaved"', '@saved="onSaved($event)"').replaceAll('@saved="receive"', '@saved="receive($event)"'))
    const unsupported = (await scanner.scan(root, {}, await vueFiles(root)))!
    expect(unsupported.invocations).toEqual([])
    expect(unsupported.diagnostics.some(item => item.code === 'unsupported-vue-binding' && item.file === 'Host.vue' && Number.isInteger(item.line))).toBe(true)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Vue overlap retains one curated physical owner and authored interaction', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const typescript = (await scanTypeScriptSource(root, await typescriptFiles(root)))!
    await reconcileScanObservations(root, [typescript])
    const before = await loadAnnotatedArchitecture(root)
    const receiver = owner(before, 'receiver.ts')
    await editArchitecture(root, { id: receiver.id, overview: 'Accepts completed values.' })
    const vue = (await scanner.scan(root, {}, await vueFiles(root)))!
    await reconcileScanObservations(root, [typescript, vue])
    await addRelation(root, { source: 'Emitter.vue', target: 'receiver.ts', description: 'Delivers the saved value', technology: 'Event' })
    const authored = (await loadAnnotatedArchitecture(root)).relationships
    await reconcileScanObservations(root, [vue, typescript])
    expect((await loadAnnotatedArchitecture(root)).relationships).toEqual(authored)
    const snapshot = await storedArchitecture(root)
    await reconcileScanObservations(root, [typescript, vue])
    expect(await storedArchitecture(root)).toEqual(snapshot)
    const after = await loadAnnotatedArchitecture(root)
    expect(owner(after, 'receiver.ts').id).toBe(receiver.id)
    expect(new Set(owner(after, 'receiver.ts').code.map(reference => reference.scanner))).toEqual(new Set(['typescript', 'vue']))
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Vue external blocks share one component while imports and transitive styles stay separate', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const vue = (await scanner.scan(root, {}, await vueFiles(root)))!, typescript = (await scanTypeScriptSource(root, await typescriptFiles(root)))!
    expect(vue.files.some(file => file.file === 'shared.css')).toBe(false)
    await reconcileScanObservations(root, [vue, typescript])
    const model = await loadAnnotatedArchitecture(root)
    const id = owner(model, 'External.vue').id
    for (const file of ['logic.ts', 'markup.html', 'panel.css']) expect(owner(model, file).id).toBe(id)
    expect(owner(model, 'receiver.ts').id).not.toBe(id)
    expect(model.relationships).toHaveLength(2)
    await editArchitecture(root, { id, overview: 'Collects the response.' })
    const before = await storedArchitecture(root)
    expect((await reconcileScanObservations(root, [typescript, vue])).created).toBe(0)
    expect(await storedArchitecture(root)).toEqual(before)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Vue binds a declared emit called directly from a child template', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const child = '<script setup lang="ts">const emit = defineEmits<{ saved: [] }>()</script>\n<template><button @click="emit(\'saved\')">Save</button></template>'
    await writeFile(path.join(root, 'Emitter.vue'), child)
    const observation = (await scanner.scan(root, {}, await vueFiles(root)))!
    expect(observation.invocations).toHaveLength(2)
    expect(observation.invocations?.every(call => call.position === child.indexOf("emit('saved')"))).toBe(true)
    expect(observation.operations?.find(operation => operation.id === observation.invocations?.[0]?.source)?.name).toBe('(template)')
    await writeFile(path.join(root, 'Emitter.vue'), child.replace('defineEmits<{ saved: [] }>()', "defineEmits(['saved'])"))
    expect((await scanner.scan(root, {}, await vueFiles(root)))?.invocations).toHaveLength(2)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Vue rejects external scripts combined with script setup', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    await writeFile(path.join(root, 'External.vue'), '<script setup lang="ts" src="./logic.ts"></script>')
    await expect(scanner.scan(root, {}, await vueFiles(root))).rejects.toThrow('script setup')
    await writeFile(path.join(root, 'External.vue'), '<script lang="ts" src="./logic.ts"></script><script setup lang="ts">const value = 1</script>')
    await expect(scanner.scan(root, {}, await vueFiles(root))).rejects.toThrow('script setup')
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Vue reads no source its exclusions name, even one its config includes', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const config = path.join(root, 'tsconfig.json')
    await writeFile(config, JSON.stringify({ ...JSON.parse(await readFile(config, 'utf8')), include: ['**/*.ts', '**/*.vue'] }))
    // Read, the built component the config includes fails the scan with its unclosed element.
    await mkdir(path.join(root, 'dist/ui'), { recursive: true })
    await writeFile(path.join(root, 'dist/ui/Button.vue'), '<template><button>Save</template>\n')
    const files = await vueFiles(root)
    await scanner.checkReadiness!(root, {}, files)
    expect((await scanner.scan(root, {}, files))!.files.map(file => file.file)).not.toContain('dist/ui/Button.vue')
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Vue excludes imported callback endpoints without rejecting the remaining evidence', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    for (const excluded of ['Emitter.vue', 'receiver.ts']) {
      const files = await scannerFiles(root, { ...manifest.groma.scanner, exclude: [...manifest.groma.scanner.exclude, excluded] })
      const observation = (await scanner.scan(root, {}, files))!
      expect(observation.files.some(file => file.file === excluded)).toBe(false)
      expect(observation.operations?.some(operation => operation.file === excluded)).toBe(false)
      const owners = new Map(observation.files.map(file => [file.file, file.file]))
      expect(inferRelationships([observation], owners)).toEqual(excluded === 'Emitter.vue' ? [] : [
        expect.objectContaining({ source: 'Emitter.vue', target: 'Host.vue', technology: 'vue' }),
      ])
    }
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Vue reads tracked components and Nuxt routes without generated TypeScript config roots', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'app', dependencies: { vue: '*', nuxt: '*' } }))
    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ files: [], references: [{ path: './.nuxt/tsconfig.app.json' }] }))
    await mkdir(path.join(root, 'server/api'), { recursive: true })
    await writeFile(path.join(root, 'server/api/hello.ts'), 'export default function hello() {}')
    const observation = (await scanner.scan(root, {}, await vueFiles(root)))!
    expect(observation.files.map(file => file.file)).toContain('Emitter.vue')
    expect(observation.files.map(file => file.file)).toContain('server/api/hello.ts')
    expect(observation.httpEndpoints?.some(endpoint => endpoint.path.some(segment => segment.kind === 'literal' && segment.value === 'hello'))).toBe(true)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Vue scans local components when an extended generated config is absent', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ extends: './.generated/tsconfig.json' }))
    const observation = (await scanner.scan(root, {}, await vueFiles(root)))!
    expect(observation.files.map(file => file.file)).toContain('Emitter.vue')
    expect(observation.diagnostics.some(item => item.code === 'vue-missing-config-base')).toBe(true)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Vue reports a missing declared TypeScript root while scanning local components', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ files: ['src/**/*.ts'] }))
    const observation = (await scanner.scan(root, {}, await vueFiles(root)))!
    expect(observation.files.map(file => file.file)).toContain('Emitter.vue')
    expect(observation.diagnostics.some(item => item.code === 'vue-missing-config-source')).toBe(true)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('the live Vue session refreshes after external script, template, and style edits', async () => {
  const { temporary, root, artifact } = await setup()
  let complete: (() => void) | undefined
  const session = await createScannerSession(root, { onFold() { complete?.() } })
  try {
    await session.change({ action: 'add', source: artifact })
    expect(session.state.scanners.find(scanner => scanner.id === 'vue')?.status).toBe('ready')
    const id = owner(await loadAnnotatedArchitecture(root), 'External.vue').id
    for (const file of ['logic.ts', 'markup.html', 'panel.css']) {
      const changed = Promise.withResolvers<void>()
      complete = () => changed.resolve()
      const filename = path.join(root, file)
      await writeFile(filename, (await readFile(filename, 'utf8')) + '\n')
      await changed.promise
      expect(owner(await loadAnnotatedArchitecture(root), file).id).toBe(id)
    }
  } finally { await session.close(); await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('the built Vue package outlines single-file component scripts at their file lines', async () => {
  const { temporary, root, scanner } = await outlineSetup()
  try {
    const files = await scanner.readCodeStructure!(root, [{ file: 'Profile.vue', symbols: ['Members'] }])
    const summary = files.map(file => [file.file, file.declarations.map(declaration => [
      declaration.kind, declaration.name, declaration.line, declaration.visibility, declaration.entry,
      declaration.kind === 'type' ? declaration.members.map(member => [member.name, member.line, member.visibility]) : [],
    ])])

    // The script setup block exports nothing, so save is private; every line is the line of the .vue file.
    expect(summary).toEqual([['Profile.vue', [
      ['function', 'initials', 2, 'private', false, []],
      ['type', 'Members', 6, 'public', true, [['constructor', 7, 'public'], ['initials', 9, 'public'], ['first', 13, 'protected']]],
      ['function', 'save', 25, 'private', false, []],
    ]]])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('the built Vue package and the TypeScript scanner outline a script alike', async () => {
  const { temporary, root, scanner } = await outlineSetup()
  try {
    const sources: [string, SourceReference][] = [
      [root, { file: 'greeting.ts', symbols: ['greeting'] }],
      [path.resolve(import.meta.dir, '../test/fixtures/typescript-outline'), { file: 'outline.ts', symbols: ['listed'] }],
    ]
    for (const [sourceRoot, reference] of sources) {
      const outline = await scanner.readCodeStructure!(sourceRoot, [reference])
      expect(outline).toHaveLength(1)
      expect(outline).toEqual(await readReferenceOutline(sourceRoot, [reference]))
    }
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('a script Vue and TypeScript both own shows one outline', async () => {
  const { temporary, root, artifact, scanner } = await outlineSetup()
  try {
    await writeFile(path.join(root, 'groma/scanners.json'), JSON.stringify({ scanners: [
      { id: 'typescript', source: path.resolve(import.meta.dir, '../plugins/scanners/typescript'), include: typescriptManifest.groma.scanner.include },
      { id: 'vue', source: artifact, include: manifest.groma.scanner.include },
    ] }))
    const world = await loadAnnotatedArchitecture(root)
    const component = world.elements.find(element => element.kind === 'component')!
    const files = await readCodeStructure(root, world, null, component.representationId) ?? []

    // Only the Vue link names greeting, whichever scanner outlines the shared script.
    expect(files.map(file => file.file)).toEqual(['Profile.vue', 'greeting.ts'])
    expect(files[1]).toEqual((await scanner.readCodeStructure!(root, [{ file: 'greeting.ts', symbols: ['greeting'] }]))[0])
    expect(files[1]?.declarations.find(declaration => declaration.name === 'greeting')?.entry).toBe(true)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})
