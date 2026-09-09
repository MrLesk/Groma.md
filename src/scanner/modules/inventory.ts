import {
  readScannerConfig,
  writeScannerConfig,
} from './config.ts'
import type { ConfiguredScanner } from './config.ts'
import {
  defaultScannerCacheRoot,
  installNpmScanner,
  parseScannerSource,
  resolveScannerPackage,
} from './package.ts'

export type ScannerReadiness = 'built-in' | 'found' | 'missing'

export interface ScannerInventoryItem {
  id: string
  source: string
  status: ScannerReadiness
}

export interface FoundScannerModule extends ScannerInventoryItem {
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

export const embeddedScanner: ScannerInventoryItem = {
  id: 'typescript',
  source: 'embedded',
  status: 'built-in',
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
  return [embeddedScanner, ...configured.map(({ id, source, status }) => ({ id, source, status }))]
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
  const resolved = source.kind === 'npm'
    ? await installNpmScanner(source, cacheRoot(options), options.registry)
    : await resolveScannerPackage(source, cacheRoot(options))
  if (resolved === undefined) throw new Error(`scanner package not found: ${source.source}`)
  if (resolved.id === embeddedScanner.id || configured.some(scanner => scanner.id === resolved.id)) {
    throw new Error(`scanner id is already configured: ${resolved.id}`)
  }
  const scanner = { id: resolved.id, source: source.source }
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
    const resolved = await installNpmScanner(source, cacheRoot(options), options.registry)
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
