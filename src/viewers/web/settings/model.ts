import type { ScannerSettings } from '../../../scanner/modules/settings-model.ts'

/** Only actionable scanner problems need a warning; recommendations alone do not. */
export function scannerWarning(settings: ScannerSettings | undefined): { scannerId?: string } | undefined {
  if (settings?.notice.tone !== 'warning' && settings?.notice.tone !== 'error') return undefined
  const scanner = settings.scanners.find(item => item.status === 'blocked')
    ?? settings.scanners.find(item => item.status === 'missing')
    ?? settings.scanners.find(item => item.match === 'matched' && item.status === 'available')
  return { scannerId: scanner?.id }
}
