import { pathToFileURL } from 'node:url'

import type { ScannerPlugin, ScanObservation } from '@groma/scanner'
import typeScriptScanner from '@groma/scanner-typescript'

import { configuredScannerModules } from './modules/inventory.ts'
import type {
  FoundScannerModule,
  ScannerModuleLocation,
  ScannerResolutionOptions,
} from './modules/inventory.ts'
import { parseScannerSource } from './modules/package.ts'

export interface ScannerRegistry {
  collectObservations(repositoryRoot: string): Promise<ScanObservation[]>
  matchesFile(relativePath: string): boolean
}

function scannerPlugin(value: unknown, expectedId: string): ScannerPlugin {
  if (value === null || typeof value !== 'object') {
    throw new Error(`scanner ${expectedId} must export one default ScannerPlugin object`)
  }
  const candidate = value as Partial<ScannerPlugin>
  if (candidate.id !== expectedId) {
    throw new Error(`scanner ${expectedId} default export has id ${String(candidate.id)}`)
  }
  if (typeof candidate.matchesFile !== 'function' || typeof candidate.scan !== 'function') {
    throw new Error(`scanner ${expectedId} must export matchesFile and scan functions`)
  }
  return candidate as ScannerPlugin
}

async function importScanner(entry: string, id: string): Promise<ScannerPlugin> {
  const module: unknown = await import(pathToFileURL(entry).href)
  const exported = module as { default?: unknown }
  return scannerPlugin(exported.default, id)
}

function requireFoundModules(
  repositoryRoot: string,
  modules: readonly ScannerModuleLocation[],
): FoundScannerModule[] {
  const missing = modules.find(module => module.status === 'missing')
  if (missing === undefined) {
    return modules.filter((module): module is FoundScannerModule => module.status === 'found')
  }
  const source = parseScannerSource(repositoryRoot, missing.source)
  if (source.kind === 'npm') {
    throw new Error(`scanner ${missing.id} is missing; run groma scanner install`)
  }
  throw new Error(
    `scanner ${missing.id} is missing at ${missing.source}; restore it or run groma scanner remove ${missing.id}`,
  )
}

export async function loadScannerRegistry(
  repositoryRoot: string,
  options: ScannerResolutionOptions = {},
): Promise<ScannerRegistry> {
  const modules = await configuredScannerModules(repositoryRoot, options)
  const found = requireFoundModules(repositoryRoot, modules)
  const optional = await Promise.all(found.map(module => {
    return importScanner(module.entry, module.id)
  }))
  const scanners: readonly ScannerPlugin[] = [typeScriptScanner, ...optional]
  return {
    matchesFile(relativePath) {
      return scanners.some(scanner => scanner.matchesFile(relativePath))
    },
    async collectObservations(root) {
      // Every scanner finishes before a failure surfaces, so none keeps a child process in the repository.
      const results = await Promise.allSettled(scanners.map(scanner => scanner.scan(root)))
      const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
      if (failed !== undefined) throw failed.reason
      return results
        .map(result => (result as PromiseFulfilledResult<ScanObservation | undefined>).value)
        .filter(observation => observation !== undefined)
    },
  }
}
