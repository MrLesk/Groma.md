import path from 'node:path'
import { pathToFileURL } from 'node:url'

import ignore from 'ignore'

import type { ScannerPlugin, ScannerSettings, ScanObservation } from '@groma/scanner'

import { readScannerConfig } from './modules/config.ts'
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
  /** In scanner id order, the scanners that would analyze this file now and those whose listing failed; the caller excludes configured patterns first. */
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

/** Skip analysis only when a nonempty source listing is fully outside the configured scope. */
export async function scannerSourcesExcluded(
  scanner: ScannerPlugin, root: string, excluded: (file: string) => boolean, settings?: ScannerSettings,
): Promise<boolean> {
  const files = await scanner.listSourceFiles?.(root, settings)
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
  const matcher = ignore({ ignorecase: false }).add(config.exclude ?? [])
  const excluded = (file: string) => matcher.ignores(file.split(path.sep).join('/'))
  const modules = await configuredScannerModules(repositoryRoot, options)
  const found = modules.filter((module): module is FoundScannerModule => module.status === 'found')
  const proposal = found.some(module => module.discovery?.compatibility)
    ? await discoverScanners(repositoryRoot, options) : undefined
  const blocked = new Set(proposal?.recommendations.filter(item => item.status === 'incompatible').map(item => item.id))
  const scanners = await Promise.all(found.filter(module => !blocked.has(module.id)).map(async module => {
    try {
      const scanner = await importScanner(module.entry, module.id)
      const { listSourceFiles } = scanner
      return { ...scanner, scan: (root: string, _settings?: ScannerSettings, excluded?: (file: string) => boolean) => scanner.scan(root, module.settings, excluded),
        ...(listSourceFiles === undefined ? {} : { listSourceFiles: (root: string) => listSourceFiles.call(scanner, root, module.settings) }) }
    } catch (error) {
      // Failed imports have no source subscription. Retry/settings reload the registry.
      return { id: module.id, watch: { include: [], exclude: [] }, async scan() { throw error } }
    }
  }))
  const registry = createScannerRegistry(scanners, excluded)
  const discovery = compileWatchPatterns({ include: [
    ...officialScannerCatalog.flatMap(scanner => scanner.rules.flatMap(rule => rule.files)),
    ...found.flatMap(module => module.discovery?.rules.flatMap(rule => rule.files) ?? []),
  ], exclude: [] })
  return { ...registry, watchesFile: file => registry.watchesFile(file) || (!excluded(file) && discovery(file)) }
}

function firstLine(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0]!
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
    scannerIds: scanners.map(scanner => scanner.id),
    async readersOfFile(root, file) {
      const answer: FileReaders = { readers: [], failures: [] }
      const byId = [...scanners].sort((left, right) => (left.id < right.id ? -1 : 1))
      const listings = await Promise.allSettled(byId.map(async scanner => await scanner.listSourceFiles?.(root)))
      for (const [index, listing] of listings.entries()) {
        const scanner = byId[index]!.id
        if (listing.status === 'rejected') answer.failures.push({ scanner, message: firstLine(listing.reason) })
        else if (listing.value?.includes(file)) answer.readers.push(scanner)
      }
      return answer
    },
    watchesFile(relativePath) {
      return !excluded(relativePath) && subscriptions.some(subscription => subscription.matches(relativePath))
    },
    async collectObservations(root, changedFiles, onScan) {
      const files = changedFiles?.filter(file => !excluded(file))
      for (const { scanner, matches } of subscriptions) {
        if (!files || files.some(matches)) pending.add(scanner)
      }
      const selected = [...pending]
      // Every scanner finishes before a failure surfaces, so none keeps a child process in the repository.
      const results = await Promise.allSettled(selected.map(async scanner => {
        let result: ScanObservation | undefined
        if (!await scannerSourcesExcluded(scanner, root, excluded)) {
          try {
            onScan?.({ scanner: scanner.id, type: 'start' })
            result = await scanner.scan(root, undefined, excluded)
          } finally {
            onScan?.({ scanner: scanner.id, type: 'end' })
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
        failures.push(new ScannerFailure(scanner.id, result.reason))
      }
      return {
        observations: scanners.map(scanner => observations.get(scanner)).filter(observation => observation !== undefined),
        failures,
      }
    },
  }
}
