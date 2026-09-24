import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { randomInt } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import packageJson from '../package.json'
import { createScannerSession } from '../src/scanner/session.ts'
import { readScannerConfig, writeScannerConfig } from '../src/scanner/modules/config.ts'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { discoverScanners } from '../src/scanner/modules/discovery.ts'
import { installableScanners, installSelectedScanners } from '../src/scanner/modules/setup.ts'

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-published-install-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/flows'), root, { recursive: true })
  const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
  expect(await git.exited).toBe(0)
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { react: '^19.0.0' } }))
  await writeFile(path.join(root, 'Cargo.toml'), '[package]\nname="sample"\nversion="0.1.0"\n')
  // The registry packages, their tarballs and the scanner caches are test scaffolding, not project source.
  await writeFile(path.join(root, '.gitignore'), 'packages/\ncache/\ncolleague-cache/\n*.tgz\n')
  await writeScannerConfig(root, { scanners: [] })
  const version = `1.0.${randomInt(1000000, 1000000000)}`
  const manifests: Record<string, Record<string, unknown>> = {}
  for (const id of ['react', 'rust']) {
    const directory = path.join(root, 'packages', id)
    const pkg = path.join(directory, 'package')
    await mkdir(pkg, { recursive: true })
    const manifest = { name: `@groma/scanner-${id}`, version, groma: { scanner: { id, entry: './index.js', include: ['**/*.fixture'], discovery: {
      technologies: [id], rules: [], compatibility: { groma: packageJson.version },
    } } } }
    manifests[manifest.name] = manifest
    await writeFile(path.join(pkg, 'package.json'), JSON.stringify(manifest))
    await writeFile(path.join(pkg, 'index.js'), `import { stat } from 'node:fs/promises';
      export default { id: '${id}', async scan(root) {
        if (await stat(root + '/tool-missing').then(() => true, () => false)) throw new Error('Install the project tool.');
        return { scanner: { id: '${id}', technology: '${id}', engine: 'fixture', engineVersion: '1' }, diagnostics: [], roots: [], files: [] };
      } }`)
    const pack = Bun.spawn(['tar', '-czf', `${id}.tgz`, '-C', `packages/${id}`, 'package'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
    const error = await new Response(pack.stderr).text()
    expect(await pack.exited, error).toBe(0)
  }
  const unavailable = new Set<string>()
  const downloads: string[] = []
  const server = Bun.serve({ port: 0, async fetch(request) {
    const url = new URL(request.url), name = decodeURIComponent(url.pathname.slice(1))
    if (name.endsWith('.tgz')) {
      downloads.push(name)
      return new Response(Bun.file(path.join(root, name)))
    }
    const manifest = manifests[name]
    if (!manifest || unavailable.has(name)) return new Response('Not published', { status: 404 })
    const id = name.slice('@groma/scanner-'.length)
    return Response.json({ name, 'dist-tags': { latest: version }, versions: { [version]: {
      ...manifest, dist: { tarball: `${url.origin}/${id}.tgz` },
    } } })
  } })
  const options = { registry: server.url.href, cacheRoot: path.join(root, 'cache') }
  return { root, version, options, unavailable, downloads, async close() { await server.stop(true); await rm(root, { recursive: true, force: true }) } }
}

test.concurrent('bulk installation retains successful releases, retries unpublished packages and restores exact team selections', async () => {
  const f = await fixture()
  const session = await createScannerSession(f.root, { ...f.options, scan: false })
  try {
    expect(session.state.scanners.map(item => item.id), JSON.stringify(session.state)).toContain('rust')
    f.unavailable.add('@groma/scanner-rust')
    const before = await loadAnnotatedArchitecture(f.root)
    await expect(session.change({ action: 'install-recommended' })).rejects.toThrow('rust:')
    const first = await readScannerConfig(f.root)
    expect(first.scanners).toEqual([{ id: 'react', source: `@groma/scanner-react@${f.version}`, include: ['**/*.fixture'] }])
    expect(session.state.scanners.find(item => item.id === 'react')?.status).toBe('ready')
    f.unavailable.clear()
    await session.change({ action: 'install-recommended' })
    const configured = await readScannerConfig(f.root)
    expect(configured.scanners.map(item => item.source)).toEqual([`@groma/scanner-react@${f.version}`, `@groma/scanner-rust@${f.version}`])
    expect(f.downloads.filter(name => name === 'react.tgz')).toHaveLength(1)
    const selection = await readFile(path.join(f.root, 'groma/scanners.json'), 'utf8')
    await session.close()
    const colleague = await createScannerSession(f.root, { registry: f.options.registry, cacheRoot: path.join(f.root, 'colleague-cache'), scan: false })
    try {
      expect(colleague.state.scanners.filter(item => item.status === 'missing')).toHaveLength(2)
      await colleague.change({ action: 'install-missing' })
      expect(colleague.state.scanners.every(item => item.status === 'ready')).toBe(true)
      expect(await readFile(path.join(f.root, 'groma/scanners.json'), 'utf8')).toBe(selection)
      expect((await loadAnnotatedArchitecture(f.root)).elements).toEqual(before.elements)
    } finally { await colleague.close() }
  } finally { await session.close(); await f.close() }
})

test.concurrent('setup retries a partial selection without reinstalling its successful scanners', async () => {
  const f = await fixture()
  try {
    const proposal = await discoverScanners(f.root, f.options)
    const selected = ['react', 'rust']
    f.unavailable.add('@groma/scanner-rust')
    await expect(installSelectedScanners(f.root, proposal, selected, f.options)).rejects.toThrow('rust')
    const first = await readScannerConfig(f.root)
    expect(first.scanners).toEqual([{ id: 'react', source: `@groma/scanner-react@${f.version}`, include: ['**/*.fixture'] }])
    const refreshed = await discoverScanners(f.root, f.options)
    expect(refreshed.inventory).toEqual([{ id: 'react', source: first.scanners[0]!.source, status: 'found' }])
    expect(installableScanners(refreshed).map(item => item.id)).toContain('rust')
    expect(installableScanners(refreshed).map(item => item.id)).not.toContain('react')

    f.unavailable.delete('@groma/scanner-rust')
    f.unavailable.add('@groma/scanner-react')
    await installSelectedScanners(f.root, proposal, selected, f.options)
    const complete = await readScannerConfig(f.root)
    expect(complete.scanners).toEqual([
      ...first.scanners, { id: 'rust', source: `@groma/scanner-rust@${f.version}`, include: ['**/*.fixture'] },
    ])
    await installSelectedScanners(f.root, proposal, selected, f.options)
    await installSelectedScanners(f.root, refreshed, selected, f.options)
    expect(await readScannerConfig(f.root)).toEqual(complete)
    expect(f.downloads.filter(name => name === 'react.tgz')).toHaveLength(1)
    expect(f.downloads.filter(name => name === 'rust.tgz')).toHaveLength(1)
  } finally { await f.close() }
})

test.concurrent('one Install resolves and pins a release, reports scan failure and retries without replacing saved architecture', async () => {
  const f = await fixture()
  const session = await createScannerSession(f.root, { ...f.options, scan: false })
  try {
    await writeFile(path.join(f.root, 'tool-missing'), '')
    const before = await loadAnnotatedArchitecture(f.root)
    await session.change({ action: 'install', id: 'react' })
    expect((await readScannerConfig(f.root)).scanners[0]?.source).toBe(`@groma/scanner-react@${f.version}`)
    expect(session.state.scanners.find(item => item.id === 'react')?.status).toBe('blocked')
    expect((await loadAnnotatedArchitecture(f.root)).elements).toEqual(before.elements)
    await rm(path.join(f.root, 'tool-missing'))
    await session.change({ action: 'retry' })
    expect(session.state.scanners.find(item => item.id === 'react')?.status).toBe('ready')
    expect(f.downloads).toHaveLength(1)
  } finally { await session.close(); await f.close() }
})
