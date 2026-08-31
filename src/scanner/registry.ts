import type { ScannerPlugin, ScanObservation } from '@groma/scanner'
import cSharpScanner from '@groma/scanner-csharp'
import typeScriptScanner from '@groma/scanner-typescript'

const scannerPlugins: readonly ScannerPlugin[] = [
  typeScriptScanner,
  cSharpScanner,
]

export function isScannerFile(relativePath: string): boolean {
  return scannerPlugins.some(scanner => scanner.matchesFile(relativePath))
}

export async function collectScanObservations(
  repositoryRoot: string,
): Promise<ScanObservation[]> {
  const observations = await Promise.all(
    scannerPlugins.map(scanner => scanner.scan(repositoryRoot)),
  )
  return observations.filter(observation => observation !== undefined)
}
