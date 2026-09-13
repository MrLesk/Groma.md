import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { ScannerPlugin } from '@groma/scanner'
import { buildPackage } from '../plugins/scanners/vue/build.ts'
import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { buildArchitectureModel } from '../src/architecture-model.ts'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { editArchitecture } from '../src/edit.ts'
import { addRelation } from '../src/relation.ts'
import { inferRelationships } from '../src/relationship-inference.ts'
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

async function storedArchitecture(root: string) {
  return buildArchitectureModel((await loadArchitecture(root)).documents)
}

test.concurrent('Vue resolves SFC events and original UTF-16 positions beyond TypeScript', async () => {
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
    expect(unsupported.diagnostics.some(item => item.code === 'unsupported-vue-binding' && item.file === 'Host.vue' && Number.isInteger(item.line))).toBe(true)
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
    const snapshot = await storedArchitecture(root)
    await reconcileScanObservations(root, [typescript, vue])
    expect(await storedArchitecture(root)).toEqual(snapshot)
    const after = await loadAnnotatedArchitecture(root)
    expect(owner(after, 'receiver.ts').id).toBe(receiver.id)
    expect(new Set(owner(after, 'receiver.ts').code.map(reference => reference.scanner))).toEqual(new Set(['typescript', 'vue']))
  } finally { await rm(temporary, { recursive: true, force: true }) }
})
