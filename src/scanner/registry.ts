import path from 'node:path'
import { pathToFileURL } from 'node:url'

import ignore from 'ignore'

import type { ScannerPlugin, ScanObservation } from '@groma/scanner'

import { readScannerConfig } from './modules/config.ts'
import { configuredScannerModules } from './modules/inventory.ts'
import type {
  FoundScannerModule,
  ScannerModuleLocation,
  ScannerResolutionOptions,
} from './modules/inventory.ts'
import { parseScannerSource } from './modules/package.ts'
import { compileWatchPatterns } from './watch-patterns.ts'

export interface ScannerRegistry {
  collectObservations(repositoryRoot: string, changedFiles?: readonly string[]): Promise<ScanObservation[]>
  watchesFile(relativePath: string): boolean
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function scannerPlugin(value: unknown, expectedId: string): ScannerPlugin {
  if (value === null || typeof value !== 'object') {
    throw new Error(`scanner ${expectedId} must export one default ScannerPlugin object`)
  }
  const candidate = value as Partial<ScannerPlugin>
  if (candidate.id !== expectedId) {
    throw new Error(`scanner ${expectedId} default export has id ${String(candidate.id)}`)
  }
  if (!stringArray(candidate.watch?.include) || !stringArray(candidate.watch?.exclude)
    || typeof candidate.scan !== 'function') {
    throw new Error(`scanner ${expectedId} must export watch.include and watch.exclude string arrays and a scan function`)
  }
  return candidate as ScannerPlugin
}

export async function importScanner(entry: string, id: string): Promise<ScannerPlugin> {
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
  if (source.kind !== 'local') {
    throw new Error(`scanner ${missing.id} is missing; run groma scanner install`)
  }
  throw new Error(
    `scanner ${missing.id} is missing at ${missing.source}; restore it or run groma scanner remove ${missing.id}`,
  )
}

function excludeEvidence(
  observation: ScanObservation,
  excluded: (file: string) => boolean,
): ScanObservation | undefined {
  const files = observation.files.filter(file => !excluded(file.file))
  if (files.length === observation.files.length) return observation
  if (files.length === 0) return undefined
  const paths = new Set(files.map(file => file.file))
  const rootIds = new Set(files.flatMap(file => file.roots))
  const byId = new Map(observation.roots.map(root => [root.id, root]))
  for (const id of rootIds) {
    const parent = byId.get(id)?.parent
    if (parent !== undefined) rootIds.add(parent)
  }
  const roots = observation.roots.filter(root => rootIds.has(root.id))
  const operations = observation.operations?.filter(operation => paths.has(operation.file))
  const operationIds = new Set(operations?.map(operation => operation.id))
  // Drop the whole claim: pruning targets could turn an uncertain call into a certain one.
  const invocations = observation.invocations?.filter(invocation => {
    return operationIds.has(invocation.source)
      && invocation.targets.every(target => operationIds.has(target))
      && (invocation.binding === undefined || paths.has(invocation.binding.file))
  })
  return {
    ...observation, files, roots,
    ...(operations === undefined ? {} : { operations, invocations }),
  }
}

export async function loadScannerRegistry(
  repositoryRoot: string,
  options: ScannerResolutionOptions = {},
): Promise<ScannerRegistry> {
  const config = await readScannerConfig(repositoryRoot)
  const matcher = ignore({ ignorecase: false }).add(config.exclude ?? [])
  const excluded = (file: string) => matcher.ignores(file.split(path.sep).join('/'))
  const modules = await configuredScannerModules(repositoryRoot, options)
  const found = requireFoundModules(repositoryRoot, modules)
  const scanners = await Promise.all(found.map(async module => {
    const scanner = await importScanner(module.entry, module.id)
    return { ...scanner, scan: (root: string) => scanner.scan(root, module.settings) }
  }))
  return createScannerRegistry(scanners, excluded)
}

/** One source session retains complete evidence between selective rescans. */
export function createScannerRegistry(
  scanners: readonly ScannerPlugin[],
  excluded: (file: string) => boolean,
): ScannerRegistry {
  const observations = new Map<ScannerPlugin, ScanObservation>()
  const pending = new Set(scanners)
  const subscriptions = scanners.map(scanner => ({ scanner, matches: compileWatchPatterns(scanner.watch) }))
  return {
    watchesFile(relativePath) {
      return !excluded(relativePath) && subscriptions.some(subscription => subscription.matches(relativePath))
    },
    async collectObservations(root, changedFiles) {
      const files = changedFiles?.filter(file => !excluded(file))
      for (const { scanner, matches } of subscriptions) {
        if (!files || files.some(matches)) pending.add(scanner)
      }
      const selected = [...pending]
      // Every scanner finishes before a failure surfaces, so none keeps a child process in the repository.
      const results = await Promise.allSettled(selected.map(async scanner => {
        const result = await scanner.scan(root)
        const observation = result && excludeEvidence(result, excluded)
        if (observation) observations.set(scanner, observation)
        else observations.delete(scanner)
        pending.delete(scanner)
      }))
      const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
      if (failed !== undefined) throw failed.reason
      return scanners.map(scanner => observations.get(scanner))
        .filter(observation => observation !== undefined)
    },
  }
}
