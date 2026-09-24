import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildWorker } from '../plugins/scanners/go/build.ts'
import { readGoCodeStructure, run, scanGoSource } from '../plugins/scanners/go/src/adapter.ts'
import plugin from '../plugins/scanners/go/src/index.ts'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { readScannerConfig, writeScannerConfig } from '../src/scanner/modules/config.ts'
import { addScanner } from '../src/scanner/modules/inventory.ts'
import { readCodeStructure } from '../src/viewers/source/structure.ts'

import type { CodeType, ScanObservation } from '@groma/scanner'

const go = process.env.GROMA_TEST_GO
const goTest = go ? test.concurrent : test.skip
const fixtures = path.resolve(import.meta.dir, '../test/fixtures')

/** A Git working tree, because the scanner reads the tracked and unignored files, as the go command would. */
async function fixture(name = 'go-module') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-go-test-'))
  await cp(path.join(fixtures, name), root, { recursive: true })
  expect(await Bun.spawn(['git', 'init', '--quiet', root]).exited).toBe(0)
  return { root, worker: path.join(root, process.platform === 'win32' ? 'worker.exe' : 'worker') }
}

function lineOf(source: string, text: string): number {
  // A Windows checkout may end lines with CRLF, which does not change line numbers.
  const lines = source.replaceAll('\r\n', '\n')
  return lines.slice(0, lines.indexOf(text)).split('\n').length
}

function calls(observation: ScanObservation) {
  const operations = new Map(observation.operations!.map(operation => [operation.id, operation]))
  return observation.invocations!.map(call => ({
    ...call, caller: operations.get(call.source)!,
    providers: call.targets.map(id => operations.get(id)!),
  }))
}

goTest('Go resolves imported functions and concrete methods while preserving wrapper and closure ownership', async () => {
  const { root, worker } = await fixture()
  try {
    await buildWorker(worker, go)
    const options = { worker }
    const first = await scanGoSource(root, options)
    expect(await scanGoSource(root, options)).toEqual(first)
    const source = await readFile(path.join(root, 'caller.go'), 'utf8')
    const evidence = calls(first)
    const at = (text: string) => evidence.find(call => call.position === source.indexOf(text))!
    expect(at('worker.Work()').providers).toEqual([
      expect.objectContaining({ file: 'provider/provider.go', name: '(*example.test/dispatch/provider.Worker).Work' }),
    ])
    expect(at('port.Work()')).toMatchObject({ targets: [], unresolved: true })
    expect(at('actions.Apply()')).toMatchObject({ targets: [], unresolved: true })
    // The call before the closing brace, in either line ending.
    expect(at(source.match(/Wrap\(\)\r?\n}/)![0]).providers[0]!.position).toBe(source.indexOf('func Wrap'))
    expect(at('alias.Build() }()').caller.name).toBe('closure')
    expect(at('alias.Build() }()').caller.position).toBe(source.indexOf('func() {'))
    expect(at('worker.Work()').caller.position).toBe(source.indexOf('func Run'))
    expect(first.invocations!.every(call => call.binding === undefined)).toBeTrue()
    expect(new Set(first.files.map(file => file.file)).size).toBe(first.files.length)
    const byId = new Map(first.roots.map(root => [root.id, root]))
    expect(first.files.every(file => file.roots.every(id => byId.get(id)?.kind === 'package'))).toBeTrue()
    expect(first.roots.filter(root => root.parent).every(root => byId.get(root.parent!)?.kind === 'module')).toBeTrue()
    await writeFile(path.join(root, 'caller.go'), source.replaceAll('alias', 'renamed'))
    const renamed = calls(await scanGoSource(root, options))
    expect(renamed.filter(call => call.member === 'Build').map(call => call.targets))
      .toEqual(evidence.filter(call => call.member === 'Build').map(call => call.targets))
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)

goTest('Go scans source without its dependencies and fails only on invalid syntax', async () => {
  const { root, worker } = await fixture()
  try {
    await buildWorker(worker, go)
    await writeFile(path.join(root, 'caller.go'), 'package dispatch\nimport "example.org/absent"\nfunc Broken() { absent.Call() }\n')
    const observation = await scanGoSource(root, { worker })
    expect(observation.invocations).toEqual([expect.objectContaining({ targets: [], unresolved: true })])
    // Type errors follow from what the scan does not load, so they are one summary located by file and line.
    expect(observation.diagnostics.filter(item => item.code !== 'GO_ANALYSIS_SCOPE'))
      .toEqual([expect.objectContaining({ code: 'GO_MISSING_EXTERNAL_PACKAGES', file: 'caller.go', line: 2 })])
    expect(JSON.stringify(observation.diagnostics)).not.toContain(root)
    // Source that does not type-check, such as a redeclared function, still scans; invalid syntax does not.
    await writeFile(path.join(root, 'caller.go'), 'package dispatch\nfunc Broken() {}\nfunc Broken() {}\n')
    expect((await scanGoSource(root, { worker })).files.map(file => file.file)).toContain('caller.go')
    await writeFile(path.join(root, 'caller.go'), 'package dispatch\nfunc Broken( {\n')
    await expect(scanGoSource(root, { worker })).rejects.toThrow()
    // A module whose files all sit behind build constraints, such as a tools module, adds no evidence.
    await rm(path.join(root, 'provider'), { recursive: true })
    await writeFile(path.join(root, 'caller.go'), '//go:build tools\n\npackage dispatch\n')
    expect((await scanGoSource(root, { worker })).files).toEqual([])
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)

goTest('Go scans every machine alike, in one linux/amd64 build context with cgo', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-go-test-'))
  const worker = path.join(root, process.platform === 'win32' ? 'worker.exe' : 'worker')
  try {
    await buildWorker(worker, go)
    await writeFile(path.join(root, 'go.mod'), 'module example.test/mode\n\ngo 1.22\n')
    await writeFile(path.join(root, 'cgo.go'), 'package mode\n\nimport "C"\n\nfunc Mode() string { return "cgo" }\n')
    await writeFile(path.join(root, 'plain.go'), '//go:build !cgo\n\npackage mode\n\nfunc Mode() string { return "plain" }\n')
    await writeFile(path.join(root, 'mode_linux.go'), 'package mode\n\nfunc System() string { return "linux" }\n')
    await writeFile(path.join(root, 'mode_windows.go'), 'package mode\n\nfunc System() string { return "windows" }\n')
    // The build environment, like the host platform, does not change what a scan reads.
    const output = await run(worker, [root], root, {
      env: { ...process.env, GOOS: 'windows', GOARCH: 'arm64', CGO_ENABLED: '0' },
      input: JSON.stringify(['cgo.go', 'mode_linux.go', 'mode_windows.go', 'plain.go']),
    })
    expect((JSON.parse(output) as ScanObservation).files.map(file => file.file)).toEqual(['cgo.go', 'mode_linux.go'])
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)

goTest('Go reads and lists the tracked, unignored files the go command reads', async () => {
  const { root, worker } = await fixture()
  try {
    await buildWorker(worker, go)
    const files: Record<string, string> = {
      'build/output.go': 'package build\n', 'generated/api.go': 'package generated\n',
      '_examples/demo.go': 'package main\nfunc main() {}\n', '.hidden/hidden.go': 'package hidden\n',
      'testdata/case.go': 'package fixture\n', 'ignored/local.go': 'package ignored\n', '.gitignore': 'ignored/\n',
      'tools/go.mod': 'module example.test/tools\n\ngo 1.22\n', 'tools/tools.go': 'package tools\n',
    }
    for (const [file, text] of Object.entries(files)) {
      await mkdir(path.join(root, path.dirname(file)), { recursive: true })
      await writeFile(path.join(root, file), text)
    }
    const listed = await plugin.listSourceFiles!(root, {})
    // Build and generated folders hold source; ignored, underscore, dot and testdata paths do not.
    expect(listed).toEqual(['build/output.go', 'caller.go', 'generated/api.go', 'provider/provider.go', 'tools/tools.go'])
    // Each module scans on its own, and together they read exactly what the listing names.
    expect((await plugin.scan(root, { worker }))!.files.map(file => file.file).sort()).toEqual(listed)
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)

goTest('Go attaches source ranges and binding-normalized tokens only to named operations', async () => {
  const { root, worker } = await fixture('go-duplicates')
  try {
    await buildWorker(worker, go)
    const operations = (await scanGoSource(root, { worker })).operations!
    const named = (name: string) => operations.find(operation => operation.name.endsWith(name))!
    // Anonymous literals, including fields of a literal passed as a call argument in or out of parentheses,
    // blank functions, generated code and initializer code.
    expect(operations.filter(operation => !operation.tokens).map(operation => operation.name).sort())
      .toEqual(['closure', 'closure', 'closure', 'closure', 'closure', 'example.test/duplicates.Generated',
        'example.test/duplicates._', 'example.test/duplicates.init', 'initializer'])
    // Literals assigned to a variable or keyed in a literal that is not an argument take that name.
    expect(operations.filter(operation => operation.tokens).map(operation => operation.name))
      .toEqual(expect.arrayContaining(['validate', 'normalize', 'Start', 'stop']))
    const source = await readFile(path.join(root, 'forms.go'), 'utf8')
    expect(named('.Install')).toMatchObject({
      startLine: lineOf(source, 'func (hooks *Hooks) Install'), endLine: lineOf(source, '}\n\nfunc Apply'),
    })
    // Size is left to core, so an empty named body still reports its range.
    expect(named('.Apply').tokens).toEqual([])
    // Renamed parameters, named results, range and type switch variables produce the same tokens.
    expect(named('.Names').tokens).toEqual(named('.Labels').tokens!)
    // Package-level names, including the operation's own name, and slice bounds keep bodies apart.
    expect(named('.Factorial').tokens).not.toEqual(named('.Fact').tokens!)
    expect(named('.Tail').tokens).not.toEqual(named('.Head').tokens!)
    // Grouping parentheses change evaluation order.
    expect(named('.Scaled').tokens).not.toEqual(named('.Offset').tokens!)
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)

goTest('groma lint reports identical and near-duplicate Go bodies across renamed local names', async () => {
  const { root, worker } = await fixture('go-duplicates')
  try {
    await cp(path.join(fixtures, 'empty-project'), root, { recursive: true })
    await buildWorker(worker, go)
    const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
    expect(await git.exited).toBe(0)
    await addScanner(root, path.resolve(import.meta.dir, '../plugins/scanners/go'))
    const config = await readScannerConfig(root)
    await writeScannerConfig(root, { ...config, scanners: config.scanners.map(scanner => ({ ...scanner, settings: { worker } })) })
    const lint = Bun.spawn([process.execPath, path.resolve(import.meta.dir, '../src/cli.ts'), 'lint'],
      { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    const [code, out, error] = await Promise.all([lint.exited, new Response(lint.stdout).text(), new Response(lint.stderr).text()])
    expect(code, error).toBe(1)
    const findings = out.split(/\n(?=\S)/).map(block => ({
      locations: [...block.matchAll(/\S+\.go:\d+/g)].map(match => match[0]).sort(),
      similar: block.includes('not identical'),
    }))
    const ready = await readFile(path.join(root, 'ready.go'), 'utf8')
    const copy = await readFile(path.join(root, 'copy.go'), 'utf8')
    expect(findings).toContainEqual({
      locations: [`copy.go:${lineOf(copy, 'func ReadyToRun')}`, `ready.go:${lineOf(ready, 'func CanStart')}`], similar: false,
    })
    expect(findings).toContainEqual({
      locations: [`copy.go:${lineOf(copy, 'func Completion')}`, `ready.go:${lineOf(ready, 'func Progress')}`], similar: true,
    })
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)

goTest('Go outlines defined types with their receiver methods and top-level functions', async () => {
  const { root, worker } = await fixture('go-outline')
  try {
    await buildWorker(worker, go)
    const [file] = await readGoCodeStructure(root, [{ file: 'store.go', symbols: ['NewStore'] }], { worker })
    const summary = file!.declarations.map(declaration => [
      declaration.kind,
      declaration.name,
      declaration.visibility,
      declaration.kind === 'type' ? declaration.members.map(member => [member.name, member.visibility]) : [],
    ])
    // Aliases, wrapped function values and blank functions or methods are not listed.
    expect(summary).toEqual([
      ['type', 'Store', 'public', [['Close', 'public'], ['Read', 'public']]],
      ['type', 'Reader', 'public', [['Read', 'public'], ['Close', 'public']]],
      ['type', 'Count', 'public', []],
      ['type', 'Pair', 'public', [['first', 'internal']]],
      ['function', 'Normalize', 'public', []],
      ['function', 'NewStore', 'public', []],
      ['type', 'remote', 'internal', [['fetch', 'internal']]],
      ['function', 'decorate', 'internal', []],
    ])
    const source = await readFile(path.join(root, 'store.go'), 'utf8')
    const declared = (name: string) => file!.declarations.find(declaration => declaration.name === name)!
    // A type declared in this file keeps its declaration; one declared elsewhere sits at its first method.
    expect(declared('Store').line).toBe(lineOf(source, 'type Store'))
    expect(declared('remote').line).toBe(lineOf(source, 'func (r remote)'))
    const store = file!.declarations.find((declaration): declaration is CodeType => declaration.name === 'Store')!
    expect(store.members[0]!.line).toBe(lineOf(source, 'func (s *Store) Close'))
    expect(file!.declarations.filter(declaration => declaration.entry).map(declaration => declaration.name)).toEqual(['NewStore'])
    // A link names a method, never an interface signature that shares its name.
    const [linked] = await readGoCodeStructure(root, [{ file: 'store.go', symbols: ['Close'] }], { worker })
    expect(linked!.declarations.flatMap(declaration => declaration.kind === 'type'
      ? declaration.members.filter(member => member.entry).map(member => `${declaration.name}.${member.name}`) : []))
      .toEqual(['Store.Close'])
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)

goTest('a component with Go and TypeScript files outlines every file in Code order', async () => {
  const { root, worker } = await fixture('go-outline')
  try {
    await buildWorker(worker, go)
    await addScanner(root, path.resolve(import.meta.dir, '../plugins/scanners/go'))
    await addScanner(root, path.resolve(import.meta.dir, '../plugins/scanners/typescript'))
    const config = await readScannerConfig(root)
    await writeScannerConfig(root, {
      ...config, scanners: config.scanners.map(scanner => scanner.id === 'go' ? { ...scanner, settings: { worker } } : scanner),
    })
    const world = await loadAnnotatedArchitecture(root)
    const component = world.elements.find(element => element.kind === 'component')!
    const files = await readCodeStructure(root, world, null, component.representationId) ?? []
    expect(files.map(file => file.file)).toEqual(component.code.map(reference => reference.file))
    expect(files.every(file => file.declarations.length > 0)).toBeTrue()
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)

/**
 * `:name` is a parameter, `:name+` a catch-all, `:name*` an optional one and a trailing `!` a constrained one;
 * `{}` is a dynamic segment and `?` unknown text.
 */
function httpPath(path: { kind: string; value?: string; name?: string; optional?: boolean; constrained?: boolean }[]): string {
  return `/${path.map(segment => {
    if (segment.kind === 'literal') return segment.value
    if (segment.kind === 'dynamic') return '{}'
    if (segment.kind === 'unknown') return '?'
    const constrained = segment.constrained ? '!' : ''
    if (segment.kind === 'catch-all') return `:${segment.name}${segment.optional ? '*' : '+'}${constrained}`
    return `:${segment.name}${constrained}`
  }).join('/')}`
}

function httpFacts(observation: ScanObservation) {
  const files = new Map(observation.operations!.map(operation => [operation.id, operation.file]))
  return {
    endpoints: observation.httpEndpoints!
      .map(fact => `${files.get(fact.operation)} ${fact.method} ${httpPath(fact.path)}${fact.order ? ` @${fact.order.application}:${fact.order.position}` : ''}`)
      .sort(),
    requests: observation.httpRequests!
      .map(fact => `${fact.method ?? '-'} ${fact.configured ? '<base>' : ''}${httpPath(fact.path)}`).sort(),
  }
}

goTest('Go reports HTTP endpoints from every supported router with their group prefixes', async () => {
  const { root, worker } = await fixture('go-http')
  try {
    await buildWorker(worker, go)
    const { endpoints } = httpFacts(await scanGoSource(root, { worker }))
    // Each endpoint names the operation that answers it, so a handler in another file owns the fact.
    // Only a catch-all at the root serves an empty remainder. A chi regular expression and text beside
    // a parameter in one segment constrain it; a chi regular expression that may match a slash stands
    // for the rest of the route only when other text follows it in its segment. A chi pattern and a
    // net/http method constant state the method. A chi Mount carries every prefix of its receiver, and names read the
    // same whichever file assigns, builds or mounts them. A router of a root-only type serves from the root
    // even as a parameter. Nothing is reported for a group parameter, a reassigned router or
    // group closure parameter, a ServeMux field assigned from a call, a router built for a mount
    // elsewhere, mounted on a router this scan cannot read, mounted twice or inside itself, a mounted
    // router that is not chi, or one behind http.StripPrefix. A first-match router's facts carry its
    // order. Each fixture file explains its library's own rules.
    expect(endpoints).toEqual([
      'echo.go DELETE /v2/talks/:id',
      'echo.go GET /files/:path+',
      'echo.go GET /paramtalks',
      'echo.go PATCH /api/talks/:id',
      'echo.go POST /api/talks',
      'gin.go * /api/health',
      'gin.go DELETE /talks/:id',
      'gin.go GET /api/talks/:id',
      'gin.go GET /api/versions/:version!',
      'gin.go GET /files/:filepath+',
      'gin.go POST /paramtalks',
      'handlers.go * /:path*',
      'handlers.go * /files/:path+',
      'handlers.go * /health',
      'handlers.go GET /admin/v2/reviews',
      'handlers.go GET /api/codes/:code!',
      'handlers.go GET /api/exports/:id!',
      'handlers.go GET /api/files/:path+',
      'handlers.go GET /api/raws/:path!/raw',
      'handlers.go GET /api/reports/:path*!',
      'handlers.go GET /api/talks',
      'handlers.go GET /api/talks/:id!',
      'handlers.go GET /api/v1/speakers',
      'handlers.go GET /closure/v3/closuretalks',
      'handlers.go GET /earlytalks',
      'handlers.go GET /health',
      'handlers.go GET /root/mountedtalks',
      'handlers.go GET /talks',
      'handlers.go GET /talks/:id',
      'handlers.go GET /version',
      'handlers.go POST /api/items/:id',
      'handlers.go POST /talks',
      'handlers.go PUT /api/talks',
      'httprouter.go DELETE /speakers/:id',
      'httprouter.go GET /assets/:filepath+',
      'httprouter.go GET /parameterspeakers',
      'httprouter.go GET /rooms/:number!',
      'httprouter.go GET /speakers/:id',
      'httprouter.go GET /speakers/:id/photo',
      'httprouter.go POST /speakers',
      'httprouter.go PUT /speakers/:id',
      'prometheus.go DELETE /api/v1/series',
      'prometheus.go GET /-/healthy',
      'prometheus.go GET /api/v1/query',
      'prometheus.go POST /api/v1/admin/tsdb/snapshot',
      'gorilla.go * /:path*! @gorilla.go:0',
      'gorilla.go * /:path*! @gorilla.go:0',
      'gorilla.go * /archive/:rest*! @gorilla.go:0',
      'gorilla.go * /kept/:path*! @gorilla.go:0',
      'gorilla.go * /reviews/:id! @gorilla.go:0',
      'gorilla.go * /search/:path*! @gorilla.go:0',
      'gorilla.go * /speakers/:path*! @gorilla.go:0',
      'gorilla.go GET /api/scores/:id @gorilla.go:0',
      'gorilla.go GET /reviews @gorilla.go:0',
      'gorilla.go GET /reviews/:id! @gorilla.go:0',
      'gorilla.go POST /reviews @gorilla.go:0',
      'gorilla.go PUT /reviews @gorilla.go:0',
    ].sort())
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)

goTest('Go reports what each net/http request proves and leaves the rest unknown', async () => {
  const { root, worker } = await fixture('go-http')
  try {
    await buildWorker(worker, go)
    const { requests } = httpFacts(await scanGoSource(root, { worker }))
    // A formatted value fills one segment, a percent stays literal text and an unproven method is omitted.
    // A setting, a field or a flag before a path is a configured base. A literal host, an unresolved value,
    // partly known text, a local variable, a parameter and text that continues a setting's last segment
    // cannot be compared. A package variable is the one value the source assigns it, in its package or
    // another, even when that value reads the variable itself; one assigned more than once, from a call
    // that returns several values, or through a pointer is unknown. Text written in pieces is read as the
    // URL it spells.
    expect(requests).toEqual([
      '- /talks',
      'GET /?',
      'GET /?/configtalks',
      'GET /?/formattedtalks',
      'GET /?/inittalks',
      'GET /?/joinedtalks',
      'GET /?/localtalks',
      'GET /?/mirrortalks',
      'GET /?/outsidetalks',
      'GET /?/paramtalks',
      'GET /?/porttalks',
      'GET /?/scannedtalks',
      'GET /?/schemetalks',
      'GET /?/talks',
      'GET /?/tupletalks',
      'GET /?/v2/growntalks',
      'GET /?/hosttalks',
      'GET /api/talks/{}',
      'GET /api/v1/pathtalks',
      'GET /health',
      'GET /rate/100%',
      'GET /talks/?',
      'HEAD /health',
      'GET <base>/defaulttalks',
      'GET <base>/flagtalks',
      'GET <base>/settingtalks',
      'GET <base>/talks',
      'POST <base>/talks',
      'PUT /talks/7',
    ].sort())
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)
