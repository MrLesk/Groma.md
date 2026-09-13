import { expect, test } from 'bun:test'
import { scannerNotice, scannerSettingsState } from '../src/scanner/modules/settings.ts'
import { scannerGroups, scannerSettingAction, type ScannerSetting } from '../src/scanner/modules/settings-model.ts'
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

test.concurrent('scanner groups follow local availability while preserving project selection across restore and removal', () => {
  const installed = { ...setting('first', 'blocked'), source: 'first@1.0.0' }
  const missing = { ...setting('second', 'missing'), source: 'second@1.0.0' }
  const recommended = { ...setting('third', 'available'), installSource: 'third@1.0.0' }
  const scanners = [recommended, missing, installed]
  const ids = (items: ScannerSetting[]) => scannerGroups(items).map(group => group.scanners.map(item => item.id))
  expect(ids(scanners)).toEqual([['first'], ['second'], ['third']])
  expect(ids([recommended, { ...missing, status: 'ready' }, installed])).toEqual([['second', 'first'], ['third']])
  expect(ids([recommended, missing])).toEqual([['second'], ['third']])
  expect(scanners.map(item => item.id)).toEqual(['third', 'second', 'first'])
  expect(scannerSettingAction(missing)).toEqual({ action: 'restore', id: 'second' })
  expect(scannerSettingAction(recommended)).toEqual({ action: 'install', id: 'third' })
  expect(scannerSettingAction(installed)).toEqual({ action: 'retry' })
  expect(scannerSettingAction({ ...installed, status: 'unchecked' })).toBeUndefined()
  expect(scannerSettingAction({ ...installed, status: 'ready' })).toBeUndefined()
  expect(scannerNotice([{ ...installed, status: 'unchecked' }], []).tone).toBe('neutral')
})

test.concurrent('search filters every scanner group by identity or technology without losing its group', () => {
  const selected = { ...setting('one', 'ready'), name: '@team/worker', source: 'one@1.0.0', technologies: ['shared'] }
  const missing = { ...setting('two', 'missing'), source: 'two@1.0.0', technologies: ['other'] }
  const suggested = { ...setting('three', 'available'), technologies: ['shared'] }
  const scanners = [suggested, missing, selected]
  expect(scannerGroups(scanners, 'SHARED').map(group => group.scanners)).toEqual([[selected], [suggested]])
  expect(scannerGroups(scanners, 'worker').flatMap(group => group.scanners)).toEqual([selected])
  expect(scannerGroups(scanners, 'two').flatMap(group => group.scanners)).toEqual([missing])
  expect(scannerGroups(scanners, 'absent')).toEqual([])
  expect(scannerGroups(scanners, ' ').flatMap(group => group.scanners)).toEqual([selected, missing, suggested])
})

test.concurrent('an incompatible recommendation does not make a missing project selection appear installed', () => {
  const proposal: ScannerDiscovery = { findings: [], inventory: [], limits: [], recommendations: [
    { id: 'react', package: '@groma/scanner-react', status: 'incompatible', evidence: [], reason: 'Unsupported technology version' },
  ] }
  const state = scannerSettingsState(proposal, [{ id: 'react', source: '@groma/scanner-react@1.0.0', status: 'missing' }])
  expect(state.scanners[0]?.status).toBe('missing')
  const removed = scannerSettingsState(proposal, [{ id: 'react', source: '@groma/scanner-react@1.0.0', status: 'missing' }], [{ id: 'react', package: 'found', project: 'ready', message: '' }])
  expect(removed.scanners[0]?.status).toBe('missing')
  expect(scannerSettingAction(state.scanners[0]!)).toEqual({ action: 'restore', id: 'react' })
})
