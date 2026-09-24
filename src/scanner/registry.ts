import { pathToFileURL } from 'node:url'

import type { ScannerPlugin, ScannerSettings, ScanObservation } from '@groma/scanner'

import { exclusion, exclusionPatterns, readScannerConfig, stringArray, type ScannerConfig } from './modules/config.ts'
import { configuredScannerModules } from './modules/inventory.ts'
import type {
  FoundScannerModule,
  ScannerResolutionOptions,
} from './modules/inventory.ts'
import { officialScannerCatalog } from './modules/official-catalog.ts'
import { discoverScanners } from './modules/discovery.ts'
import { compileWatchPatterns } from './watch-patterns.ts'

export class ScannerFailure extends Error {
  readonly scanner: string
  constructor(scanner: string, cause: unknown) {
    super(`${scanner}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause })
    this.scanner = scanner
  }
}

export interface ScannerRegistry {
  readonly scannerIds: readonly string[]
  collectObservations(repositoryRoot: string, changedFiles?: readonly string[], onScan?: (event: ScanEvent) => void): Promise<ScanBatch>
  watchesFile(relativePath: string): boolean
  /** In scanner id order, the scanners whose listing selects this file, before their exclusions, and those whose listing failed. */
  readersOfFile(repositoryRoot: string, file: string): Promise<FileReaders>
}

/** One scanner invocation starts once and ends on success or failure; skipped scanners emit neither. */
export interface ScanEvent {
  scanner: string
  type: 'start' | 'end'
}

export interface FileReaders {
  readers: string[]
  /** Each scanner whose listing threw, with the first line of its error. */
  failures: { scanner: string; message: string }[]
}


export interface ScanBatch {
  observations: ScanObservation[]
  failures: ScannerFailure[]
}

/** A configured scanner as the host runs it: its plugin with this project's settings and exclusions for it. */
export interface ConfiguredPlugin {
  plugin: ScannerPlugin
  settings?: ScannerSettings
  /** Whether a repository-relative path is excluded for this scanner: the global list, then the scanner's own. */
  excluded: (file: string) => boolean
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

/** A found scanner ready to run in this project, for scans and readiness checks alike. */
export async function configuredPlugin(module: FoundScannerModule, config: ScannerConfig): Promise<ConfiguredPlugin> {
  return {
    plugin: await importScanner(module.entry, module.id),
    ...(module.settings === undefined ? {} : { settings: module.settings }),
    excluded: exclusion(exclusionPatterns(config, module.id)),
  }
}

/** Skip analysis only when a nonempty source listing is fully outside the scanner's exclusions. */
export async function scannerSourcesExcluded({ plugin, settings, excluded }: ConfiguredPlugin, root: string): Promise<boolean> {
  const files = await plugin.listSourceFiles?.(root, settings)
  return files !== undefined && files.length > 0 && files.every(excluded)
}

function excludeEvidence(
  observation: ScanObservation,
  excluded: (file: string) => boolean,
): ScanObservation | undefined {
  const files = observation.files.filter(file => !excluded(file.file))
  if (files.length === observation.files.length && !observation.entryPoints?.some(entry => excluded(entry.file) || excluded(entry.declaration))) return observation
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
  const httpFacts = <Fact extends { operation: string }>(facts: Fact[]) => facts.filter(fact => operationIds.has(fact.operation))
  // Drop the whole claim: pruning targets could turn an uncertain call into a certain one.
  const invocations = observation.invocations?.filter(invocation => {
    return operationIds.has(invocation.source)
      && invocation.targets.every(target => operationIds.has(target))
      && (invocation.binding === undefined || paths.has(invocation.binding.file))
  })
  return {
    ...observation, files, roots,
    ...(observation.sourceUnits === undefined ? {} : {
      sourceUnits: observation.sourceUnits.filter(unit => paths.has(unit.primary))
        .map(unit => ({ ...unit, files: unit.files.filter(file => paths.has(file)) })),
    }),
    ...(observation.entryPoints === undefined ? {} : {
      entryPoints: observation.entryPoints.filter(entry => !excluded(entry.file) && !excluded(entry.declaration))
        .map(entry => ({ ...entry, files: entry.files.filter(file => paths.has(file)) }))
        .filter(entry => entry.files.length > 0),
    }),
    ...(operations === undefined ? {} : { operations, invocations }),
    // An excluded file is outside the architecture, so its endpoints stop competing for a request.
    // A remaining match can become unique; that follows the exclusion, unlike a pruned call target.
    ...(observation.httpEndpoints && { httpEndpoints: httpFacts(observation.httpEndpoints) }),
    ...(observation.httpRequests && { httpRequests: httpFacts(observation.httpRequests) }),
  }
}

export async function loadScannerRegistry(
  repositoryRoot: string,
  options: ScannerResolutionOptions = {},
): Promise<ScannerRegistry> {
  const config = await readScannerConfig(repositoryRoot)
  const globallyExcluded = exclusion(config.exclude ?? [])
  const modules = await configuredScannerModules(repositoryRoot, options)
  const found = modules.filter((module): module is FoundScannerModule => module.status === 'found')
  const proposal = found.some(module => module.discovery?.compatibility)
    ? await discoverScanners(repositoryRoot, options) : undefined
  const blocked = new Set(proposal?.recommendations.filter(item => item.status === 'incompatible').map(item => item.id))
  const scanners = await Promise.all(found.filter(module => !blocked.has(module.id)).map(module =>
    configuredPlugin(module, config).catch((error: unknown): ConfiguredPlugin => ({
      // Failed imports have no source subscription. Retry/settings reload the registry.
      plugin: { id: module.id, watch: { include: [], exclude: [] }, async scan() { throw error } },
      excluded: () => false,
    }))))
  const registry = createScannerRegistry(scanners)
  const discovery = compileWatchPatterns({ include: [
    ...officialScannerCatalog.flatMap(scanner => scanner.rules.flatMap(rule => rule.files)),
    ...found.flatMap(module => module.discovery?.rules.flatMap(rule => rule.files) ?? []),
  ], exclude: [] })
  return { ...registry, watchesFile: file => registry.watchesFile(file) || (!globallyExcluded(file) && discovery(file)) }
}

function firstLine(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0]!
}

/**
 * One source session retains complete evidence between selective rescans. Each scanner reads, watches and
 * reports within its own exclusions.
 */
export function createScannerRegistry(scanners: readonly ConfiguredPlugin[]): ScannerRegistry {
  const observations = new Map<ConfiguredPlugin, ScanObservation>()
  const pending = new Set(scanners)
  const watches = new Map(scanners.map(scanner => {
    const watched = compileWatchPatterns(scanner.plugin.watch)
    return [scanner, (file: string) => !scanner.excluded(file) && watched(file)] as const
  }))
  return {
    scannerIds: scanners.map(({ plugin }) => plugin.id),
    async readersOfFile(root, file) {
      const answer: FileReaders = { readers: [], failures: [] }
      const byId = [...scanners].sort((left, right) => (left.plugin.id < right.plugin.id ? -1 : 1))
      const listings = await Promise.allSettled(byId.map(async ({ plugin, settings }) => await plugin.listSourceFiles?.(root, settings)))
      for (const [index, listing] of listings.entries()) {
        const scanner = byId[index]!.plugin.id
        if (listing.status === 'rejected') answer.failures.push({ scanner, message: firstLine(listing.reason) })
        else if (listing.value?.includes(file)) answer.readers.push(scanner)
      }
      return answer
    },
    watchesFile(relativePath) {
      return [...watches.values()].some(matches => matches(relativePath))
    },
    async collectObservations(root, changedFiles, onScan) {
      for (const [scanner, matches] of watches) {
        if (!changedFiles || changedFiles.some(matches)) pending.add(scanner)
      }
      const selected = [...pending]
      // Every scanner finishes before a failure surfaces, so none keeps a child process in the repository.
      const results = await Promise.allSettled(selected.map(async scanner => {
        const { plugin, settings, excluded } = scanner
        let result: ScanObservation | undefined
        if (!await scannerSourcesExcluded(scanner, root)) {
          try {
            onScan?.({ scanner: plugin.id, type: 'start' })
            result = await plugin.scan(root, settings, excluded)
          } finally {
            onScan?.({ scanner: plugin.id, type: 'end' })
          }
        }
        const observation = result && excludeEvidence(result, excluded)
        if (observation) observations.set(scanner, observation)
        else observations.delete(scanner)
        pending.delete(scanner)
      }))
      const failures: ScannerFailure[] = []
      for (const [index, result] of results.entries()) {
        if (result.status !== 'rejected') continue
        const scanner = selected[index]!
        observations.delete(scanner)
        failures.push(new ScannerFailure(scanner.plugin.id, result.reason))
      }
      return {
        observations: scanners.map(scanner => observations.get(scanner)).filter(observation => observation !== undefined),
        failures,
      }
    },
  }
}
