import { parseScannerDiscovery } from '@groma/scanner'
import type { ScannerDiscoveryRule } from '@groma/scanner'

import typescript from '../../../plugins/scanners/typescript/package.json'
import java from '../../../plugins/scanners/java/package.json'
import angular from '../../../plugins/scanners/angular/package.json'
import vue from '../../../plugins/scanners/vue/package.json'
import react from '../../../plugins/scanners/react/package.json'
import csharp from '../../../plugins/scanners/csharp/package.json'
import go from '../../../plugins/scanners/go/package.json'
import rust from '../../../plugins/scanners/rust/package.json'
import python from '../../../plugins/scanners/python/package.json'

export interface OfficialScanner {
  id: string
  package: string
  technologies: string[]
  description: string
  rules: ScannerDiscoveryRule[]
}

/** Embedded metadata describes detection, never claims a release is published. */
export function scannerCatalogEntry(manifest: {
  name: string; version: string; description: string; private?: boolean
  groma: { scanner: { id: string; discovery: unknown } }
}): OfficialScanner {
  const discovery = parseScannerDiscovery(manifest.groma.scanner.discovery)
  return {
    id: manifest.groma.scanner.id, package: manifest.name, description: manifest.description,
    technologies: discovery.technologies, rules: discovery.rules,
  }
}

// This is the official selection. Imported JSON is embedded by Groma's existing build.
// Detection and compatibility information live exclusively in the selected packages.
export const officialScannerCatalog: readonly OfficialScanner[] = [
  typescript, java, angular, vue, react, csharp, go, rust, python,
].map(scannerCatalogEntry)
