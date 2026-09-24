import path from 'node:path'
import type { ScannerSettings } from '@groma/scanner'
import ignore from 'ignore'
import { GromaFileSystem } from '../../groma-filesystem.ts'

export interface ConfiguredScanner {
  id: string
  source: string
  settings?: ScannerSettings
  /** Git ignore patterns naming the files this scanner reads; adding the scanner writes the globs its package declares. */
  include: string[]
  /** Git ignore patterns for this scanner alone, applied after the global list; adding the scanner writes its declared defaults. */
  exclude?: string[]
}

export interface ScannerConfig {
  scanners: ConfiguredScanner[]
  /** Git ignore patterns every scanner leaves out; Groma never writes them. */
  exclude?: string[]
  /** Whether files Git ignores stay out of every scan; true unless set to false. */
  useGitignore?: boolean
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

/**
 * Whether a list of Git ignore patterns names a repository file, where the last matching pattern decides, so a later
 * `!pattern` takes a file back. A path outside the repository is never named.
 */
function patternMatcher(list: readonly string[]): (file: string) => boolean {
  const matcher = ignore({ ignorecase: false }).add([...list])
  return file => {
    const relative = file.split(path.sep).join('/')
    return !relative.startsWith('../') && !path.isAbsolute(relative) && matcher.ignores(relative)
  }
}

/** Whether a repository file is excluded, where the last matching pattern decides, so a later `!pattern` restores a file. */
export function exclusion(list: readonly string[]): (file: string) => boolean {
  return patternMatcher(list)
}

/** Whether a scanner's include list names a repository file as one it reads. */
export function inclusion(list: readonly string[]): (file: string) => boolean {
  return patternMatcher(list)
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
  if (fields.some(field => !['id', 'source', 'settings', 'include', 'exclude'].includes(field))) {
    throw new Error(`${sourceFilename} scanners[${index}] must contain id, source and include, and optionally settings and exclude`)
  }
  if (!stringArray(candidate.include)) {
    throw new Error(`${sourceFilename} scanners[${index}].include must be an array of strings naming the files the scanner reads`)
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
    include: candidate.include,
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
  if (Object.keys(config).some(key => !['scanners', 'exclude', 'useGitignore'].includes(key)) || !Array.isArray(config.scanners)) {
    throw new Error(`${sourceFilename} must contain a scanners array, and optionally an exclude array and useGitignore`)
  }
  if (config.exclude !== undefined && !stringArray(config.exclude)) {
    throw new Error(`${sourceFilename} exclude must be an array of strings`)
  }
  if (config.useGitignore !== undefined && typeof config.useGitignore !== 'boolean') {
    throw new Error(`${sourceFilename} useGitignore must be true or false`)
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
    ...(config.useGitignore === undefined ? {} : { useGitignore: config.useGitignore }),
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
