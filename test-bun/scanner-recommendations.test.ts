import { expect, test } from 'bun:test'
import { recommendScanners, type TechnologyFinding, type OfficialScanner } from '../src/scanner/modules/catalog.ts'
import { parseScannerDiscovery } from '@groma/scanner'
import { selectPublishedScanner, type PublishedScanner } from '../src/scanner/modules/published.ts'

const catalog: OfficialScanner[] = [{
  id: 'language', package: 'example-scanner', description: '', technologies: ['language'], rules: [],
}]

test.concurrent('detection recommends installation without interpreting language version syntax', () => {
  for (const version of [undefined, '7.1.0-dev.20260905.1', '^7.0.0', 'net10.0', '1.27.1']) {
    const finding: TechnologyFinding = { technology: 'language', kind: 'language', file: 'app/project', declaration: 'project', version }
    const offered = recommendScanners([finding], [], catalog)
    expect(offered[0]?.installSource).toBe('example-scanner')
    expect(recommendScanners([finding], [{ id: 'language', source: 'example-scanner@1.0.0', status: 'missing' }], catalog)[0]?.installSource).toBeUndefined()
  }
  expect(recommendScanners([], [], catalog)).toEqual([])
  expect(parseScannerDiscovery({ technologies: [], rules: [], compatibility: { groma: '^0.3.0' } }).compatibility).toEqual({ groma: '^0.3.0' })
})

function release(version: string, groma = '^0.3.0', os = ['linux']): PublishedScanner {
  return { name: 'example-scanner', version, os, cpu: ['x64'],
    groma: { scanner: { id: 'language', entry: './index.js', discovery: { compatibility: { groma } } } } }
}
const host = { groma: '0.3.0', os: 'linux', cpu: 'x64' }

test.concurrent('installation chooses the newest published stable release for Groma and this computer', () => {
  const versions = [release('1.0.0'), release('1.1.0'), release('2.0.0', '^0.4.0'), release('3.0.0', '^0.3.0', ['darwin']), release('4.0.0-beta.1')]
  expect(selectPublishedScanner('example-scanner', Object.fromEntries(versions.map(item => [item.version, item])), host).version).toBe('1.1.0')
  expect(() => selectPublishedScanner('example-scanner', {}, host)).toThrow('no published stable scanner release')
  expect(() => selectPublishedScanner('example-scanner', { one: release('1.0.0', '^0.4.0') }, host)).toThrow('Update Groma')
  expect(() => selectPublishedScanner('example-scanner', { one: release('1.0.0', '^0.3.0', ['darwin']) }, host)).toThrow('linux/x64')
})
