import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ScanObservation, ScannerPlugin, SourceReference } from '@groma/scanner'
import { buildPackage } from '../plugins/scanners/react/build.ts'
import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'
import { readCodeStructure as readReferenceOutline } from '../plugins/scanners/typescript/src/structure.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { buildArchitectureModel } from '../src/architecture-model.ts'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { editArchitecture } from '../src/edit.ts'
import { inferRelationships } from '../src/relationship-inference.ts'
import type { AnnotatedArchitectureModel } from '../src/types.ts'
import { readCodeStructure } from '../src/viewers/source/structure.ts'

async function setup() {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-react-test-'))
  const root = path.join(temporary, 'project')
  const artifact = path.join(temporary, 'scanner')
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  await cp(path.resolve(import.meta.dir, '../test/fixtures/react-callback'), root, { recursive: true })
  for (const name of ['editor', 'host']) await rename(path.join(root, `${name}.tsx.fixture`), path.join(root, `${name}.tsx`))
  const child = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
  expect(await child.exited, await new Response(child.stderr).text()).toBe(0)
  await buildPackage(artifact)
  const scanner: ScannerPlugin = (await import(path.join(artifact, 'dist/index.js'))).default
  return { temporary, root, artifact, scanner }
}

async function outlineSetup() {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-react-outline-'))
  const root = path.join(temporary, 'project')
  const artifact = path.join(temporary, 'scanner')
  await cp(path.resolve(import.meta.dir, '../test/fixtures/react-outline'), root, { recursive: true })
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

/** The fixture's one derived row: the editor invokes a callback the target file supplies. */
function expectCallbackRow(react: ScanObservation, target = 'host.tsx') {
  const owners = new Map(react.files.map(file => [file.file, file.file]))
  expect(inferRelationships([react], owners)).toEqual([
    expect.objectContaining({ source: 'editor.tsx', target, technology: 'react' }),
  ])
}

test.concurrent('React supplies a JSX callback beyond TypeScript with original source positions', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const react = (await scanner.scan(root))!
    expect(await scanner.scan(root)).toEqual(react)
    const typescript = (await scanTypeScriptSource(root))!
    const owners = new Map(react.files.map(file => [file.file, file.file]))
    expect(inferRelationships([typescript], owners)).toEqual([])
    expect(inferRelationships([typescript, react], owners)).toEqual([
      expect.objectContaining({ source: 'editor.tsx', target: 'host.tsx', technology: 'react' }),
    ])
    expect(react.invocations).toHaveLength(1)
    const invocation = react.invocations![0]!
    const source = await readFile(path.join(root, 'editor.tsx'), 'utf8')
    const host = await readFile(path.join(root, 'host.tsx'), 'utf8')
    const caller = react.operations!.find(operation => operation.id === invocation.source)!
    const target = react.operations!.find(operation => operation.id === invocation.targets[0])!
    expect(caller.position).toBe(source.indexOf('() =>'))
    expect(target.position).toBe(host.indexOf('(value: string) =>'))
    expect(invocation.position).toBe(source.indexOf("saved('ready')"))
    expect(invocation.binding).toEqual({ file: 'host.tsx', line: 4, position: host.indexOf('saved={') })
    expect(typescript.operations!.some(operation => operation.file === caller.file && operation.position === caller.position)).toBe(true)
    const conflicting = structuredClone(react)
    conflicting.scanner.id = 'other'
    conflicting.invocations![0]!.targets = [caller.id]
    expect(inferRelationships([react, conflicting], owners)).toEqual([])
    expect(inferRelationships([conflicting, react], owners)).toEqual([])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

// The component import resolves only through the alias that the config the layout names declares.
const freshCheckoutConfigs: [string, Record<string, string>, string[]][] = [
  ['a solution config that references its compiler config', {
    'tsconfig.json': '{"files":[],"references":[{"path":"./tsconfig.app.json"}]}',
    'tsconfig.app.json': '{"compilerOptions":{"composite":true,"jsx":"react-jsx","paths":{"@/*":["./*"]}},"include":["*.tsx"]}',
  }, []],
  ['a config whose extended base is not installed', {
    'tsconfig.json': '{"extends":"@acme/tsconfig/base.json","compilerOptions":{"jsx":"react-jsx","paths":{"@/*":["./*"]}},"include":["*.tsx"]}',
  }, ['react-missing-config-base']],
]

for (const [layout, configs, codes] of freshCheckoutConfigs) {
  test.concurrent(`React scans a fresh checkout with ${layout}`, async () => {
    const { temporary, root, scanner } = await setup()
    try {
      for (const [file, text] of Object.entries(configs)) await writeFile(path.join(root, file), text)
      const host = path.join(root, 'host.tsx')
      await writeFile(host, (await readFile(host, 'utf8')).replace("'./editor'", "'@/editor'"))
      const react = (await scanner.scan(root))!
      expectCallbackRow(react)
      expect(react.diagnostics.map(item => item.code)).toEqual(codes)
    } finally { await rm(temporary, { recursive: true, force: true }) }
  })
}

test.concurrent('React binds a handler a TypeScript module defines', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    await writeFile(path.join(root, 'handlers.ts'), 'export const receive = (value: string) => { console.log(value) }\n')
    const host = path.join(root, 'host.tsx')
    await writeFile(host, (await readFile(host, 'utf8'))
      .replace('  const receive = (value: string) => { console.log(value) }\n', '')
      .replace("import { Editor } from './editor'", "import { Editor } from './editor'\nimport { receive } from './handlers'"))
    expectCallbackRow((await scanner.scan(root))!, 'handlers.ts')
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

// Each shape supplies or receives the fixture's callback in a way real components commonly write it.
const callbackShapes: [string, string, (source: string) => string][] = [
  ['a handler whose declared type comes from an uninstalled package', 'host.tsx', source =>
    `import type { Handler } from 'uninstalled-events'\n${source.replace('const receive =', 'const receive: Handler =')}`],
  ['an inline arrow', 'host.tsx', source => source.replace('saved={receive}', 'saved={(value: string) => console.log(value)}')],
  ['a useCallback handler', 'host.tsx', source => `import { useCallback } from 'react'\n${source
    .replace('const receive = (value: string) => { console.log(value) }', 'const receive = useCallback((value: string) => { console.log(value) }, [])')}`],
  ['a defaulted callback prop', 'editor.tsx', source => source.replace('{ saved }', '{ saved = () => {} }')],
  ['a props object', 'editor.tsx', source => source.replace('{ saved }: { saved', 'props: { saved').replace("saved('ready')", "props.saved('ready')")],
  ['a forwardRef component', 'editor.tsx', source => `import { forwardRef } from 'react'\n${source
    .replace('export function Editor(', 'export const Editor = forwardRef(function Editor(').replace('void }) {', 'void }, ref) {').replace(/}\s*$/, '})\n')}`],
]

for (const [shape, file, edit] of callbackShapes) {
  test.concurrent(`React binds ${shape}`, async () => {
    const { temporary, root, scanner } = await setup()
    try {
      const source = path.join(root, file)
      await writeFile(source, edit(await readFile(source, 'utf8')))
      expectCallbackRow((await scanner.scan(root))!)
    } finally { await rm(temporary, { recursive: true, force: true }) }
  })
}

test.concurrent('React binds no platform file to a component variant another platform builds', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    // host.web.tsx imports './editor', which the compiler resolves to the shared file while the web build loads editor.web.tsx.
    await writeFile(path.join(root, 'tsconfig.json'), '{"compilerOptions":{"jsx":"react-jsx","moduleSuffixes":[".native",""]},"include":["*.tsx"]}')
    for (const name of ['editor', 'host']) await cp(path.join(root, `${name}.tsx`), path.join(root, `${name}.web.tsx`))
    const react = (await scanner.scan(root))!
    expect(react.invocations!.map(call => call.binding?.file)).toEqual(['host.tsx'])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('a React package compiled by an ancestor config scans once beside the nested package it uses', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    // app has no config of its own; the root config compiles app and the nested library package lib.
    const [editor, host] = await Promise.all(['editor.tsx', 'host.tsx'].map(name => readFile(path.join(root, name), 'utf8')))
    const manifest = (name: string) => JSON.stringify({ name, dependencies: { react: '19.2.7' } })
    const files: Record<string, string> = {
      'package.json': '{"name":"workspace","private":true}',
      'tsconfig.json': '{"compilerOptions":{"jsx":"react-jsx"},"include":["app","lib"]}',
      'app/package.json': manifest('app'),
      'app/host.tsx': host.replace("'./editor'", "'../lib/editor'"),
      'lib/package.json': manifest('lib'),
      'lib/tsconfig.json': '{"compilerOptions":{"jsx":"react-jsx"},"include":["*.tsx"]}',
      'lib/editor.tsx': `${editor}export const load = () => fetch('/api/items')\n`,
    }
    await Promise.all(['editor.tsx', 'host.tsx'].map(name => rm(path.join(root, name))))
    for (const [file, text] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), text)
    }
    const react = (await scanner.scan(root))!
    expect(react.invocations!.map(call => call.binding?.file)).toEqual(['app/host.tsx'])
    expect(react.httpRequests).toHaveLength(1)
    // The library's component stays in the library's source root although the app's binding touches it.
    const roots = new Map(react.roots.map(item => [item.id, item.file]))
    const library = react.files.find(file => file.file === 'lib/editor.tsx')!
    expect(new Set(library.roots.map(id => roots.get(id)))).toEqual(new Set(['lib/package.json']))
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('React leaves out the test files the TypeScript scanner leaves out, whatever their syntax', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    await writeFile(path.join(root, 'editor.test.tsx'), 'export const broken = <Editor saved={\n')
    // A package holding only tests has no components to report and does not fail the scan either.
    await mkdir(path.join(root, 'checks'))
    await writeFile(path.join(root, 'checks/package.json'), '{"name":"checks","devDependencies":{"react":"19.2.7"}}')
    await writeFile(path.join(root, 'checks/tsconfig.json'), '{"compilerOptions":{"jsx":"react-jsx"}}')
    await writeFile(path.join(root, 'checks/editor.test.tsx'), 'export const Check = () => <div />\n')
    const react = (await scanner.scan(root))!
    expect(react.files.map(file => file.file)).toEqual(['editor.tsx', 'host.tsx'])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('React rejects a reassigned callback parameter instead of inferring the supplied handler', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const file = path.join(root, 'editor.tsx')
    const original = await readFile(file, 'utf8')
    await writeFile(file, original.replace('const finish =', 'saved = () => {};\n  const finish ='))
    const react = (await scanner.scan(root))!
    const owners = new Map(react.files.map(file => [file.file, file.file]))
    expect(inferRelationships([react], owners)).toEqual([])
    expect(react.invocations).toEqual([])
    expect(react.diagnostics.some(item => item.code === 'unsupported-react-binding')).toBe(true)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

for (const assignment of ['[saved] = [() => {}]', '({ saved } = { saved: () => {} })', '({ callback: saved } = { callback: () => {} })', 'for (saved of [() => {}]) {}']) {
  test.concurrent(`React rejects a callback overwritten by ${assignment}`, async () => {
    const { temporary, root, scanner } = await setup()
    try {
      const file = path.join(root, 'editor.tsx')
      const original = await readFile(file, 'utf8')
      await writeFile(file, original.replace('const finish =', `${assignment};\n  const finish =`))
      const react = (await scanner.scan(root))!
      const owners = new Map(react.files.map(file => [file.file, file.file]))
      expect(inferRelationships([react], owners)).toEqual([])
      expect(react.invocations).toEqual([])
      expect(react.diagnostics.some(item => item.code === 'unsupported-react-binding')).toBe(true)
    } finally { await rm(temporary, { recursive: true, force: true }) }
  })
}

test.concurrent('React preserves callback reads and assignments to another symbol', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const file = path.join(root, 'editor.tsx')
    const original = await readFile(file, 'utf8')
    await writeFile(file, original.replace('const finish =', `
      let other = saved;
      [other = saved] = [saved];
      ({ saved: other } = { saved });
      { let saved = other; [saved] = [other]; }
      for (const other of [saved]) { void other; }
      for (let saved of [other]) { saved = other; }
      const finish =`))
    const react = (await scanner.scan(root))!
    const owners = new Map(react.files.map(file => [file.file, file.file]))
    expect(inferRelationships([react], owners)).toEqual([
      expect.objectContaining({ source: 'editor.tsx', target: 'host.tsx', technology: 'react' }),
    ])
    expect(react.diagnostics).toEqual([])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('React abstains on conditional handlers and JSX spreads', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const file = path.join(root, 'host.tsx')
    const original = await readFile(file, 'utf8')
    await writeFile(file, original.replace('saved={receive}', 'saved={Math.random() ? receive : (value: string) => console.log(value)}'))
    const conditional = (await scanner.scan(root))!
    expect(conditional.invocations).toEqual([])
    expect(conditional.diagnostics.some(item => item.code === 'unsupported-react-binding')).toBe(true)
    await writeFile(file, original.replace('saved={receive}', '{...{saved: receive}}'))
    const spread = (await scanner.scan(root))!
    expect(spread.invocations).toEqual([])
    expect(spread.diagnostics.some(item => item.code === 'unsupported-react-binding')).toBe(true)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('React overlapping scans retain curated ownership in either observation order', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const typescript = (await scanTypeScriptSource(root))!
    await reconcileScanObservations(root, [typescript])
    const source = owner(await loadAnnotatedArchitecture(root), 'editor.tsx')
    await editArchitecture(root, { id: source.id, overview: 'Publishes a completed edit.' })
    const react = (await scanner.scan(root))!
    await reconcileScanObservations(root, [typescript, react])
    const snapshot = await storedArchitecture(root)
    await reconcileScanObservations(root, [react, typescript])
    expect(await storedArchitecture(root)).toEqual(snapshot)
    const after = await loadAnnotatedArchitecture(root)
    expect(owner(after, 'editor.tsx').id).toBe(source.id)
    expect(new Set(owner(after, 'editor.tsx').code.map(reference => reference.scanner))).toEqual(new Set(['typescript', 'react']))
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('the built React package outlines components, classes and functions', async () => {
  const { temporary, root, scanner } = await outlineSetup()
  try {
    const files = await scanner.readCodeStructure!(root, [{ file: 'profile.tsx', symbols: ['Profile'] }])
    const summary = files.map(file => [file.file, file.declarations.map(declaration => [
      declaration.kind, declaration.name, declaration.line, declaration.visibility, declaration.entry,
      declaration.kind === 'type' ? declaration.members.map(member => [member.name, member.line, member.visibility]) : [],
    ])])

    // The memo-wrapped component is not a function literal bound to its name.
    expect(summary).toEqual([['profile.tsx', [
      ['function', 'initials', 3, 'private', false, []],
      ['function', 'Avatar', 7, 'public', false, []],
      ['function', 'Profile', 9, 'public', true, []],
      ['type', 'Counter', 15, 'public', false, [['label', 16, 'public'], ['increment', 20, 'protected'], ['render', 22, 'public']]],
    ]]])

    // The package's own compiler must read the shared rules exactly as the TypeScript scanner does.
    const sources: [string, SourceReference][] = [
      [root, { file: 'profile.tsx', symbols: ['Profile'] }],
      [path.resolve(import.meta.dir, '../test/fixtures/typescript-outline'), { file: 'outline.ts', symbols: ['listed'] }],
    ]
    for (const [sourceRoot, reference] of sources) {
      const outline = await scanner.readCodeStructure!(sourceRoot, [reference])
      expect(outline).toHaveLength(1)
      expect(outline).toEqual(await readReferenceOutline(sourceRoot, [reference]))
    }
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('a file React and TypeScript both own shows one outline', async () => {
  const { temporary, root, artifact, scanner } = await outlineSetup()
  try {
    await writeFile(path.join(root, 'groma/scanners.json'), JSON.stringify({ scanners: [
      { id: 'typescript', source: path.resolve(import.meta.dir, '../plugins/scanners/typescript') },
      { id: 'react', source: artifact },
    ] }))
    const world = await loadAnnotatedArchitecture(root)
    const component = world.elements.find(element => element.kind === 'component')!
    const files = await readCodeStructure(root, world, null, component.representationId)

    // The component's Code lists this source under both scanners; only the TypeScript link names Profile.
    expect(files).toEqual(await scanner.readCodeStructure!(root, [{ file: 'profile.tsx', symbols: ['Profile'] }]))
    expect(files?.[0]?.declarations.find(declaration => declaration.name === 'Profile')?.entry).toBe(true)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})
