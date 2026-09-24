import path from 'node:path'
import type { ScannerSettings } from '@groma/scanner'
import ignore from 'ignore'
import { GromaFileSystem } from '../../groma-filesystem.ts'

export interface ConfiguredScanner {
  id: string
  source: string
  settings?: ScannerSettings
  /** Git ignore patterns for this scanner alone, applied after the global list; installing writes its declared defaults. */
  exclude?: string[]
}

export interface ScannerConfig {
  scanners: ConfiguredScanner[]
  exclude?: string[]
}

const scannerId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** A JSON value holding a list of strings, such as patterns. */
export function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

/** A scanner's exclusions in the order they apply: the global list, then the scanner's own. */
export function exclusionPatterns(config: ScannerConfig, scanner: string): string[] {
  return [...config.exclude ?? [], ...config.scanners.find(entry => entry.id === scanner)?.exclude ?? []]
}

/** Whether a repository file is excluded, where the last matching pattern decides, so a later `!pattern` restores a file. */
export function exclusion(list: readonly string[]): (file: string) => boolean {
  const matcher = ignore({ ignorecase: false }).add([...list])
  return file => matcher.ignores(file.split(path.sep).join('/'))
}

function configuredScanner(
  value: unknown,
  index: number,
  sourceFilename: string,
): ConfiguredScanner {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${sourceFilename} scanners[${index}] must be an object`)
  }
  const candidate = value as Record<string, unknown>
  const fields = Object.keys(candidate)
  if (fields.some(field => !['id', 'source', 'settings', 'exclude'].includes(field))) {
    throw new Error(`${sourceFilename} scanners[${index}] must contain id and source, and optionally settings and exclude`)
  }
  if (candidate.exclude !== undefined && !stringArray(candidate.exclude)) {
    throw new Error(`${sourceFilename} scanners[${index}].exclude must be an array of strings`)
  }
  if (candidate.settings !== undefined && (candidate.settings === null
    || typeof candidate.settings !== 'object' || Array.isArray(candidate.settings))) {
    throw new Error(`${sourceFilename} scanners[${index}].settings must be an object`)
  }
  if (typeof candidate.id !== 'string' || !scannerId.test(candidate.id)) {
    throw new Error(`${sourceFilename} scanners[${index}].id must be lowercase kebab-case`)
  }
  if (typeof candidate.source !== 'string' || candidate.source.trim() === '') {
    throw new Error(`${sourceFilename} scanners[${index}].source must be non-empty`)
  }
  return { id: candidate.id, source: candidate.source,
    ...(candidate.settings === undefined ? {} : { settings: candidate.settings as ScannerSettings }),
    ...(candidate.exclude === undefined ? {} : { exclude: candidate.exclude }),
  }
}

function parseScannerConfig(
  source: string,
  sourceFilename: string,
): ScannerConfig {
  const value: unknown = JSON.parse(source)
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${sourceFilename} must be an object`)
  }
  const config = value as Record<string, unknown>
  if (Object.keys(config).some(key => key !== 'scanners' && key !== 'exclude') || !Array.isArray(config.scanners)) {
    throw new Error(`${sourceFilename} must contain a scanners array and optional exclude array`)
  }
  if (config.exclude !== undefined && !stringArray(config.exclude)) {
    throw new Error(`${sourceFilename} exclude must be an array of strings`)
  }
  const scanners = config.scanners.map((scanner, index) => {
    return configuredScanner(scanner, index, sourceFilename)
  })
  const ids = new Set<string>()
  const sources = new Set<string>()
  for (const scanner of scanners) {
    if (ids.has(scanner.id)) throw new Error(`duplicate configured scanner id: ${scanner.id}`)
    if (sources.has(scanner.source)) {
      throw new Error(`duplicate configured scanner source: ${scanner.source}`)
    }
    ids.add(scanner.id)
    sources.add(scanner.source)
  }
  return {
    scanners: scanners.sort((left, right) => left.id.localeCompare(right.id)),
    ...(config.exclude === undefined ? {} : { exclude: config.exclude as string[] }),
  }
}

export async function readScannerConfig(repositoryRoot: string): Promise<ScannerConfig> {
  const filesystem = GromaFileSystem.open(repositoryRoot)
  try {
    return parseScannerConfig(
      await filesystem.read('scanners.json'),
      filesystem.sourceFilename('scanners.json'),
    )
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { scanners: [] }
    throw error
  }
}

export async function writeScannerConfig(
  repositoryRoot: string,
  config: ScannerConfig,
): Promise<void> {
  const ordered = [...config.scanners].sort((left, right) => left.id.localeCompare(right.id))
  await GromaFileSystem.open(repositoryRoot).write(
    'scanners.json',
    `${JSON.stringify({ ...config, scanners: ordered }, null, 2)}\n`,
  )
}
