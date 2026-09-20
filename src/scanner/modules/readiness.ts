import { configuredScannerModules, type FoundScannerModule, type ScannerResolutionOptions } from './inventory.ts'
import ignore from 'ignore'
import { importScanner, scannerSourcesExcluded } from '../registry.ts'
import { discoverScanners } from './discovery.ts'
import { readScannerConfig } from './config.ts'

export interface ProjectReadiness {
  id: string
  package: 'found' | 'missing'
  project: 'ready' | 'blocked' | 'unchecked'
  message: string
}

async function sourceReadiness(
  root: string, module: FoundScannerModule, excluded: (file: string) => boolean,
): Promise<Pick<ProjectReadiness, 'project' | 'message'>> {
  const scanner = await importScanner(module.entry, module.id)
  if (scanner.checkReadiness === undefined) return { project: 'unchecked',
    message: 'No readiness check; project compatibility is established during scan.' }
  if (await scannerSourcesExcluded(scanner, root, excluded, module.settings)) {
    return { project: 'ready', message: 'All source files are excluded.' }
  }
  await scanner.checkReadiness(root, module.settings)
  return { project: 'ready', message: 'Preparation check passed; compilation is checked during scan.' }
}

/** This explicit check executes enabled plugins; the package inventory stays read-only. */
export async function checkScannerReadiness(
  root: string,
  options: ScannerResolutionOptions = {},
): Promise<ProjectReadiness[]> {
  const results: ProjectReadiness[] = []
  const config = await readScannerConfig(root)
  const exclusions = ignore({ ignorecase: false }).add(config.exclude ?? [])
  const modules = await configuredScannerModules(root, options)
  const proposal = modules.some(module => module.status === 'found' && module.discovery?.compatibility)
    ? await discoverScanners(root, options) : undefined
  for (const module of modules) {
    if (module.status === 'missing') {
      results.push({ id: module.id, package: 'missing', project: 'blocked',
        message: `Restore ${module.source} with groma scanner install, or restore its local path.` })
      continue
    }
    const compatibility = proposal?.recommendations.find(item => item.id === module.id && item.status === 'incompatible')
    if (compatibility) {
      results.push({ id: module.id, package: 'found', project: 'blocked', message: compatibility.reason })
      continue
    }
    try {
      results.push({ id: module.id, package: 'found',
        ...await sourceReadiness(root, module, file => exclusions.ignores(file)) })
    } catch (error) {
      results.push({ id: module.id, package: 'found', project: 'blocked',
        message: error instanceof Error ? error.message : String(error) })
    }
  }
  return results
}

export function formatReadiness(results: readonly ProjectReadiness[]): string {
  return results.map(item => `${item.id}\tpackage ${item.package}\tproject ${item.project}\t${item.message}`).join('\n')
}

export function requireScannerReadiness(results: readonly ProjectReadiness[]): void {
  const blocked = results.filter(item => item.project === 'blocked')
  if (blocked.length) throw new Error(formatReadiness(blocked))
}
