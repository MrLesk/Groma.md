import { expect, test } from 'bun:test'
import { scannerNotice, scannerSettingsState } from '../src/scanner/modules/settings.ts'
import type { ScannerSetting } from '../src/scanner/modules/settings-model.ts'
import type { ScannerDiscovery } from '../src/scanner/modules/discovery.ts'

function setting(id: string, status: ScannerSetting['status'], match: ScannerSetting['match'] = 'matched'): ScannerSetting {
  return { id, name: id, official: false, technologies: [id], matches: [], status, match, message: '' }
}

test.concurrent('support notices distinguish empty, partial, ready, unknown and failed projects', () => {
  expect(scannerNotice([], []).tone).toBe('neutral')
  expect(scannerNotice([setting('rust', 'available')], []).tone).toBe('warning')
  expect(scannerNotice([setting('react', 'ready'), setting('rust', 'missing')], []).tone).toBe('hint')
  expect(scannerNotice([setting('react', 'ready'), setting('rust', 'ready')], []).tone).toBe('neutral')
  expect(scannerNotice([setting('react', 'blocked'), setting('rust', 'ready')], []).tone).toBe('error')
  expect(scannerNotice([setting('custom', 'ready', 'unknown')], []).tone).toBe('hint')
  expect(scannerNotice([setting('unrelated', 'unchecked', 'none')], []).tone).toBe('neutral')
  expect(scannerNotice([], ['Declaration is invalid']).tone).toBe('hint')
})

test.concurrent('an installed equivalent plugin suppresses duplicate official recommendations but unknown plugins do not', () => {
  const finding = { technology: 'react', kind: 'framework' as const, file: 'ui/package.json', declaration: 'react dependency', version: '19.0.0' }
  const proposal: ScannerDiscovery = {
    findings: [finding], inventory: [], limits: [],
    recommendations: [{ id: 'react', package: '@groma/scanner-react', status: 'installable', evidence: [finding], reason: '', installSource: '@groma/scanner-react@1.0.0' }],
  }
  const custom = { id: 'custom', name: 'custom', version: '1.0.0', source: '/plugins/custom', entry: '/plugins/custom/index.ts', status: 'found' as const }
  const known = scannerSettingsState(proposal, [{ ...custom, discovery: { technologies: ['react'], rules: [] } }])
  expect(known.scanners.map(item => item.id)).toEqual(['custom'])
  expect(known.scanners[0]?.matches).toEqual(['ui/package.json'])
  const unknown = scannerSettingsState(proposal, [custom])
  expect(unknown.scanners.map(item => item.id)).toEqual(['custom', 'react'])
  expect(unknown.scanners[0]?.match).toBe('unknown')
  const blocked = scannerSettingsState(proposal, [{ ...custom, discovery: { technologies: ['react'], rules: [] } }], [
    { id: 'custom', package: 'found', project: 'blocked', message: 'Tool unavailable' },
  ])
  expect(blocked.scanners.map(item => item.id)).toEqual(['custom', 'react'])
  expect(blocked.notice.tone).toBe('error')
})
