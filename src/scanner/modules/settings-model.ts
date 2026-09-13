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
  | { action: 'retry' }

export function scannerNotice(scanners: readonly ScannerSetting[], limits: readonly string[]): ScannerSettings['notice'] {
  if (scanners.some(scanner => scanner.status === 'blocked')) return { tone: 'error', message: 'A scanner needs attention. Saved architecture is available.' }
  const matched = scanners.filter(scanner => scanner.match === 'matched')
  const useful = matched.filter(scanner => scanner.status === 'ready' || scanner.status === 'unchecked')
  const covered = new Set(useful.flatMap(scanner => scanner.technologies))
  const gaps = matched.filter(scanner => scanner.technologies.some(technology => !covered.has(technology)))
  if (matched.length && !useful.length) return { tone: 'warning', message: 'No matching scanners installed. Saved architecture is available.' }
  if (gaps.length) return { tone: 'hint', message: 'More scanner support available.' }
  if (limits.length) return { tone: 'hint', message: 'Scanner support could not be fully determined.' }
  if (scanners.some(scanner => scanner.match === 'unknown')) return { tone: 'hint', message: 'Project match unknown for some scanners.' }
  return { tone: 'neutral', message: matched.length ? '' : 'No source project detected. Showing saved architecture.' }
}

export function scannerSettingLabel(scanner: ScannerSetting): string {
  if (scanner.status === 'blocked') return scanner.message
  if (scanner.match === 'none' && scanner.status !== 'missing') return 'No matching project files'
  return { ready: '', unchecked: '', missing: 'Package missing', available: 'Not installed', unavailable: 'No confirmed release' }[scanner.status]
}

/** Project selection and local package availability are different responsibilities. */
export function scannerGroups(scanners: readonly ScannerSetting[], query = '') {
  const search = query.trim().toLocaleLowerCase()
  const matching = scanners.filter(scanner => [scanner.id, scanner.name, ...scanner.technologies]
    .some(value => value.toLocaleLowerCase().includes(search)))
  return [
    { title: 'Installed', scanners: matching.filter(scanner => scanner.source && scanner.status !== 'missing') },
    { title: 'Missing on this computer', scanners: matching.filter(scanner => scanner.source && scanner.status === 'missing') },
    { title: 'Recommended', scanners: matching.filter(scanner => !scanner.source) },
  ].filter(group => group.scanners.length)
}

export function scannerSettingAction(scanner: ScannerSetting): ScannerSettingsAction | undefined {
  if (scanner.source && scanner.status === 'blocked') return { action: 'retry' }
  if (scanner.source) return scanner.status === 'missing' ? { action: 'restore', id: scanner.id } : undefined
  return scanner.installSource ? { action: 'install', id: scanner.id } : undefined
}

export function scannerMatchReason(scanner: ScannerSetting): string {
  const folders = [...new Set(scanner.matches.map(file => file.includes('/') ? file.slice(0, file.lastIndexOf('/') + 1) : 'project root'))]
  if (!folders.length) return scanner.match === 'unknown' ? 'Project match unknown' : 'No matching project files'
  return `Found in ${folders[0]}${folders.length > 1 ? ` and ${folders.length - 1} more folders` : ''}`
}
