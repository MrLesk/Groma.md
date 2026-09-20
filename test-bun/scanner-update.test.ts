import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import packageJson from '../package.json'
import { configuredScannerModules, updateScanner } from '../src/scanner/modules/inventory.ts'
import { readScannerConfig, writeScannerConfig } from '../src/scanner/modules/config.ts'
import { changeScannerSettings, parseScannerSettingsAction } from '../src/scanner/modules/settings.ts'

test.concurrent('npm updates resolve omitted and bare sources, pin compatible releases and preserve project settings', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-update-'))
  const name = `@example/scanner-${randomUUID()}`
  const versions: Record<string, unknown> = {}
  let unavailable = false
  const server = Bun.serve({ port: 0, fetch(request) {
    const url = new URL(request.url)
    if (url.pathname.endsWith('.tgz')) return new Response(Bun.file(path.join(root, path.basename(url.pathname))))
    if (unavailable) return new Response('Unavailable', { status: 503 })
    return Response.json({ name, versions, 'dist-tags': { latest: '2.0.0' } })
  } })
  try {
    await cp(path.resolve(import.meta.dir, '../test/fixtures/flows'), root, { recursive: true })
    const pkg = path.join(root, 'package')
    await mkdir(pkg)
    for (const version of ['1.0.0', '1.1.0', '2.0.0']) {
      const manifest = { name, version, groma: { scanner: { id: 'sample', entry: './index.js', discovery: {
        technologies: ['sample'], rules: [], compatibility: { groma: version === '2.0.0' ? '^9.0.0' : packageJson.version },
      } } } }
      await writeFile(path.join(pkg, 'package.json'), JSON.stringify(manifest))
      await writeFile(path.join(pkg, 'index.js'), 'export default {}')
      const pack = Bun.spawn(['tar', '-czf', `${version}.tgz`, 'package'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
      const error = await new Response(pack.stderr).text()
      expect(await pack.exited, error).toBe(0)
      versions[version] = { ...manifest, dist: { tarball: `${server.url.origin}/${version}.tgz` } }
    }
    const options = { registry: server.url.href, cacheRoot: path.join(root, 'cache') }
    const config = { exclude: ['generated/**'], scanners: [
      { id: 'other', source: './other' },
      { id: 'sample', source: `${name}@1.0.0`, settings: { include: ['src/**'] } },
    ] }
    for (const source of [undefined, name]) {
      await writeScannerConfig(root, config)
      await changeScannerSettings(root, parseScannerSettingsAction({ action: 'update', id: 'sample', source }), options)
      expect(await readScannerConfig(root)).toEqual({ ...config, scanners: [config.scanners[0], {
        ...config.scanners[1], source: `${name}@1.1.0`,
      }] })
      expect((await configuredScannerModules(root, options)).find(item => item.id === 'sample')).toMatchObject({ status: 'found', version: '1.1.0' })
    }
    // Exact selection remains deliberate, even when a newer compatible release exists.
    await updateScanner(root, 'sample', `${name}@1.0.0`, options)
    expect(await readScannerConfig(root)).toEqual(config)
    await expect(updateScanner(root, 'sample', '@example/different@1.1.0', options)).rejects.toThrow('same npm package')
    await expect(updateScanner(root, 'other', undefined, options)).rejects.toThrow('local plugins')
    unavailable = true
    await expect(updateScanner(root, 'sample', undefined, options)).rejects.toThrow('HTTP 503')
    expect(await readScannerConfig(root)).toEqual(config)
  } finally {
    await server.stop(true)
    await rm(root, { recursive: true, force: true })
  }
})
