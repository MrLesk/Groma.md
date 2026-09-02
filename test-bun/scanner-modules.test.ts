import { createHash } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { expect, test } from 'bun:test'

import { loadScannerRegistry } from '../src/scanner/registry.ts'
import {
  addScanner,
  installScanners,
  removeScanner,
  scannerInventory,
} from '../src/scanner/modules/inventory.ts'

const projectRoot = path.resolve(import.meta.dir, '..')

async function runCli(repositoryRoot: string, ...args: string[]): Promise<{
  code: number
}> {
  const child = Bun.spawn([
    process.execPath,
    path.join(projectRoot, 'src/cli.ts'),
    ...args,
  ], {
    cwd: repositoryRoot,
    stderr: 'ignore',
    stdout: 'ignore',
  })
  return { code: await child.exited }
}

async function writeTree(root: string, files: Record<string, string>): Promise<void> {
  for (const [relative, source] of Object.entries(files)) {
    const filename = path.join(root, ...relative.split('/'))
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, source)
  }
}

async function fixtureRoot(prefix: string, directory = 'groma'): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix))
  await writeTree(root, {
    [`${directory}/index.md`]: '---\nokf_version: "0.2"\n---\n',
    'package.json': JSON.stringify({ name: 'fixture' }),
    'src/index.ts': 'export const fixture = true\n',
  })
  for (const args of [['init', '--quiet'], ['add', '-A']]) {
    const child = Bun.spawn(['git', ...args], { cwd: root, stderr: 'pipe' })
    const [code, stderr] = await Promise.all([
      child.exited,
      new Response(child.stderr).text(),
    ])
    if (code !== 0) throw new Error(stderr)
  }
  return root
}

function packageManifest(name: string, version: string, id: string, entry = './index.js'): string {
  return JSON.stringify({
    name,
    version,
    type: 'module',
    groma: { scanner: { id, entry } },
  }, null, 2)
}

function scannerModule(id: string, marker?: string): string {
  return `${marker === undefined ? '' : `await Bun.write(${JSON.stringify(marker)}, 'loaded')\n`}
export default {
  id: ${JSON.stringify(id)},
  matchesFile(file) { return file.endsWith('.fixture') },
  async scan() {
    return {
      schemaVersion: 1,
      complete: true,
      scanner: { language: ${JSON.stringify(id)}, engine: 'fixture', engineVersion: '1' },
      root: { kind: 'package', name: 'Fixture', file: 'package.json' },
      scopes: [], files: [], placements: [], relationships: [], diagnostics: [],
    }
  },
}
`
}

async function writeScannerPackage(
  packageRoot: string,
  id: string,
  marker?: string,
): Promise<void> {
  await writeTree(packageRoot, {
    'package.json': packageManifest(`fixture-${id}`, '1.0.0', id),
    'index.js': scannerModule(id, marker),
  })
}

async function exists(filename: string): Promise<boolean> {
  try {
    await stat(filename)
    return true
  } catch {
    return false
  }
}

test.concurrent('local scanner configuration drives inventory, loading, and removal', async () => {
  const root = await fixtureRoot('groma-local-scanner-', '.groma')
  const cacheRoot = path.join(root, '.cache')
  const rogueMarker = path.join(root, 'rogue-loaded')
  try {
    await writeTree(path.join(root, 'plugins/invalid'), {
      'package.json': JSON.stringify({ name: 'invalid', version: '1.0.0' }),
      'index.js': scannerModule('invalid'),
    })
    await writeScannerPackage(path.join(root, 'plugins/python'), 'python')
    await writeScannerPackage(path.join(root, 'node_modules/rogue'), 'rogue', rogueMarker)

    await expect(addScanner(root, './plugins/invalid', { cacheRoot })).rejects.toThrow()
    expect(await exists(path.join(root, '.groma/scanners.json'))).toBe(false)
    const added = await addScanner(root, './plugins/python', { cacheRoot })
    expect(added).toEqual({ id: 'python', source: './plugins/python', status: 'found' })
    expect(await scannerInventory(root, { cacheRoot })).toEqual([
      { id: 'typescript', source: 'embedded', status: 'built-in' },
      { id: 'python', source: './plugins/python', status: 'found' },
    ])

    const registry = await loadScannerRegistry(root, { cacheRoot })
    expect(registry.matchesFile('source.fixture')).toBe(true)
    const observations = await registry.collectObservations(root)
    expect(observations.some(item => item.scanner.language === 'python')).toBe(true)
    expect(await exists(rogueMarker)).toBe(false)

    expect(await removeScanner(root, 'python')).toBe('python')
    expect(await scannerInventory(root, { cacheRoot })).toEqual([
      { id: 'typescript', source: 'embedded', status: 'built-in' },
    ])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('a missing scanner blocks every configured module before import', async () => {
  const root = await fixtureRoot('groma-missing-scanner-')
  const cacheRoot = path.join(root, '.cache')
  const loaded = path.join(root, 'first-loaded')
  const second = path.join(root, 'plugins/second')
  try {
    await writeScannerPackage(path.join(root, 'plugins/first'), 'first', loaded)
    await writeScannerPackage(second, 'second')
    await addScanner(root, './plugins/first', { cacheRoot })
    await addScanner(root, './plugins/second', { cacheRoot })
    await rm(second, { recursive: true, force: true })

    expect(await scannerInventory(root, { cacheRoot })).toContainEqual({
      id: 'second',
      source: './plugins/second',
      status: 'missing',
    })
    await expect(loadScannerRegistry(root, { cacheRoot })).rejects.toThrow()
    expect(await exists(loaded)).toBe(false)
    expect(await installScanners(root, { cacheRoot })).toBe(0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

async function npmFixture(): Promise<{
  close(): void
  registry: string
}> {
  const name = 'groma-test-scanner'
  const version = '1.0.0'
  const archive = new Bun.Archive({
    'package/package.json': packageManifest(name, version, 'npm-fixture'),
    'package/index.js': scannerModule('npm-fixture'),
  }, { compress: 'gzip' })
  const tarball = await archive.bytes()
  let registry = ''
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const pathname = new URL(request.url).pathname
      if (pathname === `/${name}/-/${name}-${version}.tgz`) {
        return new Response(tarball, { headers: { 'Content-Type': 'application/octet-stream' } })
      }
      if (pathname !== `/${name}`) return new Response('not found', { status: 404 })
      const integrity = createHash('sha512').update(tarball).digest('base64')
      const shasum = createHash('sha1').update(tarball).digest('hex')
      return Response.json({
        name,
        'dist-tags': { latest: version },
        versions: {
          [version]: {
            name,
            version,
            dist: {
              integrity: `sha512-${integrity}`,
              shasum,
              tarball: `${registry}/${name}/-/${name}-${version}.tgz`,
            },
          },
        },
      })
    },
  })
  registry = `http://127.0.0.1:${server.port}`
  return { close: () => server.stop(true), registry }
}

test.concurrent('npm scanners install explicitly into shared cache and restore from config', async () => {
  const root = await fixtureRoot('groma-npm-scanner-')
  const cacheRoot = path.join(root, '.cache')
  const npm = await npmFixture()
  try {
    await expect(addScanner(root, 'groma-test-scanner@latest', {
      cacheRoot,
      registry: npm.registry,
    })).rejects.toThrow()
    await expect(addScanner(root, 'missing-scanner@1.0.0', {
      cacheRoot,
      registry: npm.registry,
    })).rejects.toThrow()
    expect(await exists(path.join(root, 'groma/scanners.json'))).toBe(false)

    const added = await addScanner(root, 'groma-test-scanner@1.0.0', {
      cacheRoot,
      registry: npm.registry,
    })
    expect(added.id).toBe('npm-fixture')
    expect((await scannerInventory(root, { cacheRoot }))[1]?.status).toBe('found')

    await rm(cacheRoot, { recursive: true, force: true })
    expect((await scannerInventory(root, { cacheRoot }))[1]?.status).toBe('missing')
    await expect(loadScannerRegistry(root, { cacheRoot })).rejects.toThrow()

    expect(await installScanners(root, {
      cacheRoot,
      registry: npm.registry,
    })).toBe(1)
    npm.close()
    const registry = await loadScannerRegistry(root, { cacheRoot })
    expect(registry.matchesFile('source.fixture')).toBe(true)

    await removeScanner(root, 'npm-fixture')
    expect((await readdir(cacheRoot)).length).toBeGreaterThan(0)
  } finally {
    npm.close()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('scanner commands manage one local module and scan reports a missing source', async () => {
  const root = await fixtureRoot('groma-scanner-cli-')
  const local = path.join(root, 'plugins/python')
  try {
    await writeScannerPackage(local, 'python')

    const added = await runCli(root, 'scanner', 'add', './plugins/python')
    expect(added.code).toBe(0)
    const listed = await runCli(root, 'scanner', 'list')
    expect(listed.code).toBe(0)
    expect((await scannerInventory(root)).find(item => item.id === 'python')?.status).toBe('found')

    await rm(path.join(local, 'index.js'))
    const missing = await runCli(root, 'scanner', 'list')
    expect(missing.code).toBe(0)
    expect((await scannerInventory(root)).find(item => item.id === 'python')?.status).toBe('missing')
    const scan = await runCli(root, 'scan')
    expect(scan.code).toBe(1)

    const removed = await runCli(root, 'scanner', 'remove', 'python')
    expect(removed.code).toBe(0)
    const after = await runCli(root, 'scanner', 'list')
    expect(after.code).toBe(0)
    expect((await scannerInventory(root)).some(item => item.id === 'python')).toBe(false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
