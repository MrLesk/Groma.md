import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import rustScanner, { scanRustSource } from '../plugins/scanners/rust/src/index.ts'

import { execute } from '../plugins/scanners/rust/src/project.ts'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { buildArchitectureModel } from '../src/architecture-model.ts'
import { scanRepository } from '../src/scanner.ts'
import { addScanner } from '../src/scanner/modules/inventory.ts'
import { readCodeStructure } from '../src/viewers/source/structure.ts'
import type { CodeSymbol, ScanObservation } from '@groma/scanner'

const worker = process.env.GROMA_TEST_RUST
const rustTest = worker ? test.concurrent : test.skip
const packagePath = path.resolve(import.meta.dir, '../plugins/scanners/rust/dist/package')
const cli = path.resolve(import.meta.dir, '../src/cli.ts')

async function fixture(name: string, action: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma rust '))
  try {
    await cp(path.resolve(import.meta.dir, '../test/fixtures', name), root, { recursive: true })
    await action(root)
  } finally { await rm(root, { recursive: true, force: true }) }
}

function evidence(observation: ScanObservation) {
  const operations = new Map(observation.operations!.map(operation => [operation.id, operation]))
  return observation.invocations!.map(call => ({
    ...call, caller: operations.get(call.source)!,
    providers: call.targets.map(id => operations.get(id)!),
  }))
}

rustTest('rust-analyzer owns alias and inherent method targets while unsupported dispatch stays uncertain', async () => {
  await fixture('rust-semantic', async root => {
    const first = await scanRustSource(root, {}, { worker })
    const manifest = first.roots.find(item => item.file === 'Cargo.toml')!
    expect(manifest).toBeDefined()
    expect(first.files.every(file => file.roots.includes(manifest.id))).toBeTrue()
    expect(await scanRustSource(root, {}, { worker })).toEqual(first)
    expect(first.files.map(file => file.file)).not.toContain('src/unreferenced.rs')
    const calls = evidence(first)
    const alias = calls.find(call => call.caller.name === 'entry')!
    expect(alias.providers.map(provider => provider.file)).toEqual(['src/provider.rs'])
    expect(alias.unresolved).toBeFalse()
    expect(calls.find(call => call.caller.name === 'through_method')!.unresolved).toBeFalse()
    const chained = calls.filter(call => call.caller.name === 'chained')
    expect(chained.flatMap(call => call.providers.map(provider => provider.name)).sort()).toEqual(['create', 'work'])
    expect(new Set(chained.map(call => call.position)).size).toBe(1)
    for (const name of ['dynamic', 'callback']) {
      expect(calls.find(call => call.caller.name === name)).toMatchObject({ providers: [], unresolved: true })
    }
    expect(calls.some(call => call.caller.name === 'later')).toBeFalse()
    expect(first.operations!.every(operation => Number.isInteger(operation.position))).toBeTrue()
  })
}, 60000)

rustTest('wildcard import of a local module never resolves to the dependency with the same name', async () => {
  await fixture('rust-collision', async root => {
    const observation = await scanRustSource(root, {}, { worker })
    const call = evidence(observation).find(call => call.caller.name === 'main')!
    expect(call.unresolved).toBeFalse()
    expect(call.providers.map(provider => provider.file)).toEqual(['app/src/local.rs'])
  })
}, 60000)

rustTest('shared compilation source has one identity and no guessed provider from either context', async () => {
  await fixture('rust-shared', async root => {
    const observation = await scanRustSource(root, {}, { worker })
    expect(observation.files.filter(file => file.file === 'src/shared.rs')).toHaveLength(1)
    expect(observation.files.find(file => file.file === 'src/shared.rs')?.roots).toHaveLength(1)
    expect(observation.operations!.some(operation => operation.file === 'src/shared.rs')).toBeFalse()
    expect(observation.diagnostics.some(diagnostic => diagnostic.code === 'rust-unsupported-compilation-contexts')).toBeTrue()
    expect(observation.roots).toHaveLength(1)
    expect(await scanRustSource(root, {}, { worker })).toEqual(observation)
  })
}, 60000)

rustTest('lint finds identical and near-duplicate Rust functions but never closures or constant initializers', async () => {
  await fixture('rust-duplicates', async root => {
    // Every function body carries tokens; core, not the scanner, skips small bodies.
    const observation = await scanRustSource(root, {}, { worker })
    expect(observation.operations!.every(operation => operation.tokens!.length > 0)).toBeTrue()
    await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
    await execute('git', ['init', '--quiet'], { cwd: root })
    await addScanner(root, packagePath)
    const lint = Bun.spawn([process.execPath, cli, 'lint'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    const [code, out, error] = await Promise.all([lint.exited, new Response(lint.stdout).text(), new Response(lint.stderr).text()])
    expect(code, error).toBe(1)
    // Each finding starts on an unindented line; similar copies are marked as not identical.
    const findings = out.trim().split(/\n(?=\S)/).map(finding => ({
      at: [...finding.matchAll(/\S+\.rs:\d+/g)].map(match => match[0]).sort(),
      identical: !finding.includes('not identical'),
    }))
    // Renamed locals match exactly, also in an associated function, in macro ranges, and in a macro
    // argument where a same-named binding is not visible: after an inner block, in an if-let else
    // branch, in a let-else block and in the binding's own initializer. Swapped enum arms, tiny
    // copies, closures and arithmetic that differs only in grouping, also inside a macro, are absent.
    expect(findings).toEqual([
      { at: ['src/formulas.rs:15', 'src/formulas.rs:24'], identical: true },
      { at: ['src/formulas.rs:43', 'src/formulas.rs:52'], identical: true },
      { at: ['src/formulas.rs:61', 'src/formulas.rs:69'], identical: true },
      { at: ['src/formulas.rs:77', 'src/formulas.rs:82'], identical: true },
      { at: ['src/invoice.rs:3', 'src/quote.rs:3'], identical: false },
      { at: ['src/labels.rs:1', 'src/labels.rs:6'], identical: true },
      { at: ['src/readiness.rs:3', 'src/scheduling.rs:6'], identical: true },
    ])
  })
}, 60000)

rustTest('a component outlines its Rust file beside a TypeScript file under the Rust visibility rules', async () => {
  await fixture('rust-outline', async root => {
    await addScanner(root, packagePath)
    await addScanner(root, path.resolve(import.meta.dir, '../plugins/scanners/typescript'))
    const world = await loadAnnotatedArchitecture(root)
    const component = world.elements.find(element => element.kind === 'component')!
    const files = await readCodeStructure(root, world, null, component.representationId) ?? []
    expect(files.map(file => file.file)).toEqual([...new Set(component.code.map(reference => reference.file))])
    const symbol = ({ name, line, visibility, entry }: CodeSymbol) => [name, line, visibility, entry]
    const rust = files.find(file => file.file.endsWith('.rs'))!.declarations.map(declaration => [
      declaration.kind, ...symbol(declaration), declaration.kind === 'type' ? declaration.members.map(symbol) : [],
    ])
    // Nested fns, plain constants, aliases, associated constants, blanket impls, macro bodies and
    // cfg(test) items are absent. Inline modules are transparent. Code links name place_order and load.
    expect(rust).toEqual([
      ['function', 'place_order', 3, 'public', true, []],
      ['function', 'audit', 10, 'private', false, []],
      ['function', 'ship', 12, 'internal', false, []],
      ['function', 'notify', 14, 'internal', false, []],
      ['function', 'hide', 16, 'private', false, []],
      ['function', 'ON_PLACED', 18, 'public', false, []],
      ['type', 'Order', 23, 'public', false, [
        ['new', 28, 'public', false],
        ['load', 32, 'private', true],
        ['refresh', 36, 'internal', false],
        ['save', 48, 'public', false],
      ]],
      ['type', 'Store', 39, 'internal', false, [['save', 40, 'internal', false], ['count', 42, 'internal', false]]],
      ['type', 'Status', 51, 'private', false, [['is_open', 59, 'public', false]]],
      ['type', 'Bits', 64, 'public', false, []],
      ['function', 'purge', 70, 'public', false, []],
      ['type', 'Report', 72, 'private', false, []],
      // Declared in another file: one public entry at the first impl block.
      ['type', 'Invoice', 75, 'public', false, [['total', 76, 'public', false], ['discount', 98, 'private', false]]],
      // Its impl block comes first; members still join the declaration.
      ['type', 'Printer', 89, 'private', false, [['print', 86, 'private', false]]],
    ])
  })
}, 60000)

rustTest('a Rust impl joins the type its module path names, and only code that cannot build outside tests is left out', async () => {
  await fixture('rust-outline', async root => {
    const [file] = await rustScanner.readCodeStructure(root, [{ file: 'src/scopes.rs', symbols: [] }])
    expect(file!.declarations.map(declaration => [
      declaration.name, declaration.line, declaration.kind === 'type' ? declaration.members.map(member => member.name) : [],
    ])).toEqual([
      ['Item', 2, ['from_a', 'explicit']],
      ['Item', 10, ['from_b', 'from_inner', 'from_super']],
      // Types declared elsewhere stay apart by their written path.
      ['Remote', 33, ['left']],
      ['Remote', 37, ['right']],
      ['Widget', 41, ['draw']],
      ['Shape', 50, ['area']],
      ['run', 58, []],
      ['tool', 61, []],
      // Declared once per cfg condition, listed once.
      ['Handle', 67, ['open']],
      // A self step does not make another type.
      ['Ext', 76, ['plain', 'stepped']],
    ])
  })
}, 60000)

/** One fact as `file name METHOD /path`, with the request's configuration base marked. */
function segments(path: { kind: string; name?: string; value?: string }[]): string {
  return path.map(segment => {
    if (segment.kind === 'literal') return segment.value
    if (segment.kind === 'parameter') return `:${segment.name}`
    if (segment.kind === 'catch-all') return `*${segment.name}`
    return segment.kind
  }).join('/')
}

rustTest('Rust HTTP facts cover axum, actix-web and Rocket endpoints, reqwest requests and the unresolved cases', async () => {
  await fixture('rust-http', async root => {
    const observation = await scanRustSource(root, {}, { worker })
    const operations = new Map(observation.operations!.map(operation => [operation.id, operation]))
    const where = (id: string) => {
      const operation = operations.get(id)!
      return `${operation.file.replace('src/', '')} ${operation.name}`
    }
    // The nested router, the scope, the service configuration and the mount supply every prefix.
    // A non-literal route or prefix and a handler nobody registers are absent.
    expect(observation.httpEndpoints!.map(fact => `${where(fact.operation)} ${fact.method} /${segments(fact.path)}`).sort()).toEqual([
      'actix_routes.rs create POST /api/sessions',
      'actix_routes.rs list GET /api/sessions',
      'actix_routes.rs show GET /api/sessions/:id',
      'actix_routes.rs stats GET /stats',
      'axum_routes.rs create_talk POST /api/talks',
      'axum_routes.rs health GET /health',
      'axum_routes.rs list_talks GET /api/talks',
      'axum_routes.rs proxy * /admin/*path',
      'axum_routes.rs show_talk GET /api/talks/:id',
      'rocket_routes.rs detail GET /v1/speakers/:id',
      'rocket_routes.rs index GET /v1/speakers',
      'rocket_routes.rs upload POST /v1/speakers/:id/photos/*rest',
    ])
    // A constant resolves to its text, one computed segment is dynamic, partly known text and a
    // host are unknown, and a setting sets configured. A map lookup is not a request, not even
    // as an argument inside a chain that sends one.
    expect(observation.httpRequests!.map(fact => {
      return `${where(fact.operation)} ${fact.method} /${segments(fact.path)}${fact.configured ? ' configured' : ''}`
    }).sort()).toEqual([
      'client.rs built PUT /api/talks/42',
      'client.rs create_talk POST /api/talks',
      'client.rs external GET /unknown/talks',
      'client.rs forwarded POST /api/talks',
      'client.rs list_talks GET /api/talks',
      'client.rs partial GET /api/talks/unknown',
      'client.rs remove_talk DELETE /api/talks/dynamic',
      'client.rs show_talk GET /api/talks/dynamic',
      'client.rs speakers GET /speakers configured',
      'client.rs through_helper GET /unknown',
    ])
  })
}, 60000)

rustTest('a Rust scan derives HTTP rows from the requesting file to the file that serves the endpoints', async () => {
  await fixture('rust-http', async root => {
    await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
    await execute('git', ['init', '--quiet'], { cwd: root })
    await addScanner(root, packagePath)
    await scanRepository(root)
    const world = await loadAnnotatedArchitecture(root)
    const files = (id: string) => world.elements.find(element => element.id === id)!.code.map(code => code.file)
    const rows = world.relationships.filter(row => row.description?.startsWith('Calls HTTP endpoint'))
    expect(rows.map(row => `${files(row.source)} -> ${files(row.target)}: ${row.description}`).sort()).toEqual([
      // The configured base tolerates the one leading segment only the server states.
      'src/client.rs -> src/rocket_routes.rs: Calls HTTP endpoint: GET /v1/speakers',
      'src/client.rs -> src/axum_routes.rs: Calls HTTP endpoints: GET /api/talks, GET /api/talks/:id, POST /api/talks',
    ].sort())
  })
}, 60000)

rustTest('registered Rust scans preserve curated ownership and a failed scan preserves the prior architecture', async () => {
  await fixture('rust-semantic', async root => {
    await execute('git', ['init', '--quiet'], { cwd: root })
    await execute('git', ['add', '-A'], { cwd: root })
    await addScanner(root, packagePath)
    await scanRepository(root)
    const world = await loadAnnotatedArchitecture(root)
    const provider = world.elements.find(element => element.code.some(code => code.file === 'src/provider.rs'))!
    const api = world.elements.find(element => element.code.some(code => code.file === 'src/api.rs'))!
    await execute(process.execPath, [cli, 'edit', provider.id, '--combine', api.id], { cwd: root })
    await execute(process.execPath, [cli, 'edit', provider.id, '--overview', 'Owns execution.'], { cwd: root })
    await scanRepository(root)
    const architecture = async () => buildArchitectureModel((await loadArchitecture(root)).documents)
    const before = await architecture()
    await scanRepository(root)
    expect(await architecture()).toEqual(before)
    const curated = (await loadAnnotatedArchitecture(root)).elements.find(element => element.id === provider.id)!
    expect(curated.code.map(code => code.file).sort()).toEqual(['src/api.rs', 'src/provider.rs'])
    await writeFile(path.join(root, 'src/provider.rs'), 'pub fn broken(')
    expect((await scanRepository(root)).scannerFailures?.map(error => error.scanner)).toEqual(['rust'])
    expect(await architecture()).toEqual(before)
  })
}, 60000)
