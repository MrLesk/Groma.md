import { GromaFileSystem } from '../../groma-filesystem.ts'

export interface ConfiguredScanner {
  id: string
  source: string
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
): ConfiguredScanner[] {
  const value: unknown = JSON.parse(source)
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${sourceFilename} must be an object`)
  }
  const config = value as Record<string, unknown>
  if (Object.keys(config).length !== 1 || !Array.isArray(config.scanners)) {
    throw new Error(`${sourceFilename} must contain only a scanners array`)
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
  return scanners.sort((left, right) => left.id.localeCompare(right.id))
}

export async function readScannerConfig(repositoryRoot: string): Promise<ConfiguredScanner[]> {
  const filesystem = GromaFileSystem.open(repositoryRoot)
  try {
    return parseScannerConfig(
      await filesystem.read('scanners.json'),
      filesystem.sourceFilename('scanners.json'),
    )
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

export async function writeScannerConfig(
  repositoryRoot: string,
  scanners: readonly ConfiguredScanner[],
): Promise<void> {
  const ordered = [...scanners].sort((left, right) => left.id.localeCompare(right.id))
  await GromaFileSystem.open(repositoryRoot).write(
    'scanners.json',
    `${JSON.stringify({ scanners: ordered }, null, 2)}\n`,
  )
}
