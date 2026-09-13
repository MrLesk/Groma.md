import { expect, test } from 'bun:test'
import type { ScannerSetting, ScannerSettings } from '../src/scanner/modules/settings-model.ts'
import { scannerWarning } from '../src/viewers/web/settings/model.ts'

function settings(tone: ScannerSettings['notice']['tone'], statuses: ScannerSetting['status'][]): ScannerSettings {
  return { notice: { tone, message: '' }, limits: [], scanners: statuses.map((status, index) => ({
    id: String(index), name: '', official: true, technologies: [], matches: [], match: 'matched', status, message: '',
  })) }
}

test.concurrent('scanner warnings open a failed plugin before missing or recommended plugins', () => {
  expect(scannerWarning(settings('error', ['available', 'missing', 'blocked']))?.scannerId).toBe('2')
  expect(scannerWarning(settings('warning', ['available', 'missing']))?.scannerId).toBe('1')
  expect(scannerWarning(settings('warning', ['available']))?.scannerId).toBe('0')
})

test.concurrent('healthy and partial coverage states do not show scanner warnings', () => {
  expect(scannerWarning(settings('neutral', ['ready']))).toBeUndefined()
  expect(scannerWarning(settings('hint', ['ready', 'available']))).toBeUndefined()
})

test.concurrent('a settings load failure opens general settings and static exports have no warning', () => {
  expect(scannerWarning(settings('error', []))).toEqual({ scannerId: undefined })
  expect(scannerWarning(undefined)).toBeUndefined()
})
