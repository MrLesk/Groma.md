import {
  readScannerConfig,
  writeScannerConfig,
} from './config.ts'
import type { ConfiguredScanner } from './config.ts'
import {
  defaultScannerCacheRoot,
  installScannerPackage,
  parseScannerSource,
  resolveScannerPackage,
  type ScannerSource,
  type ResolvedScannerPackage,
} from './package.ts'

export type ScannerReadiness = 'found' | 'missing'

export interface ScannerInventoryItem {
  id: string
  source: string
  status: ScannerReadiness
}

export interface FoundScannerModule extends ScannerInventoryItem, ConfiguredScanner {
  name: string
  version: string
  discovery?: ResolvedScannerPackage['discovery']
  entry: string
  status: 'found'
}

export interface MissingScannerModule extends ScannerInventoryItem {
  status: 'missing'
}

export type ScannerModuleLocation = FoundScannerModule | MissingScannerModule

export interface ScannerResolutionOptions {
  cacheRoot?: string
}

export interface ScannerInstallOptions extends ScannerResolutionOptions {
  registry?: string
}

function cacheRoot(options: ScannerResolutionOptions): string {
  return options.cacheRoot ?? defaultScannerCacheRoot()
}

async function moduleLocation(
  repositoryRoot: string,
  configured: ConfiguredScanner,
  options: ScannerResolutionOptions,
): Promise<ScannerModuleLocation> {
  const source = parseScannerSource(repositoryRoot, configured.source)
  const resolved = await resolveScannerPackage(source, cacheRoot(options))
  if (resolved === undefined) {
    return { ...configured, status: 'missing' }
  }
  if (resolved.id !== configured.id) {
    throw new Error(
      `configured scanner ${configured.id} resolves to manifest id ${resolved.id}`,
    )
  }
  return {
    ...configured,
    entry: resolved.entry,
    name: resolved.name,
    version: resolved.version,
    discovery: resolved.discovery,
    status: 'found',
  }
}

export async function configuredScannerModules(
  repositoryRoot: string,
  options: ScannerResolutionOptions = {},
): Promise<ScannerModuleLocation[]> {
  const config = await readScannerConfig(repositoryRoot)
  const configured = config.scanners
  return Promise.all(configured.map(scanner => {
    return moduleLocation(repositoryRoot, scanner, options)
  }))
}

export async function scannerInventory(
  repositoryRoot: string,
  options: ScannerResolutionOptions = {},
): Promise<ScannerInventoryItem[]> {
  const configured = await configuredScannerModules(repositoryRoot, options)
  return configured.map(({ id, source, status }) => ({ id, source, status }))
}

export async function addScanner(
  repositoryRoot: string,
  input: string,
  options: ScannerInstallOptions = {},
): Promise<ScannerInventoryItem> {
  const source = parseScannerSource(repositoryRoot, input)
  const config = await readScannerConfig(repositoryRoot)
  const configured = config.scanners
  if (configured.some(scanner => scanner.source === source.source)) {
    throw new Error(`scanner source is already configured: ${source.source}`)
  }
  const installed = await installScannerPackage(source, cacheRoot(options), options.registry)
  const resolved = installed.package
  if (configured.some(scanner => scanner.id === resolved.id)) {
    throw new Error(`scanner id is already configured: ${resolved.id}`)
  }
  const scanner = { id: resolved.id, source: installed.source }
  await writeScannerConfig(repositoryRoot, { ...config, scanners: [...configured, scanner] })
  return { ...scanner, status: 'found' }
}

export async function installScanners(
  repositoryRoot: string,
  options: ScannerInstallOptions = {},
): Promise<number> {
  const config = await readScannerConfig(repositoryRoot)
  const configured = config.scanners
  let installed = 0
  for (const scanner of configured) {
    const source = parseScannerSource(repositoryRoot, scanner.source)
    if (source.kind === 'local') continue
    const { package: resolved } = await installScannerPackage(source, cacheRoot(options), options.registry)
    if (resolved.id !== scanner.id) {
      throw new Error(`configured scanner ${scanner.id} resolves to manifest id ${resolved.id}`)
    }
    installed += 1
  }
  return installed
}

export async function removeScanner(
  repositoryRoot: string,
  id: string,
): Promise<string> {
  const config = await readScannerConfig(repositoryRoot)
  const configured = config.scanners
  if (!configured.some(scanner => scanner.id === id)) {
    throw new Error(`scanner is not configured: ${id}`)
  }
  await writeScannerConfig(
    repositoryRoot,
    { ...config, scanners: configured.filter(scanner => scanner.id !== id) },
  )
  return id
}

function samePackage(current: ScannerSource, replacement: ScannerSource): boolean {
  if (current.kind === 'npm' && replacement.kind === 'npm') return current.name === replacement.name
  if (current.kind === 'git' && replacement.kind === 'git') return current.repository === replacement.repository
  return false
}

export async function updateScanner(
  repositoryRoot: string,
  id: string,
  input: string,
  options: ScannerInstallOptions = {},
): Promise<ScannerInventoryItem> {
  const config = await readScannerConfig(repositoryRoot)
  const selected = config.scanners.find(scanner => scanner.id === id)
  if (selected === undefined) throw new Error(`scanner is not configured: ${id}`)
  const current = parseScannerSource(repositoryRoot, selected.source)
  const replacement = parseScannerSource(repositoryRoot, input)
  if (!samePackage(current, replacement)) {
    throw new Error('scanner update must keep the same npm package or Git repository; local plugins run from their configured path')
  }
  const installed = await installScannerPackage(replacement, cacheRoot(options), options.registry)
  if (installed.package.id !== id) {
    throw new Error(`replacement scanner id ${installed.package.id} does not match ${id}`)
  }
  const updated = { ...selected, source: installed.source }
  await writeScannerConfig(repositoryRoot, {
    ...config, scanners: config.scanners.map(scanner => scanner.id === id ? updated : scanner),
  })
  return { id, source: updated.source, status: 'found' }
}

/** Restore one project selection without installing unrelated configured packages. */
export async function restoreScanner(repositoryRoot: string, id: string, options: ScannerInstallOptions = {}): Promise<void> {
  const configured = (await readScannerConfig(repositoryRoot)).scanners.find(scanner => scanner.id === id)
  if (!configured) throw new Error(`scanner is not configured: ${id}`)
  const source = parseScannerSource(repositoryRoot, configured.source)
  if (source.kind === 'local') throw new Error(`Restore the local scanner directory: ${configured.source}`)
  const installed = await installScannerPackage(source, cacheRoot(options), options.registry)
  if (installed.package.id !== id) throw new Error(`restored scanner id ${installed.package.id} does not match ${id}`)
}
