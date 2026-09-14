import { expect, test } from 'bun:test'
import { withScannerUpgrades, type ScannerSettings } from '../src/scanner/modules/settings.ts'
import { scannerUpgradeAction } from '../src/scanner/modules/settings-model.ts'
import { scannerWarning } from '../src/viewers/web/settings/model.ts'

test.concurrent('upgrade checks preserve scan health and offer only a newer compatible version for the checked source', async () => {
  let unavailable = false
  const requests: string[] = []
  const server = Bun.serve({ port: 0, fetch(request) {
    requests.push(new URL(request.url).pathname)
    if (unavailable) return new Response('Unavailable', { status: 503 })
    const versions = Object.fromEntries(['1.0.0', '1.1.0', '2.0.0'].map(version => [version, {
      name: '@example/scanner', version,
      groma: { scanner: { id: 'sample', entry: './index.js', discovery: { compatibility: { groma: version === '2.0.0' ? '^9.0.0' : '^0.3.0' } } } },
    }]))
    return Response.json({ versions })
  } })
  const scanner = {
    id: 'sample', name: '@example/scanner', source: '@example/scanner@1.0.0', version: '1.0.0',
    official: false, technologies: ['sample'], matches: ['project.json'], match: 'matched' as const,
    status: 'ready' as const, message: 'Scan completed.',
  }
  const state: ScannerSettings = { scanners: [scanner,
    { ...scanner, id: 'local', source: './plugin' },
    { ...scanner, id: 'git', source: 'git+https://example.com/scanner#abc' },
    { ...scanner, id: 'missing', status: 'missing' },
  ], notice: { tone: 'neutral', message: '' }, limits: [] }
  try {
    const checked = await withScannerUpgrades(state, server.url.href)
    expect(requests).toHaveLength(1)
    expect(checked.scanners).toBe(state.scanners)
    expect(scannerWarning(checked)).toBeUndefined()
    expect(state.upgrades).toBeUndefined()
    expect(scannerUpgradeAction(scanner, checked.upgrades)).toEqual({ action: 'update', id: 'sample', source: '@example/scanner@1.1.0' })
    const updated = { ...scanner, version: '1.1.0', source: '@example/scanner@1.1.0' }
    expect(scannerUpgradeAction(updated, checked.upgrades)).toBeUndefined()
    expect((await withScannerUpgrades({ ...state, scanners: [updated] }, server.url.href)).upgrades).toEqual({})
    unavailable = true
    const failed = await withScannerUpgrades(state, server.url.href)
    expect(failed.upgrades?.[scanner.source]?.error).toContain('HTTP 503')
    expect(scannerUpgradeAction(scanner, failed.upgrades)).toBeUndefined()
    expect(failed.scanners).toBe(state.scanners)
    expect(scannerWarning(failed)).toBeUndefined()
  } finally { await server.stop(true) }
})
