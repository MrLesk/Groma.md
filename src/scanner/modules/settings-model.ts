export interface ScannerSetting {
  id: string
  name: string
  source?: string
  version?: string
  official: boolean
  technologies: string[]
  matches: string[]
  match: 'matched' | 'none' | 'unknown'
  status: 'ready' | 'unchecked' | 'blocked' | 'missing' | 'available' | 'unavailable'
  message: string
  installSource?: string
}
export interface ScannerSettings {
  scanners: ScannerSetting[]
  notice: { tone: 'neutral' | 'hint' | 'warning' | 'error'; message: string }
  limits: string[]
}
export type ScannerSettingsAction =
  | { action: 'add'; source: string }
  | { action: 'install' | 'restore' | 'remove'; id: string }
  | { action: 'update'; id: string; source: string }
  | { action: 'check' }

export function scannerNotice(scanners: readonly ScannerSetting[], limits: readonly string[]): ScannerSettings['notice'] {
  if (scanners.some(scanner => scanner.status === 'blocked')) return { tone: 'error', message: 'A scanner needs attention. Saved architecture is available.' }
  const matched = scanners.filter(scanner => scanner.match === 'matched')
  const useful = matched.filter(scanner => scanner.status === 'ready' || scanner.status === 'unchecked')
  const covered = new Set(useful.flatMap(scanner => scanner.technologies))
  const gaps = matched.filter(scanner => scanner.technologies.some(technology => !covered.has(technology)))
  if (matched.length && !useful.length) return { tone: 'warning', message: 'No matching scanners installed. Saved architecture is available.' }
  if (gaps.length) return { tone: 'hint', message: 'More scanner support available.' }
  if (limits.length) return { tone: 'hint', message: 'Scanner support could not be fully determined.' }
  if (scanners.some(scanner => scanner.match === 'unknown' || (scanner.match === 'matched' && scanner.status === 'unchecked'))) return { tone: 'hint', message: 'Scanner support needs checking.' }
  return { tone: 'neutral', message: matched.length ? '' : 'No source project detected. Showing saved architecture.' }
}

export function scannerSettingLabel(scanner: ScannerSetting): string {
  if (scanner.match === 'none' && scanner.status !== 'blocked' && scanner.status !== 'missing') return 'No matching project files'
  return { ready: 'Ready', unchecked: 'Not checked', blocked: 'Needs attention', missing: 'Package missing', available: 'Not installed', unavailable: 'No confirmed release' }[scanner.status]
}
