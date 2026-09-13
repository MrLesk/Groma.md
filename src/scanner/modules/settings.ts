import { scannerNotice, type ScannerSetting, type ScannerSettings, type ScannerSettingsAction } from './settings-model.ts'
export * from './settings-model.ts'
import type { ScannerDiscovery } from './discovery.ts'
import { discoverScanners } from './discovery.ts'
import { officialScannerCatalog } from './catalog.ts'
import { configuredScannerModules, addScanner, removeScanner, updateScanner, restoreScanner } from './inventory.ts'
import type { ScannerInstallOptions } from './inventory.ts'
import type { ScannerModuleLocation } from './inventory.ts'
import type { ProjectReadiness } from './readiness.ts'

function readinessStatus(check: ProjectReadiness): ScannerSetting['status'] {
  if (check.package === 'missing') return 'missing'
  return check.project
}

function projectMatch(technologies: string[], matches: string[]): ScannerSetting['match'] {
  if (!technologies.length) return 'unknown'
  return matches.length ? 'matched' : 'none'
}

function installedSetting(module: ScannerModuleLocation, proposal: ScannerDiscovery, checks: readonly ProjectReadiness[]): ScannerSetting {
  const official = officialScannerCatalog.find(item => item.id === module.id)
  const metadata = module.status === 'found' ? module.discovery : undefined
  const technologies = metadata?.technologies ?? official?.technologies ?? []
  const matches = [...new Set(proposal.findings.filter(finding => technologies.includes(finding.technology)).map(finding => finding.file))]
  const readiness = checks.find(check => check.id === module.id)
  const base: ScannerSetting = {
    id: module.id, name: module.status === 'found' ? module.name : module.id,
    source: module.source, version: module.status === 'found' ? module.version : undefined,
    official: official !== undefined, technologies, matches,
    match: projectMatch(technologies, matches),
    status: module.status === 'missing' ? 'missing' : 'unchecked', message: '',
  }
  if (readiness && module.status === 'found') {
    base.status = readinessStatus(readiness)
    base.message = readiness.message
  }
  if (module.status === 'missing') base.message = `Package missing: ${module.source}`
  const candidate = proposal.recommendations.find(item => item.id === module.id)
  if (module.status === 'found' && candidate?.status === 'incompatible') { base.status = 'blocked'; base.message = candidate.reason }
  return base
}

/** Product state shared by terminal, web and CLI; no architecture concepts or guessed coverage scores. */
export function scannerSettingsState(proposal: ScannerDiscovery, modules: readonly ScannerModuleLocation[], checks: readonly ProjectReadiness[] = []): ScannerSettings {
  const scanners = modules.map(module => installedSetting(module, proposal, checks))
  const covered = new Set(scanners.filter(item => item.match === 'matched' && ['ready', 'unchecked'].includes(item.status)).flatMap(item => item.technologies))
  for (const candidate of proposal.recommendations) {
    if (modules.some(module => module.id === candidate.id)) continue
    const official = officialScannerCatalog.find(item => item.id === candidate.id)
    const technologies = official?.technologies ?? []
    if (technologies.length && technologies.every(technology => covered.has(technology))) continue
    scanners.push({
      id: candidate.id, name: candidate.package, official: official !== undefined,
      technologies,
      matches: [...new Set(candidate.evidence.map(finding => finding.file))],
      match: candidate.evidence.length ? 'matched' : 'none',
      status: 'available',
      message: candidate.reason, installSource: candidate.installSource,
    })
  }
  return { scanners, notice: scannerNotice(scanners, proposal.limits), limits: proposal.limits }
}

export async function readScannerSettings(root: string, checks: readonly ProjectReadiness[] = [], options: ScannerInstallOptions = {}): Promise<ScannerSettings> {
  try {
    const [proposal, modules] = await Promise.all([discoverScanners(root, options), configuredScannerModules(root, options)])
    return scannerSettingsState(proposal, modules, checks)
  } catch (error) {
    return { scanners: [], notice: { tone: 'error', message: error instanceof Error ? error.message : String(error) }, limits: [] }
  }
}

export async function changeScannerSettings(root: string, action: ScannerSettingsAction, options: ScannerInstallOptions = {}): Promise<void> {
  switch (action.action) {
    case 'add': await addScanner(root, action.source, options); return
    case 'remove': await removeScanner(root, action.id); return
    case 'restore': await restoreScanner(root, action.id, options); return
    case 'update': await updateScanner(root, action.id, action.source, options); return
    case 'retry': return
    case 'install-recommended': case 'install-missing': await installGroup(root, action.action, options); return
    case 'install': {
      const item = (await readScannerSettings(root, [], options)).scanners.find(scanner => scanner.id === action.id)
      if (!item?.installSource) throw new Error('This scanner is no longer recommended. Review the current scanner list.')
      await addScanner(root, item.installSource, options)
    }
  }
}

async function installGroup(root: string, group: 'install-recommended' | 'install-missing', options: ScannerInstallOptions) {
  const settings = await readScannerSettings(root, [], options)
  const selected = settings.scanners.filter(item => group === 'install-recommended' ? !item.source && item.installSource : item.source && item.status === 'missing')
  const errors: string[] = []
  for (const item of selected) {
    try {
      if (group === 'install-recommended') await addScanner(root, item.installSource!, options)
      else await restoreScanner(root, item.id, options)
    } catch (error) { errors.push(`${item.id}: ${error instanceof Error ? error.message : String(error)}`) }
  }
  if (errors.length) throw new Error(errors.join('\n'))
}

export function parseScannerSettingsAction(input: unknown): ScannerSettingsAction {
  if (!input || typeof input !== 'object') throw new Error('Scanner action required')
  const value = input as Record<string, unknown>
  const action = value.action
  if (action === 'retry' || action === 'install-recommended' || action === 'install-missing') return { action }
  if (action === 'add' && typeof value.source === 'string') return { action, source: value.source }
  if (typeof value.id !== 'string') throw new Error('Scanner id required')
  if (action === 'update' && typeof value.source === 'string') return { action, id: value.id, source: value.source }
  if (action === 'install' || action === 'restore' || action === 'remove') return { action, id: value.id }
  throw new Error('Unknown scanner action')
}
