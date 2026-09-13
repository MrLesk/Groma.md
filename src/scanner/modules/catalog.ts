import path from 'node:path'
import { officialScannerCatalog } from './official-catalog.ts'
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
  status: 'configured' | 'installable' | 'unavailable' | 'incompatible' | 'uncertain'
  evidence: TechnologyFinding[]
  reason: string
  installSource?: string
}

function exactVersion(value: string | undefined): string | undefined {
  if (value === undefined || !/^\d+(?:\.\d+){0,2}$/.test(value)) return undefined
  return [...value.split('.'), '0', '0'].slice(0, 3).join('.')
}

/** Presence-only clues use version evidence only within the same project directory. */
function projectVersion(clue: TechnologyFinding, evidence: TechnologyFinding[]): TechnologyFinding {
  if (clue.version !== undefined) return clue
  return evidence.find(candidate => (
    candidate.technology === clue.technology && candidate.version !== undefined
    && path.posix.dirname(candidate.file) === path.posix.dirname(clue.file)
  )) ?? clue
}

function releaseCompatibility(
  scanner: OfficialScanner,
  evidence: TechnologyFinding[],
  gromaVersion: string,
): Pick<ScannerRecommendation, 'status' | 'reason' | 'installSource'> {
  const release = scanner.release
  if (release === undefined) {
    return { status: 'unavailable', reason: 'No verified compatible release is catalogued.' }
  }
  if (!Bun.semver.satisfies(gromaVersion, release.groma)) {
    return { status: 'incompatible', reason: `Requires Groma ${release.groma}.` }
  }
  for (const clue of evidence) {
    const finding = projectVersion(clue, evidence)
    const version = exactVersion(finding.resolvedVersion?.version ?? finding.version)
    const supported = release.technologyVersions[finding.technology]
    if (version === undefined || supported === undefined) {
      return { status: 'uncertain', reason: 'Declared technology version needs confirmation by project tooling.' }
    }
    if (finding.resolvedVersion !== undefined && !Bun.semver.satisfies(version, finding.version ?? '')) {
      return { status: 'incompatible', reason: `${finding.file}: installed ${finding.technology} ${version} does not match ${finding.version}.` }
    }
    if (!Bun.semver.satisfies(version, supported)) {
      return { status: 'incompatible', reason: `${finding.file}: ${finding.technology} ${finding.version} is outside ${supported}.` }
    }
  }
  return {
    status: 'installable', reason: 'Catalogued release matches Groma and the declared technology versions.',
    installSource: `${scanner.package}@${release.version}`,
  }
}

export function recommendScanners(
  findings: TechnologyFinding[],
  inventory: ScannerInventoryItem[],
  gromaVersion: string,
  catalog: readonly OfficialScanner[] = officialScannerCatalog,
): ScannerRecommendation[] {
  return catalog.flatMap(scanner => {
    const evidence = findings.filter(finding => scanner.technologies.includes(finding.technology))
    const configured = inventory.find(item => item.id === scanner.id)
    if (evidence.length === 0 && configured === undefined) return []
    const base = { id: scanner.id, package: scanner.package, evidence }
    if (configured !== undefined) {
      return [{
        ...base, status: 'configured' as const,
        reason: `Selection retained (${configured.status}); project-tooling compatibility is not verified. ${scanner.description}`,
      }]
    }
    const compatibility = releaseCompatibility(scanner, evidence, gromaVersion)
    return [{ ...base, ...compatibility, reason: `${compatibility.reason} ${scanner.description}` }]
  })
}
