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

export interface OfficialScanner {
  id: string
  package: string
  technologies: string[]
  description: string
  rules: ScannerDiscoveryRule[]
  release?: { version: string; groma: string; technologyVersions: Record<string, string> }
}

/** Read only package data. A private prototype is never offered as a public release. */
export function scannerCatalogEntry(manifest: {
  name: string; version: string; description: string; private?: boolean
  groma: { scanner: { id: string; discovery: unknown } }
}): OfficialScanner {
  const discovery = parseScannerDiscovery(manifest.groma.scanner.discovery)
  return {
    id: manifest.groma.scanner.id, package: manifest.name, description: manifest.description,
    technologies: discovery.technologies, rules: discovery.rules,
    ...(manifest.private === true || discovery.compatibility === undefined ? {} : {
      release: { version: manifest.version, ...discovery.compatibility },
    }),
  }
}

// This is the official selection. Imported JSON is embedded by Groma's existing build.
// Detection and compatibility information live exclusively in the selected packages.
export const officialScannerCatalog: readonly OfficialScanner[] = [
  typescript, java, angular, vue, react, csharp, go, rust,
].map(scannerCatalogEntry)
