import type { ScannerInventoryItem } from './inventory.ts'

export interface TechnologyFinding {
  technology: string
  kind: 'language' | 'framework'
  file: string
  declaration: string
  version?: string
  resolvedVersion?: { version: string; file: string }
}

export interface OfficialScanner {
  id: string
  package: string
  technologies: string[]
  description: string
  /** Present only for a verified release, never a planned package version. */
  release?: {
    version: string
    groma: string
    technologyVersions: Record<string, string>
  }
}

export const officialScannerCatalog: readonly OfficialScanner[] = [
  {
    id: 'typescript', package: '@groma/scanner-typescript', technologies: ['typescript'],
    description: 'Embedded TypeScript scanner using the Groma TypeScript SDK.',
  },
  {
    id: 'java', package: '@groma/scanner-java', technologies: ['java'],
    description: 'Java compiler and project evidence; framework runtime use is not verified.',
  },
  {
    id: 'angular', package: '@groma/scanner-angular', technologies: ['angular'],
    description: 'Complementary Angular framework evidence with its own compatible TypeScript tooling.',
  },
  {
    id: 'vue', package: '@groma/scanner-vue', technologies: ['vue'],
    description: 'Complementary Vue framework evidence; a dependency declaration does not verify runtime use.',
  },
  {
    id: 'react', package: '@groma/scanner-react', technologies: ['react'],
    description: 'Complementary React framework evidence; a dependency declaration does not verify runtime use.',
  },
  {
    id: 'csharp', package: '@groma/scanner-csharp', technologies: ['csharp'],
    description: 'C# project evidence through Roslyn and MSBuild.',
  },
  {
    id: 'go', package: '@groma/scanner-go', technologies: ['go'],
    description: 'Go project evidence through Go language tooling.',
  },
  {
    id: 'rust', package: '@groma/scanner-rust', technologies: ['rust'],
    description: 'Rust project evidence through established semantic tooling.',
  },
]

export interface ScannerRecommendation {
  id: string
  package: string
  status: 'embedded' | 'configured' | 'installable' | 'unavailable' | 'incompatible' | 'uncertain'
  evidence: TechnologyFinding[]
  reason: string
  installSource?: string
}

function exactVersion(value: string | undefined): string | undefined {
  if (value === undefined || !/^\d+(?:\.\d+){0,2}$/.test(value)) return undefined
  return [...value.split('.'), '0', '0'].slice(0, 3).join('.')
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
  for (const finding of evidence) {
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
    if (configured?.status === 'built-in') {
      return [{ ...base, status: 'embedded' as const, reason: scanner.description }]
    }
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
