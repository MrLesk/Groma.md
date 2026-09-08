import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from 'bun:test'
import { addScanner, scannerInventory } from '../src/scanner/modules/inventory.ts'
import { discoverScanners, type ScannerDiscovery } from '../src/scanner/modules/discovery.ts'
import { installSelectedScanners, setupScanners } from '../src/scanner/modules/setup.ts'
import { checkScannerReadiness, requireScannerReadiness } from '../src/scanner/modules/readiness.ts'
import { loadScannerRegistry } from '../src/scanner/registry.ts'

async function repository(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-setup-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  const git = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
  expect(await git.exited).toBe(0)
  return root
}

function manifest(id: string) {
  return { name: `fixture-${id}`, version: '1.2.3', type: 'module', groma: { scanner: { id, entry: './index.js' } } }
}

async function plugin(root: string, id: string, hook = '', scan = ''): Promise<string> {
  const directory = path.join(root, 'plugins', id)
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, 'package.json'), JSON.stringify(manifest(id)))
  await writeFile(path.join(directory, 'index.js'), `export default {
    id: ${JSON.stringify(id)}, matchesFile: () => false, ${hook}
    async scan() { ${scan} },
  }`)
  return `./plugins/${id}`
}

async function packageRegistry() {
  const id = 'selected'
  const name = `fixture-${id}`
  const tarball = await new Bun.Archive({
    'package/package.json': JSON.stringify(manifest(id)),
    'package/index.js': `export default { id: 'selected', matchesFile: () => false, async scan() {} }`,
  }, { compress: 'gzip' }).bytes()
  const requests: string[] = []
  const server = Bun.serve({ port: 0, fetch(request) {
    const url = new URL(request.url)
    requests.push(url.pathname)
    if (url.pathname.endsWith('.tgz')) return new Response(tarball)
    return Response.json({ name, 'dist-tags': { latest: '1.2.3' }, versions: {
      '1.2.3': { name, version: '1.2.3', dist: {
        tarball: `${url.origin}/fixture-selected.tgz`,
        integrity: `sha512-${createHash('sha512').update(tarball).digest('base64')}`,
      } },
    } })
  } })
  return { server, requests, registry: `http://127.0.0.1:${server.port}` }
}

test.concurrent('selection retains existing scanners, declines additions, and records only the chosen exact package', async () => {
  const root = await repository()
  const npm = await packageRegistry()
  const options = { cacheRoot: path.join(root, '.cache'), registry: npm.registry }
  try {
    await addScanner(root, await plugin(root, 'retained'), options)
    const proposal: ScannerDiscovery = {
      ...await discoverScanners(root),
      recommendations: ['selected', 'declined'].map(id => ({
        id, package: `fixture-${id}`, status: 'installable', evidence: [], reason: 'Test release',
        installSource: `fixture-${id}@1.2.3`,
      })),
    }
    await installSelectedScanners(root, proposal, [], options)
    expect(npm.requests).toHaveLength(0)
    expect((await scannerInventory(root, options)).map(item => item.id)).toEqual(['typescript', 'retained'])
    await expect(installSelectedScanners(root, proposal, ['unavailable'], options)).rejects.toThrow('not an installable recommendation')
    expect(npm.requests).toHaveLength(0)
    await installSelectedScanners(root, proposal, ['selected'], options)
    const configured = JSON.parse(await readFile(path.join(root, 'groma/scanners.json'), 'utf8')).scanners
    expect(configured).toEqual([
      { id: 'retained', source: './plugins/retained' },
      { id: 'selected', source: 'fixture-selected@1.2.3' },
    ])
    expect(npm.requests.some(item => item.includes('declined'))).toBe(false)
    expect((await discoverScanners(root, options)).inventory.map(item => item.id)).toEqual(['typescript', 'retained', 'selected'])
  } finally {
    await npm.server.stop(true)
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('readiness separates installed packages from preparation and leaves a plugin without a hook scannable', async () => {
  const root = await repository()
  try {
    await addScanner(root, await plugin(root, 'blocked', "async checkReadiness() { throw new Error('Install the project SDK with its declared toolchain.'); },", "throw new Error('scan must not run during readiness')"))
    await addScanner(root, await plugin(root, 'unchecked'))
    await addScanner(root, await plugin(root, 'missing'))
    await rm(path.join(root, 'plugins/missing'), { recursive: true })
    const readiness = await checkScannerReadiness(root)
    expect(readiness.map(({ id, package: available, project }) => ({ id, available, project }))).toEqual([
      { id: 'typescript', available: 'built-in', project: 'ready' },
      { id: 'blocked', available: 'found', project: 'blocked' },
      { id: 'missing', available: 'missing', project: 'blocked' },
      { id: 'unchecked', available: 'found', project: 'unchecked' },
    ])
    expect(() => requireScannerReadiness(readiness)).toThrow('Install the project SDK')
    expect(() => requireScannerReadiness(readiness.filter(item => item.id === 'unchecked'))).not.toThrow()
    await writeFile(path.join(root, 'groma/scanners.json'), JSON.stringify({ scanners: [{ id: 'unchecked', source: './plugins/unchecked' }] }))
    expect(await (await loadScannerRegistry(root)).collectObservations(root)).toEqual([])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('noninteractive setup reports recommendations without prompting or enabling new packages', async () => {
  const root = await repository()
  try {
    await writeFile(path.join(root, 'pom.xml'), '<project><properties><java.version>25</java.version></properties></project>')
    const output: string[] = []
    expect(await setupScanners(root, false, {
      note() { throw new Error('Noninteractive setup must use plain output') },
      async selectScanners() { throw new Error('Noninteractive setup must not prompt') },
    }, message => output.push(message))).toBe(true)
    expect(output.join('\n')).toContain('pom.xml')
    expect(output.join('\n')).toContain('java')
    expect((await scannerInventory(root)).map(item => item.id)).toEqual(['typescript'])
    await expect(readFile(path.join(root, 'groma/scanners.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
