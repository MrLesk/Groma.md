import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface ConfiguredScanner {
  id: string
  source: string
}

const scannerId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function configFilename(repositoryRoot: string): string {
  return path.join(repositoryRoot, 'groma', 'scanners.json')
}

function configuredScanner(value: unknown, index: number): ConfiguredScanner {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`groma/scanners.json scanners[${index}] must be an object`)
  }
  const candidate = value as Record<string, unknown>
  const fields = Object.keys(candidate)
  if (fields.length !== 2 || !fields.includes('id') || !fields.includes('source')) {
    throw new Error(`groma/scanners.json scanners[${index}] must contain only id and source`)
  }
  if (typeof candidate.id !== 'string' || !scannerId.test(candidate.id)) {
    throw new Error(`groma/scanners.json scanners[${index}].id must be lowercase kebab-case`)
  }
  if (typeof candidate.source !== 'string' || candidate.source.trim() === '') {
    throw new Error(`groma/scanners.json scanners[${index}].source must be non-empty`)
  }
  return { id: candidate.id, source: candidate.source }
}

function parseScannerConfig(source: string): ConfiguredScanner[] {
  const value: unknown = JSON.parse(source)
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('groma/scanners.json must be an object')
  }
  const config = value as Record<string, unknown>
  if (Object.keys(config).length !== 1 || !Array.isArray(config.scanners)) {
    throw new Error('groma/scanners.json must contain only a scanners array')
  }
  const scanners = config.scanners.map(configuredScanner)
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
  try {
    return parseScannerConfig(await readFile(configFilename(repositoryRoot), 'utf8'))
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
  const filename = configFilename(repositoryRoot)
  await mkdir(path.dirname(filename), { recursive: true })
  await writeFile(filename, `${JSON.stringify({ scanners: ordered }, null, 2)}\n`)
}
