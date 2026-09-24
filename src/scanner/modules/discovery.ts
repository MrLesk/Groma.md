import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { ScannerDiscoveryRule } from '@groma/scanner'
import { compileWatchPatterns } from '../watch-patterns.ts'
import { discoveryRuleFindings } from './discovery-rules.ts'

import packageJson from '../../../package.json'
import { GromaFileSystem } from '../../groma-filesystem.ts'
import { repositoryListing } from '../../repository-listing.ts'
import { officialScannerCatalog, recommendScanners } from './catalog.ts'
import type { TechnologyFinding, ScannerRecommendation, OfficialScanner } from './catalog.ts'
import { scannerInventory, configuredScannerModules } from './inventory.ts'
import { exclusion, readScannerConfig } from './config.ts'
import type { ScannerInventoryItem, ScannerResolutionOptions } from './inventory.ts'

export interface ScannerDiscovery {
  findings: TechnologyFinding[]
  inventory: ScannerInventoryItem[]
  recommendations: ScannerRecommendation[]
  limits: string[]
}

const excluded = new Set([
  '.git', 'node_modules', 'vendor', 'target', 'dist', 'build', 'bin', 'obj',
  '.gradle', '.angular', 'coverage', 'generated', 'groma', '.groma',
])

interface CompiledRule {
  rule: ScannerDiscoveryRule
  matches: (file: string) => boolean
}

function declarationFile(file: string, rules: CompiledRule[]): boolean {
  return !file.split('/').some(part => excluded.has(part)) && rules.some(rule => rule.matches(file))
}

async function projectDeclarations(repositoryRoot: string, rules: CompiledRule[], useGitignore: boolean): Promise<string[]> {
  return [...new Set((await repositoryListing(repositoryRoot, useGitignore)).filter(file => declarationFile(file, rules)))].sort()
}

async function resolveDependencyVersion(
  repositoryRoot: string,
  finding: TechnologyFinding,
  packageName: string,
): Promise<void> {
  const require = createRequire(path.resolve(repositoryRoot, finding.file))
  // Bun's require.resolve can use its global cache. Read only normal installed-package paths.
  for (const directory of require.resolve.paths(packageName) ?? []) {
    const filename = path.join(directory, packageName, 'package.json')
    let source: string
    try {
      source = await readFile(filename, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw error
    }
    const manifest = JSON.parse(source)
    if (typeof manifest?.version === 'string') {
      finding.resolvedVersion = {
        version: manifest.version,
        file: path.relative(repositoryRoot, filename).split(path.sep).join('/'),
      }
    }
    return
  }
}

function coverageLimits(findings: TechnologyFinding[], catalog: readonly OfficialScanner[]): string[] {
  const supported = new Set(catalog.flatMap(scanner => scanner.technologies))
  const limits = findings.filter(finding => !supported.has(finding.technology)).map(finding => {
    return `${finding.file}: no official scanner covers ${finding.technology} framework evidence.`
  })
  return [...new Set(limits)]
}

async function declarationFindings(repositoryRoot: string, file: string, rules: CompiledRule[]): Promise<TechnologyFinding[]> {
  const source = await readFile(path.join(repositoryRoot, file), 'utf8')
  const findings: TechnologyFinding[] = []
  for (const { rule, matches } of rules) {
    if (!matches(file)) continue
    const detected = discoveryRuleFindings(file, source, rule)
    if (rule.type === 'dependency') {
      for (const finding of detected) await resolveDependencyVersion(repositoryRoot, finding, rule.package)
    }
    findings.push(...detected)
  }
  return findings
}

export async function discoverScanners(
  repositoryRoot: string,
  options: ScannerResolutionOptions = {},
  catalog: readonly OfficialScanner[] = officialScannerCatalog,
): Promise<ScannerDiscovery> {
  const initialized = GromaFileSystem.find(repositoryRoot) !== undefined
  const modules = initialized ? await configuredScannerModules(repositoryRoot, options) : []
  const installed = modules.flatMap(module => module.status === 'found' && module.discovery ? [{
    id: module.id, package: module.name, description: '', ...module.discovery,
    compatibility: module.discovery.compatibility,
  }] : [])
  catalog = [...catalog.filter(item => !installed.some(module => module.id === item.id)), ...installed]
  const findings: TechnologyFinding[] = []
  const limits: string[] = []
  const rules = catalog.flatMap(scanner => scanner.rules.map(rule => ({
    rule, matches: compileWatchPatterns(rule.files),
  })))
  // Discovery rules belong to every scanner, installed or not, so the global list alone applies.
  const config = initialized ? await readScannerConfig(repositoryRoot) : undefined
  const excluded = exclusion(config?.exclude ?? [])
  for (const file of await projectDeclarations(repositoryRoot, rules, config?.useGitignore ?? true)) {
    if (excluded(file)) continue
    try {
      findings.push(...await declarationFindings(repositoryRoot, file, rules))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      if (!(error instanceof SyntaxError)) throw error
      limits.push(`${file}: declaration could not be parsed; technology support remains uncertain.`)
    }
  }
  const inventory = initialized ? await scannerInventory(repositoryRoot, options) : []
  const recommendations = recommendScanners(findings, inventory, catalog).map(candidate => {
    const scanner = installed.find(scanner => scanner.id === candidate.id)
    const required = scanner?.compatibility?.groma
    return required && !Bun.semver.satisfies(packageJson.version, required)
      ? { ...candidate, status: 'incompatible' as const, reason: `Requires Groma ${required}. Update Groma to use this scanner.` }
      : candidate
  })
  return {
    findings, inventory, recommendations,
    limits: [...limits, ...coverageLimits(findings, catalog)],
  }
}

interface FindingGroup {
  /** The first finding, whose declaration and path label the group. */
  finding: TechnologyFinding
  files: Set<string>
}

/**
 * Source-file findings collapse into one group per technology, counting each file once however many rules match
 * it; each project declaration keeps its own.
 */
function findingGroups(findings: readonly TechnologyFinding[]): FindingGroup[] {
  const groups = new Map<string | TechnologyFinding, FindingGroup>()
  for (const finding of findings) {
    const key = finding.sourceFiles ? finding.technology : finding
    const group = groups.get(key)
    if (group === undefined) groups.set(key, { finding, files: new Set([finding.file]) })
    else group.files.add(finding.file)
  }
  return [...groups.values()]
}

function findingLine({ finding, files }: FindingGroup): string {
  const version = finding.version ?? 'version unresolved'
  if (finding.sourceFiles) {
    const evidence = files.size === 1 ? finding.file : `${files.size} files; first ${finding.file}`
    return `${finding.technology}\t${version}\t${finding.declaration}: ${evidence}`
  }
  const clue = finding.kind === 'framework' ? 'framework declaration, runtime use unverified' : 'project declaration'
  const resolved = finding.resolvedVersion === undefined ? ''
    : `; installed ${finding.resolvedVersion.version} at ${finding.resolvedVersion.file}`
  return `${finding.technology}\t${version}\t${finding.file} (${finding.declaration}; ${clue}${resolved})`
}

/** The closing note of every discovery report; it is not a listed item. */
export const discoveryNote = 'Discovery covers supported project declarations, not every technology or runtime interaction.'

/** One item per summarized finding, recommendation, configured scanner, and coverage limit, in that order. */
export function discoveryItems(discovery: ScannerDiscovery): string[] {
  const lines = findingGroups(discovery.findings).map(findingLine)
  for (const recommendation of discovery.recommendations) {
    lines.push(`${recommendation.id}\t${recommendation.status}\t${recommendation.installSource ?? recommendation.package}\t${recommendation.reason}`)
  }
  for (const item of discovery.inventory) {
    if (!discovery.recommendations.some(recommendation => recommendation.id === item.id)) {
      lines.push(`${item.id}\tconfigured (${item.status})\t${item.source}`)
    }
  }
  lines.push(...discovery.limits.map(limit => `coverage limit\t${limit}`))
  return lines
}

export function formatDiscovery(discovery: ScannerDiscovery): string {
  return [...discoveryItems(discovery), discoveryNote].join('\n')
}
