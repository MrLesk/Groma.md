import { expect, test } from 'bun:test'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { CodeSymbol, ScannerPlugin, ScanOperation } from '@groma/scanner'
import { buildPackage } from '../plugins/scanners/javascript/build.ts'
import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'
import { discoverScanners } from '../src/scanner/modules/discovery.ts'
import { addScanner } from '../src/scanner/modules/inventory.ts'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { loadScannerRegistry } from '../src/scanner/registry.ts'
import { compileWatchPatterns } from '../src/scanner/watch-patterns.ts'
import { editArchitecture } from '../src/edit.ts'
import { readCodeStructure } from '../src/viewers/source/structure.ts'
import javascript from '../plugins/scanners/javascript/src/index.ts'
import { readJavaScriptOutline } from '../plugins/scanners/javascript/src/outline.ts'

const fixtures = path.resolve(import.meta.dir, '../test/fixtures')

async function setup(fixture = 'javascript-source') {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-javascript-test-'))
  const root = path.join(temporary, 'project'), artifact = path.join(temporary, 'scanner')
  await cp(path.join(fixtures, 'empty-project'), root, { recursive: true })
  await cp(path.join(fixtures, fixture), root, { recursive: true })
  const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
  expect(await git.exited).toBe(0)
  await buildPackage(artifact)
  const scanner: ScannerPlugin = (await import(path.join(artifact, 'dist/index.js'))).default
  return { temporary, root, artifact, scanner }
}

test.concurrent('packaged JavaScript reads every module format without project tools and leaves other source out', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    expect((await discoverScanners(root)).recommendations.some(scanner => scanner.id === 'javascript')).toBe(true)
    await scanner.checkReadiness?.(root)
    const scan = (await scanner.scan(root))!
    expect(await scanner.scan(root)).toEqual(scan)
    // The minified bundle, the `.min.js` name and the TypeScript source next to them contribute nothing.
    expect(scan.files.map(file => file.file)).toEqual(['public/legacy.js', 'src/cart.mjs', 'src/panel.jsx', 'src/totals.cjs'])
    const declared = scan.files.flatMap(file => file.symbols.map(symbol => symbol.name))
    expect(declared).toEqual(expect.arrayContaining(['CartPanel', 'subtotal', 'removeItem']))
    const commonjs = await readFile(path.join(root, 'src/totals.cjs'), 'utf8')
    const subtotal = scan.operations!.find(operation => operation.name === 'subtotal')!
    expect(subtotal.position).toBe(commonjs.indexOf('function subtotal'))
    // Small named bodies still carry tokens: core, not the scanner, applies the minimum sizes.
    expect(subtotal.tokens?.length).toBeGreaterThan(0)
    const script = await readFile(path.join(root, 'public/legacy.js'), 'utf8')
    const callback = scan.operations!.find(operation => operation.position === script.indexOf('function (event)'))!
    expect(callback.tokens).toBeUndefined()
    const listen = scan.invocations!.find(call => call.member === 'addEventListener')!
    const owner = scan.operations!.find(operation => operation.id === listen.source)!
    // Top-level work belongs to the module itself, not to an invented function.
    expect(owner.file).toBe('public/legacy.js')
    expect(owner.tokens).toBeUndefined()
    expect(scan.invocations!.every(call => call.unresolved && call.targets.length === 0)).toBe(true)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('a JavaScript file that does not parse contributes no evidence while the rest of the scan proceeds', async () => {
  const { temporary, root, scanner } = await setup('javascript-invalid')
  try {
    const scan = (await scanner.scan(root))!
    // Parsing alone would recover and report the broken function as an ordinary operation.
    expect(scan.operations!.filter(operation => operation.file === 'src/broken.js')).toEqual([])
    expect(scan.files.find(file => file.file === 'src/broken.js')?.symbols).toEqual([])
    // A legacy octal literal and a type annotation leave the other file's evidence in place.
    expect(scan.operations!.some(operation => operation.file === 'src/valid.js')).toBe(true)
    const warnings = scan.diagnostics.filter(diagnostic => diagnostic.code === 'JAVASCRIPT_SOURCE_INVALID')
    expect(warnings).toEqual([expect.objectContaining({ severity: 'warning', file: 'src/broken.js', line: expect.any(Number) })])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('a JavaScript scan keeps one owner per file across a rescan of curated architecture', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const scan = (await scanner.scan(root))!
    await reconcileScanObservations(root, [scan])
    const before = await loadAnnotatedArchitecture(root)
    const component = before.elements.find(element => element.code.some(code => code.file === 'src/cart.mjs'))!
    await editArchitecture(root, { id: component.id, title: 'Cart editing' })
    const curated = await loadAnnotatedArchitecture(root)
    expect((await reconcileScanObservations(root, [scan])).created).toBe(0)
    expect(await loadAnnotatedArchitecture(root)).toEqual(curated)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('configured exclusions and watch patterns decide which JavaScript files reach the architecture', async () => {
  const { temporary, root, artifact, scanner } = await setup()
  try {
    await addScanner(root, artifact)
    const configFile = path.join(root, 'groma/scanners.json')
    const config = JSON.parse(await readFile(configFile, 'utf8'))
    await writeFile(configFile, JSON.stringify({ ...config, exclude: ['public/'] }))
    await writeFile(path.join(root, '.gitignore'), 'src/draft.js\n')
    await writeFile(path.join(root, 'src/draft.js'), 'export function draft() { return 1 }\n')
    const registry = await loadScannerRegistry(root)
    const batch = await registry.collectObservations(root)
    expect(batch.failures).toHaveLength(0)
    expect(batch.observations[0]!.files.map(file => file.file)).toEqual(['src/cart.mjs', 'src/panel.jsx', 'src/totals.cjs'])
    expect(registry.watchesFile('src/view.jsx')).toBe(true)
    const watches = compileWatchPatterns(scanner.watch)
    expect(['src/loader.mjs', 'tools/build.cjs'].every(watches)).toBe(true)
    expect(['public/jquery-ui.min.js', 'src/widget.min.jsx', 'src/app.ts', 'src/app.tsx'].some(watches)).toBe(false)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('one body carries the same tokens whether it is written in JavaScript or in TypeScript', async () => {
  const { temporary, root, scanner } = await setup('javascript-parity')
  try {
    const compared = (operations: ScanOperation[], file: string) => operations
      .filter(operation => operation.file === file && operation.tokens)
      .sort((left, right) => left.startLine! - right.startLine!)
    const javascript = compared((await scanner.scan(root))!.operations!, 'pick.js')
    const typescript = compared((await scanTypeScriptSource(root))!.operations!, 'pick.ts')
    // The bodies use postfix `++`, parentheses, `typeof`, `else`, an index and a constructor.
    expect(javascript.map(operation => operation.name)).toEqual(['pick', 'constructor'])
    // The two scanners tokenize with different compilers, so core can only compare bodies that agree.
    expect(javascript.map(operation => operation.tokens)).toEqual(typescript.map(operation => operation.tokens))
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('lint reports identical and near-duplicate JavaScript bodies but never callbacks or namesakes', async () => {
  const { temporary, root, artifact } = await setup('javascript-duplicates')
  try {
    await addScanner(root, artifact)
    const lint = Bun.spawn([process.execPath, path.resolve(import.meta.dir, '../src/cli.ts'), 'lint'],
      { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    const [code, out, error] = await Promise.all([lint.exited, new Response(lint.stdout).text(), new Response(lint.stderr).text()])
    expect(code, error).toBe(1)
    // Each finding starts on an unindented line; similar copies are marked as not identical.
    const findings = out.trim().split(/\n(?=\S)/).map(finding => ({
      at: [...finding.matchAll(/\S+\.js:\d+/g)].map(match => match[0]).sort(),
      identical: !finding.includes('not identical'),
    })).sort((left, right) => left.at[0]!.localeCompare(right.at[0]!))
    // Renamed locals leave the two selections identical, while the changed wording makes the renderers similar.
    // The handlers supplied as call arguments and the recursive functions calling their own names are absent.
    expect(findings).toEqual([
      { at: ['invoice.js:3', 'quote.js:3'], identical: false },
      { at: ['readiness.js:3', 'scheduling.js:3'], identical: true },
    ])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('a component outlines its JavaScript files with module, CommonJS and script visibility', async () => {
  const { temporary, root, artifact, scanner } = await setup('javascript-outline')
  try {
    await addScanner(root, artifact)
    const world = await loadAnnotatedArchitecture(root)
    const component = world.elements.find(element => element.kind === 'component')!
    // The fixture's Code symbols are names the scan reports, so entries follow the scan's naming.
    const scanned = (await scanner.scan(root))!.files.flatMap(file => file.symbols.map(symbol => symbol.name))
    const named = component.code.flatMap(reference => reference.symbol ? [reference.symbol] : [])
    expect(scanned).toEqual(expect.arrayContaining(named))
    const files = await readCodeStructure(root, world, null, component.representationId) ?? []
    expect(files.map(file => file.file)).toEqual([...new Set(component.code.map(reference => reference.file))])
    const symbol = ({ name, line, visibility, entry }: CodeSymbol) => [name, line, visibility, entry]
    const outline = files.map(file => file.declarations.map(declaration => [
      declaration.kind, ...symbol(declaration), declaration.kind === 'type' ? declaration.members.map(symbol) : [],
    ]))
    // The accessor, the fields and the nested helpers are absent. An unexported module declaration is
    // private, while a CommonJS export and a browser script's globals are public. A CommonJS file that
    // publishes a function value names no local declaration, so its own helpers stay private. A JSDoc
    // `@private` tag is documentation, so the member it describes stays public.
    expect(outline).toEqual([
      [
        ['function', 'placeOrder', 1, 'public', true, []],
        ['function', 'prepare', 5, 'private', false, []],
        ['type', 'OrderService', 7, 'public', true, [
          ['constructor', 8, 'public', false],
          ['submit', 13, 'public', false],
          ['#limit', 17, 'private', false],
          ['total', 21, 'public', false],
          ['audit', 26, 'public', false],
        ]],
      ],
      [
        ['function', 'subtotal', 1, 'public', true, []],
        ['function', 'weigh', 5, 'private', false, []],
      ],
      [
        ['function', 'formatOrder', 1, 'public', false, []],
        ['function', 'renderOrder', 5, 'public', false, []],
      ],
      [
        ['function', 'render', 1, 'private', false, []],
        ['function', 'format', 5, 'private', false, []],
      ],
    ])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('CommonJS publication and module use give declarations their real visibility', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-javascript-visibility-'))
  try {
    await writeFile(path.join(root, 'chain.cjs'), 'function create() {}\nexports = module.exports = create\n')
    await writeFile(path.join(root, 'require.js'), "const fs = require('node:fs')\nfunction helper() {}\n")
    await writeFile(path.join(root, 'class.cjs'), 'module.exports = class Application { constructor() {} use() {} }\n')
    expect(await Bun.spawn(['git', 'init', '--quiet', root]).exited).toBe(0)
    const scan = (await javascript.scan(root))!
    expect(scan.files.find(file => file.file === 'class.cjs')?.symbols.map(symbol => symbol.name)).toContain('Application')
    const files = await readJavaScriptOutline(root, ['chain.cjs', 'require.js', 'class.cjs'].map(file => ({ file, symbols: [] })))
    const declaration = (file: string) => files.find(item => item.file === file)!.declarations
    expect(declaration('chain.cjs')).toEqual([expect.objectContaining({ name: 'create', visibility: 'public' })])
    expect(declaration('require.js')).toEqual([expect.objectContaining({ name: 'helper', visibility: 'private' })])
    expect(declaration('class.cjs')).toEqual([expect.objectContaining({ kind: 'type', name: 'Application', visibility: 'public',
      members: [expect.objectContaining({ name: 'constructor' }), expect.objectContaining({ name: 'use' })] })])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('calls inside accessors belong to the accessor without entering duplicate comparison', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-javascript-accessor-'))
  try {
    const source = 'class Request { get url() { return formatUrl() } }\nfunction formatUrl() { return "/" }\n'
    await writeFile(path.join(root, 'request.js'), source)
    expect(await Bun.spawn(['git', 'init', '--quiet', root]).exited).toBe(0)
    const scan = (await javascript.scan(root))!
    const call = scan.invocations!.find(invocation => invocation.member === undefined)!
    const owner = scan.operations!.find(operation => operation.id === call.source)!
    expect(owner.position).toBe(source.indexOf('get url'))
    expect(owner.tokens).toBeUndefined()
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a leading comment does not hide a compact generated JavaScript body', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-javascript-compact-'))
  try {
    await writeFile(path.join(root, 'authored.js'), 'export function run() { return 1 }\n')
    await writeFile(path.join(root, 'compressed.js'), `/* generated source\n * kept as a tracked file\n */\n${'var a=1;'.repeat(60)}\n`)
    expect(await Bun.spawn(['git', 'init', '--quiet', root]).exited).toBe(0)
    expect((await javascript.scan(root))!.files.map(file => file.file)).toEqual(['authored.js'])
  } finally { await rm(root, { recursive: true, force: true }) }
})
