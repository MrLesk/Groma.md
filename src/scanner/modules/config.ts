import { GromaFileSystem } from '../../groma-filesystem.ts'

export interface ConfiguredScanner {
  id: string
  source: string
}

export interface ScannerConfig {
  scanners: ConfiguredScanner[]
  exclude?: string[]
}

const scannerId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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
  if (fields.length !== 2 || !fields.includes('id') || !fields.includes('source')) {
    throw new Error(`${sourceFilename} scanners[${index}] must contain only id and source`)
  }
  if (typeof candidate.id !== 'string' || !scannerId.test(candidate.id)) {
    throw new Error(`${sourceFilename} scanners[${index}].id must be lowercase kebab-case`)
  }
  if (typeof candidate.source !== 'string' || candidate.source.trim() === '') {
    throw new Error(`${sourceFilename} scanners[${index}].source must be non-empty`)
  }
  return { id: candidate.id, source: candidate.source }
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
  if (config.exclude !== undefined && (!Array.isArray(config.exclude) || config.exclude.some(pattern => typeof pattern !== 'string'))) {
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
