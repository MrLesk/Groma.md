import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildPackage } from '../plugins/scanners/python/build.ts'
import type { CodeSymbol, HttpEndpointSegment, HttpRequestSegment, ScannerPlugin } from '@groma/scanner'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { addScanner } from '../src/scanner/modules/inventory.ts'
import { compileWatchPatterns } from '../src/scanner/watch-patterns.ts'
import { readCodeStructure } from '../src/viewers/source/structure.ts'

const fixtures = path.resolve(import.meta.dir, '../test/fixtures')
const cli = path.resolve(import.meta.dir, '../src/cli.ts')

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
    await scanner.checkReadiness!(root)
    const first = (await scanner.scan(root))!
    expect(await scanner.scan(root)).toEqual(first)
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

/** `:name`, `:name+` and `:name*` are parameters and catch-alls; `{}` is dynamic and `?` unknown. */
function route(path: readonly (HttpEndpointSegment | HttpRequestSegment)[]): string {
  return `/${path.map(segment => {
    if (segment.kind === 'literal') return segment.value
    if (segment.kind === 'dynamic') return '{}'
    if (segment.kind === 'unknown') return '?'
    const suffix = segment.kind === 'catch-all' ? (segment.optional ? '*' : '+') : (segment.optional ? '?' : '')
    return `:${segment.name}${suffix}`
  }).join('/')}`
}

test.concurrent('Python reports Flask, FastAPI and Django endpoints and requests, and nothing it cannot resolve', async () => {
  const { root, temporary, scanner } = await fixture('python-http')
  try {
    const observation = (await scanner.scan(root))!
    const operations = new Map(observation.operations!.map(operation => [operation.id, operation]))
    const at = (operation: string) => {
      const found = operations.get(operation)!
      return `${found.file.replace('shop/', '')}#${found.name}`
    }
    const endpoints = observation.httpEndpoints!.map(fact => `${fact.method} ${route(fact.path)} ${at(fact.operation)}`)
    // Absent: a computed route or methods list, a segment mixing text with a placeholder, an
    // unresolved view, and a blueprint registered on an application built inside a factory.
    expect(endpoints.sort()).toEqual([
      '* /api/files/:rest+ djangoapp/views.py#files',
      '* /api/legacy/:pk djangoapp/views.py#legacy_talk',
      '* /api/talks djangoapp/views.py#list_talks',
      '* /api/talks/:pk djangoapp/views.py#talk_detail',
      'DELETE /api/speakers/:speaker_id/talks/:rest+ fastapiapp/speakers.py#drop_talks',
      'GET /api/speakers/:speaker_id fastapiapp/speakers.py#read_speaker',
      'GET /api/talks/:talk_id flaskapp/talks.py#talk',
      'GET /api/talks/archive flaskapp/talks.py#archive',
      'GET /health fastapiapp/main.py#health',
      'GET /health flaskapp/app.py#health',
      'POST /api/talks flaskapp/talks.py#create',
      'PUT /api/talks/:talk_id flaskapp/talks.py#talk',
    ])
    const requests = observation.httpRequests!.map(fact => [
      fact.method ?? '', `${fact.configured ? '<base>' : ''}${route(fact.path)}`, at(fact.operation),
    ].join(' '))
    // Absent: a call outside an operation, a rebound client, and a parameter named like the library.
    // A host and an unresolved URL lead with an unknown segment; a name bound twice is a configured base.
    expect(requests.sort()).toEqual([
      'DELETE /speakers/{} clients/api.py#drop_speaker',
      'GET /? clients/calls.py#fetch',
      'GET /?/talks clients/calls.py#read_partner',
      'GET /health clients/calls.py#check_health',
      'GET /speakers/? clients/api.py#read_speaker_file',
      'GET /speakers/featured clients/api.py#read_featured',
      'GET /talks clients/calls.py#read_talks',
      'GET <base>/? clients/calls.py#read_joined',
      'GET <base>/speakers clients/api.py#read_speaker',
      'GET <base>/talks clients/api.py#list_talks',
      'GET <base>/talks clients/api.py#read_locale',
      'GET <base>/talks clients/api.py#read_version',
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
    expect((await scanner.scan(root))!.httpEndpoints).toEqual([])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Python excludes ignored files, environments and tests while keeping tracked and untracked source', async () => {
  const { root, temporary, scanner } = await fixture()
  try {
    await writeFile(path.join(root, '.gitignore'), 'ignored.py\ntracked.py\n')
    for (const file of ['ignored.py', 'tracked.py', 'test_bad.py', 'conftest.py']) {
      await writeFile(path.join(root, file), file === 'tracked.py' ? 'def live(): pass\n' : 'invalid syntax @\n')
    }
    for (const directory of ['.venv', 'venv', '__pycache__', 'tests', 'test', 'node_modules']) {
      await mkdir(path.join(root, directory))
      await writeFile(path.join(root, directory, 'bad.py'), 'invalid syntax @\n')
    }
    const git = Bun.spawn(['git', 'add', '-f', 'tracked.py'], { cwd: root })
    expect(await git.exited).toBe(0)
    expect((await scanner.scan(root))!.files.map(item => item.file)).toEqual(['nested/worker.py', 'service.py', 'tracked.py'])
    const watches = compileWatchPatterns(scanner.watch)
    expect(watches('nested/worker.py')).toBe(true)
    expect(watches('nested/pyproject.toml')).toBe(true)
    expect(watches('.venv/bad.py')).toBe(false)
    expect(watches('tests/bad.py')).toBe(false)
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
      await expect(scanner.scan(root)).rejects.toThrow('PYTHON_SCAN_FAILED')
    }
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Python supports source without packaging metadata and returns no observation without source', async () => {
  const { root, temporary, scanner } = await fixture()
  try {
    await rm(path.join(root, 'pyproject.toml'))
    await rm(path.join(root, 'nested'), { recursive: true })
    const result = (await scanner.scan(root))!
    expect(result.roots).toHaveLength(1)
    expect(result.roots[0]?.kind).toBe('source-group')
    expect(result.files[0]?.roots).toEqual([result.roots[0]!.id])
    await rm(path.join(root, 'service.py'))
    expect(await scanner.scan(root)).toBeUndefined()
  } finally { await rm(temporary, { recursive: true, force: true }) }
})
