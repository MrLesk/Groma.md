import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildPackage } from '../plugins/scanners/python/build.ts'
import type { CodeSymbol, HttpEndpointSegment, HttpRequestSegment, ScanHttpEndpoint, ScannerPlugin } from '@groma/scanner'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { httpRelationships } from '../src/http-relationships.ts'
import { addScanner } from '../src/scanner/modules/inventory.ts'
import { readScannerConfig, writeScannerConfig } from '../src/scanner/modules/config.ts'
import { scannerFiles } from '../src/scanner/modules/selection.ts'
import { loadScannerRegistry } from '../src/scanner/registry.ts'
import { readCodeStructure } from '../src/viewers/source/structure.ts'
import manifest from '../plugins/scanners/python/package.json'

const fixtures = path.resolve(import.meta.dir, '../test/fixtures')
const cli = path.resolve(import.meta.dir, '../src/cli.ts')

/** The files Groma hands the scanner: those its package's include list names, less its default exclusions. */
const pythonFiles = (root: string) => scannerFiles(root, manifest.groma.scanner)

async function fixture(name = 'python-project') {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-python-test-'))
  const root = path.join(temporary, 'project')
  const artifact = path.join(temporary, 'scanner')
  await buildPackage(artifact)
  const scanner: ScannerPlugin = (await import(path.join(artifact, 'src/index.js'))).default
  await cp(path.join(fixtures, name), root, { recursive: true })
  for (const file of await readdir(root, { recursive: true })) {
    if (file.endsWith('.fixture')) await rename(path.join(root, file), path.join(root, file.slice(0, -'.fixture'.length)))
  }
  const git = Bun.spawn(['git', 'init', '--quiet'], { cwd: root })
  if (await git.exited !== 0) throw new Error('Could not initialize fixture')
  return { root, temporary, scanner, artifact }
}

test.concurrent('Python keeps function ownership, nested projects and exact source positions without executing code', async () => {
  const { root, temporary, scanner } = await fixture()
  try {
    const file = path.join(root, 'service.py')
    // Python source lines exclude Unicode separators inside strings; keep CRLF offsets too.
    const source = (await readFile(file, 'utf8')).replace('🐍', '🐍\u2028text').replace(/\r?\n/g, '\r\n')
    await writeFile(file, source)
    const files = await pythonFiles(root)
    await scanner.checkReadiness!(root, {}, files)
    const first = (await scanner.scan(root, {}, files))!
    expect(await scanner.scan(root, {}, files)).toEqual(first)
    const roots = new Map(first.roots.map(item => [item.id, item]))
    const owner = first.files.find(item => item.file === 'nested/worker.py')!.roots[0]!
    expect(roots.get(owner)?.parent).toBe(first.files.find(item => item.file === 'service.py')!.roots[0])
    expect(new Set(first.files.map(item => item.file)).size).toBe(first.files.length)
    const operations = new Map(first.operations!.map(item => [item.id, item]))
    const calls = first.invocations!.filter(call => operations.get(call.source)!.file === 'service.py')
    const at = (text: string) => calls.find(call => call.position === source.indexOf(text))!
    expect(operations.get(at('self.port.send(value)').source)?.position).toBe(source.indexOf('async def run'))
    expect(operations.get(at('inner()').source)?.position).toBe(source.indexOf('def nested'))
    expect(operations.get(at('local_work()').source)?.position).toBe(source.indexOf('def work'))
    expect(at('self.port.send(value)')).toMatchObject({ member: 'send', line: 6, targets: [], unresolved: true })
    for (const text of ['factory()', 'default()', 'anonymous()', 'deferred()', 'class_body()']) expect(at(text)).toBeUndefined()
    expect(first.invocations!.every(call => call.unresolved && call.targets.length === 0 && !call.binding)).toBe(true)
    expect(first.diagnostics.some(item => item.code === 'PYTHON_SYNTAX_ONLY')).toBe(true)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

/** `:name` is a parameter and `:name+` or `:name*` a catch-all, `!` marks a constrained one; `{}` is dynamic and `?` unknown. */
function segmentLabel(segment: HttpEndpointSegment | HttpRequestSegment): string {
  if (segment.kind === 'literal') return segment.value
  if (segment.kind === 'dynamic') return '{}'
  if (segment.kind === 'unknown') return '?'
  const suffix = segment.kind === 'catch-all' ? (segment.optional ? '*' : '+') : ''
  return `:${segment.name}${suffix}${segment.constrained ? '!' : ''}`
}

function route(path: readonly (HttpEndpointSegment | HttpRequestSegment)[]): string {
  return `/${path.map(segmentLabel).join('/')}`
}

test.concurrent('Python reports Flask, FastAPI and Django endpoints and requests, and nothing it cannot resolve', async () => {
  const { root, temporary, scanner } = await fixture('python-http')
  try {
    const observation = (await scanner.scan(root, {}, await pythonFiles(root)))!
    const operations = new Map(observation.operations!.map(operation => [operation.id, operation]))
    const at = (operation: string) => {
      const found = operations.get(operation)!
      return `${found.file.replace('shop/', '')}#${found.name}`
    }
    const order = (fact: ScanHttpEndpoint) => fact.order ? ` @${fact.order.application.replace('shop/', '')}:${fact.order.position}` : ''
    const endpoints = observation.httpEndpoints!.map(fact => `${fact.method} ${route(fact.path)} ${at(fact.operation)}${order(fact)}`)
    // Absent: a Flask route with a computed path or methods list, and a blueprint registered on an application
    // passed in as a parameter, even when the module binds an application of the same name. Flask's registering
    // prefix replaces the blueprint's own. Django lists endpoints in resolution order; an entry of an ordered
    // router the scanner cannot report is a blocker (a constrained optional catch-all after its literal prefix).
    expect(endpoints.sort()).toEqual([
      '* /:rest*! fastapiapp/main.py#(module) @fastapiapp/main.py:0',
      '* /admin/:rest*! djangoapp/urls.py#(module) @djangoapp/urls.py:13',
      '* /admin/:rest*! fastapiapp/main.py#(module) @fastapiapp/main.py:0',
      '* /api/:rest*! djangoapp/views.py#list_talks @djangoapp/urls.py:10',
      '* /api/:rest*! djangoapp/views.py#list_talks @djangoapp/urls.py:12',
      '* /api/:rest*! djangoapp/views.py#list_talks @djangoapp/urls.py:8',
      '* /api/board/:rest*! djangoapp/talks_urls.py#(module) @djangoapp/urls.py:4',
      '* /api/code/:code*! djangoapp/views.py#talk_detail @djangoapp/urls.py:9',
      '* /api/feed/:rest* djangoapp/views.py#list_talks @djangoapp/urls.py:7',
      '* /api/files/:rest+ djangoapp/views.py#files @djangoapp/urls.py:3',
      '* /api/legacy/:pk! djangoapp/views.py#legacy_talk @djangoapp/urls.py:2',
      '* /api/raw/:path*! djangoapp/views.py#files @djangoapp/urls.py:5',
      '* /api/sitemap.xml djangoapp/views.py#list_talks @djangoapp/urls.py:11',
      '* /api/slug/:slug djangoapp/views.py#talk_detail @djangoapp/urls.py:6',
      '* /api/talks djangoapp/views.py#list_talks @djangoapp/urls.py:0',
      '* /api/talks/:pk! djangoapp/views.py#talk_detail @djangoapp/urls.py:1',
      '* /static/:rest*! fastapiapp/main.py#(module) @fastapiapp/main.py:0',
      'DELETE /api/speakers/:speaker_id/talks/:rest+ fastapiapp/speakers.py#drop_talks @fastapiapp/main.py:0',
      'GET /:rest*! fastapiapp/extra.py#items @fastapiapp/extra.py:0',
      'GET /api/:talk_id! flaskapp/talks.py#talk',
      'GET /api/archive flaskapp/talks.py#archive',
      'GET /api/files/:name*! flaskapp/talks.py#raw_file',
      'GET /api/notes/latest flaskapp/talks.py#latest',
      'GET /api/speakers/:rest*! fastapiapp/speakers.py#section @fastapiapp/main.py:0',
      'GET /api/speakers/:speaker_id fastapiapp/speakers.py#read_speaker @fastapiapp/main.py:0',
      'GET /api/speakers/:speaker_id! fastapiapp/speakers.py#photo @fastapiapp/main.py:0',
      'GET /health fastapiapp/main.py#health @fastapiapp/main.py:0',
      'GET /health flaskapp/app.py#health',
      'GET /legacy/:rest*! fastapiapp/main.py#(module) @fastapiapp/main.py:0',
      'GET /orphan/items fastapiapp/orphan_routes.py#orphan_items @fastapiapp/orphan_routes.py:0',
      'GET /ping fastapiapp/main.py#ping @fastapiapp/main.py:0',
      'GET /status fastapiapp/main.py#status @fastapiapp/main.py:0',
      'GET /v1/items fastapiapp/sub.py#sub_items @fastapiapp/main.py:0',
      'GET /version fastapiapp/main.py#version @fastapiapp/main.py:0',
      'HEAD /status fastapiapp/main.py#status @fastapiapp/main.py:0',
      'POST /api flaskapp/talks.py#create',
      'PUT /api/:talk_id! flaskapp/talks.py#talk',
    ])
    const requests = observation.httpRequests!.map(fact => [
      fact.method ?? '', `${fact.configured ? '<base>' : ''}${route(fact.path)}`, at(fact.operation),
    ].join(' '))
    // Absent: a call outside an operation, a client rebound by assignment or a for loop, and a parameter named
    // like the library. self.base_url resolves to text only when the class, its ancestors and its subclasses
    // assign base_url exactly once, by a plain assignment; otherwise it is a configured base.
    // Only a configuration read or a base_url attribute is a configured base; a host, a parameter, a call
    // and a name bound twice lead with an unknown segment.
    expect(requests.sort()).toEqual([
      'DELETE /speakers/{} clients/api.py#drop_speaker',
      'GET /? clients/calls.py#fetch',
      'GET /?/repos clients/proxy.py#GitHub.repos',
      'GET /?/talks clients/api.py#read_locale',
      'GET /?/talks clients/api.py#read_region',
      'GET /?/talks clients/api.py#read_version',
      'GET /?/talks clients/calls.py#read_partner',
      'GET /?/talks clients/proxy.py#Feed.load',
      'GET /?/talks clients/proxy.py#joined',
      'GET /?/talks clients/proxy.py#load_base',
      'GET /?/talks clients/proxy.py#with_call',
      'GET /health clients/calls.py#check_health',
      'GET /internal/talks clients/proxy.py#Internal.load',
      'GET /speakers/? clients/api.py#read_speaker_file',
      'GET /speakers/featured clients/api.py#read_featured',
      'GET /talks clients/calls.py#read_talks',
      'GET <base>/? clients/calls.py#read_joined',
      'GET <base>/?/talks clients/proxy.py#env_joined',
      'GET <base>/invoices clients/proxy.py#Billing.load',
      'GET <base>/speakers clients/api.py#read_speaker',
      'GET <base>/talks clients/api.py#list_talks',
      'GET <base>/talks clients/proxy.py#Api.load',
      'GET <base>/talks clients/proxy.py#Mirror.load',
      'GET <base>/talks clients/proxy.py#Rotating.load',
      'GET <base>/talks clients/proxy.py#Tokened.load',
      'GET <base>/talks clients/proxy.py#Upstream.load',
      'GET <base>/talks clients/sessions.py#read_shared',
      'GET <base>/v1/talks clients/proxy.py#Versioned.load',
      'HEAD /health clients/calls.py#head_health',
      'PATCH /talks/7 clients/calls.py#patch_talk',
      'POST /imports clients/calls.py#send_import',
      'POST <base>/talks clients/calls.py#create_talk',
      'PUT <base>/talks/{} clients/calls.py#replace_talk',
    ])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('a Django URL table the scanner cannot read keeps every Django endpoint unreported', async () => {
  const { root, temporary, scanner } = await fixture('python-http-hidden')
  try {
    // The root table is built by addition, so the prefix above the included table is unknown.
    expect((await scanner.scan(root, {}, await pythonFiles(root)))!.httpEndpoints).toEqual([])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('a request that an earlier Django entry the scanner cannot read could capture derives no row', async () => {
  const { root, temporary, scanner } = await fixture('python-http-blocked')
  try {
    const scan = (await scanner.scan(root, {}, await pythonFiles(root)))!
    const owners = new Map(scan.files.map(file => [file.file, file.file]))
    // Django tries boards/<slug>/ first, and its class-based view is unknown, so only /talks/ derives a row.
    expect(httpRelationships([scan], owners).map(row => [row.source, row.target, row.description])).toEqual([
      ['client/api.py', 'site/views.py', 'Calls HTTP endpoint: GET /talks'],
    ])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('a base_url set on any client outside a class leaves every class base_url configured', async () => {
  const { root, temporary, scanner } = await fixture('python-http-base-store')
  try {
    const scan = (await scanner.scan(root, {}, await pythonFiles(root)))!
    expect(scan.httpRequests!.map(fact => [fact.configured ?? false, route(fact.path)])).toEqual([[true, '/repos']])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Python skips Git-ignored and excluded inputs, project declarations included, and reads tracked or restored source', async () => {
  const { root, temporary, scanner } = await fixture()
  try {
    await writeFile(path.join(root, '.gitignore'), 'ignored.py\ntracked.py\n')
    for (const file of ['ignored.py', 'tracked.py', 'test_bad.py', 'conftest.py', 'test_restored.py']) {
      await writeFile(path.join(root, file), ['tracked.py', 'test_restored.py'].includes(file) ? 'def live(): pass\n' : 'invalid syntax @\n')
    }
    for (const directory of ['.venv', 'venv', '__pycache__', 'tests', 'test', 'build']) {
      await mkdir(path.join(root, directory))
      await writeFile(path.join(root, directory, 'bad.py'), 'invalid syntax @\n')
    }
    await writeFile(path.join(root, 'build/pyproject.toml'), '[project\n')
    const git = Bun.spawn(['git', 'add', '-f', 'tracked.py'], { cwd: root })
    expect(await git.exited).toBe(0)
    // The package's defaults as adding the scanner writes them, then a restore appended to its list.
    const { include, exclude } = manifest.groma.scanner
    const selected = await scannerFiles(root, { include, exclude: [...exclude, '!test_restored.py'] })
    const files = (await scanner.scan(root, {}, selected))!.files.map(item => item.file)
    expect(files).toEqual(['nested/worker.py', 'service.py', 'test_restored.py', 'tracked.py'])
    // Groma explains a file without an owner from this listing, so it names every source before exclusions.
    expect(await scanner.listSourceFiles!(root, {}, await scannerFiles(root, { include })))
      .toEqual(expect.arrayContaining([...files, 'tests/bad.py']))
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('lint finds identical and near-duplicate Python functions but never callbacks or initialization code', async () => {
  const { root, temporary, artifact } = await fixture('python-duplicated-logic')
  try {
    await cp(path.join(fixtures, 'empty-project'), root, { recursive: true })
    await addScanner(root, artifact)
    const lint = Bun.spawn([process.execPath, cli, 'lint'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    const [code, out, error] = await Promise.all([lint.exited, new Response(lint.stdout).text(), new Response(lint.stderr).text()])
    expect(code, error).toBe(1)
    // Each finding starts on an unindented line; similar copies are marked as not identical.
    const findings = out.trim().split(/\n(?=\S)/).map(finding => ({
      at: [...finding.matchAll(/\S+\.py:\d+/g)].map(match => match[0]).sort(),
      identical: !finding.includes('not identical'),
    }))
    // The renamed readiness copy matches exactly; the identical lambdas and initialization loops are absent, and
    // so are the distinct.py pairs, which differ only in grouping, subscripts, slices, else blocks, dictionary
    // unpacking, the nested function called or the import.
    expect(findings).toEqual([
      { at: ['invoice.py:1', 'quote.py:1'], identical: false },
      { at: ['readiness.py:1', 'scheduling.py:1'], identical: true },
    ])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('a component outlines its Python file beside a TypeScript file under the Python visibility rules', async () => {
  const { root, temporary, artifact } = await fixture('python-outline')
  try {
    await addScanner(root, artifact)
    await addScanner(root, path.resolve(import.meta.dir, '../plugins/scanners/typescript'))
    const world = await loadAnnotatedArchitecture(root)
    const component = world.elements.find(element => element.kind === 'component')!
    const files = await readCodeStructure(root, world, null, component.representationId) ?? []
    expect(files.map(file => file.file)).toEqual([...new Set(component.code.map(reference => reference.file))])
    const symbol = ({ name, line, visibility, entry }: CodeSymbol) => [name, line, visibility, entry]
    const python = files.find(file => file.file.endsWith('.py'))!.declarations.map(declaration => [
      declaration.kind, ...symbol(declaration), declaration.kind === 'type' ? declaration.members.map(symbol) : [],
    ])
    // Type aliases, wrapped values, nested declarations, class attributes and properties are absent.
    // Code links name a function as place_order and a method as OrderService.fetch.
    expect(python).toEqual([
      ['function', 'place_order', 6, 'public', true, []],
      ['function', '_audit', 10, 'private', false, []],
      ['function', 'ship', 16, 'public', false, []],
      ['function', 'notify', 17, 'public', false, []],
      ['type', 'OrderService', 21, 'public', false, [
        ['__init__', 28, 'public', false],
        ['load', 32, 'public', false],
        ['_protect', 47, 'protected', false],
        ['__hide', 50, 'private', false],
        ['__len__', 53, 'public', false],
        ['fetch', 56, 'public', true],
      ]],
      ['type', '_Draft', 60, 'private', false, [['submit', 61, 'public', false]]],
    ])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Python rejects syntax and scope errors without returning partial observations', async () => {
  const { root, temporary, scanner } = await fixture()
  try {
    for (const source of ['def broken(:\n', 'return 1\n']) {
      await writeFile(path.join(root, 'nested/worker.py'), source)
      await expect(scanner.scan(root, {}, await pythonFiles(root))).rejects.toThrow('PYTHON_SCAN_FAILED')
    }
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Python scans valid module-level await without executing it', async () => {
  const { root, temporary, scanner } = await fixture()
  try {
    await writeFile(path.join(root, 'await.py'), 'async def main(): pass\nawait main()\n')
    expect((await scanner.scan(root, {}, await pythonFiles(root)))!.files.some(file => file.file === 'await.py')).toBe(true)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('a declared Python script selects its own project module despite a matching module in another project', async () => {
  const { root, temporary, scanner } = await fixture()
  try {
    await writeFile(path.join(root, 'nested/pyproject.toml'), '[project]\nname = "nested"\n[project.scripts]\ntermui = "termui:cli"\n')
    await writeFile(path.join(root, 'nested/termui.py'), 'def cli(): pass\n')
    await writeFile(path.join(root, 'termui.py'), 'def other(): pass\n')
    expect((await scanner.scan(root, {}, await pythonFiles(root)))!.entryPoints).toContainEqual({
      file: 'nested/termui.py', declaration: 'nested/pyproject.toml', name: 'termui', files: ['nested/termui.py'],
    })
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('a Python entry includes repeated star imports and imports in a module-level branch', async () => {
  const { root, temporary, scanner } = await fixture()
  try {
    await mkdir(path.join(root, 'pkg'))
    await writeFile(path.join(root, 'pkg/__main__.py'), 'from .first import *\nfrom .second import *\ntry:\n    from .third import run\nexcept ImportError:\n    pass\n')
    for (const name of ['first', 'second', 'third']) await writeFile(path.join(root, `pkg/${name}.py`), 'def run(): pass\n')
    expect((await scanner.scan(root, {}, await pythonFiles(root)))!.entryPoints?.find(entry => entry.file === 'pkg/__main__.py')?.files).toEqual([
      'pkg/__main__.py', 'pkg/first.py', 'pkg/second.py', 'pkg/third.py',
    ])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('a shared exclusion keeps invalid Python outside parsing when valid source remains', async () => {
  const { root, temporary, artifact } = await fixture()
  try {
    await cp(path.join(fixtures, 'empty-project'), root, { recursive: true })
    await writeFile(path.join(root, 'bad.py'), 'def broken(:\n')
    await addScanner(root, artifact)
    await writeScannerConfig(root, { ...await readScannerConfig(root), exclude: ['/bad.py'] })
    const batch = await (await loadScannerRegistry(root)).collectObservations(root)
    expect(batch.failures).toEqual([])
    expect(batch.observations[0]?.files.some(file => file.file === 'bad.py')).toBe(false)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Python recognizes a Flask route registered with a view function', async () => {
  const { root, temporary, scanner } = await fixture()
  try {
    await writeFile(path.join(root, 'flask_case.py'), 'from flask import Flask\napp = Flask(__name__)\ndef hello(): pass\napp.add_url_rule("/hello", view_func=hello)\n')
    const scan = (await scanner.scan(root, {}, await pythonFiles(root)))!
    const handler = scan.operations!.find(operation => operation.file === 'flask_case.py' && operation.name === 'hello')!
    expect(scan.httpEndpoints).toContainEqual({
      operation: handler.id, method: 'GET', path: [{ kind: 'literal', value: 'hello' }],
    })
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Python recognizes a Flask route on an app created inside a factory', async () => {
  const { root, temporary, scanner } = await fixture()
  try {
    await writeFile(path.join(root, 'factory.py'), 'from flask import Flask\ndef create_app():\n    app = Flask(__name__)\n    @app.route("/inside")\n    def inside(): pass\n    def unrelated(app):\n        @app.route("/wrong")\n        def wrong(): pass\n    return app\n')
    const scan = (await scanner.scan(root, {}, await pythonFiles(root)))!
    const handler = scan.operations!.find(operation => operation.file === 'factory.py' && operation.name.endsWith('inside'))!
    expect(scan.httpEndpoints).toContainEqual({
      operation: handler.id, method: 'GET', path: [{ kind: 'literal', value: 'inside' }],
    })
    expect(scan.httpEndpoints?.some(fact => route(fact.path) === '/wrong')).toBe(false)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Python supports source without packaging metadata and returns no observation without source', async () => {
  const { root, temporary, scanner } = await fixture()
  try {
    await rm(path.join(root, 'pyproject.toml'))
    await rm(path.join(root, 'nested'), { recursive: true })
    const result = (await scanner.scan(root, {}, await pythonFiles(root)))!
    expect(result.roots).toHaveLength(1)
    expect(result.roots[0]?.kind).toBe('source-group')
    expect(result.files[0]?.roots).toEqual([result.roots[0]!.id])
    await rm(path.join(root, 'service.py'))
    expect(await scanner.scan(root, {}, await pythonFiles(root))).toBeUndefined()
  } finally { await rm(temporary, { recursive: true, force: true }) }
})
