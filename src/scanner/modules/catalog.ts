import type { OfficialScanner } from './official-catalog.ts'
export { officialScannerCatalog } from './official-catalog.ts'
export type { OfficialScanner } from './official-catalog.ts'
import type { ScannerInventoryItem } from './inventory.ts'

export interface TechnologyFinding {
  technology: string
  kind: 'language' | 'framework'
  file: string
  declaration: string
  version?: string
  resolvedVersion?: { version: string; file: string }
}

export interface ScannerRecommendation {
  id: string
  package: string
  status: 'configured' | 'installable' | 'incompatible'
  evidence: TechnologyFinding[]
  reason: string
  installSource?: string
}

/** Detection offers a package; the registry selects an actual release at install time. */
export function recommendScanners(
  findings: TechnologyFinding[],
  inventory: ScannerInventoryItem[],
  catalog: readonly OfficialScanner[],
): ScannerRecommendation[] {
  return catalog.flatMap(scanner => {
    const evidence = findings.filter(finding => scanner.technologies.includes(finding.technology))
    const configured = inventory.find(item => item.id === scanner.id)
    if (evidence.length === 0 && configured === undefined) return []
    return [{
      id: scanner.id, package: scanner.package, evidence,
      status: configured ? 'configured' : 'installable',
      reason: scanner.description,
      ...(configured ? {} : { installSource: scanner.package }),
    }]
  })
}
