import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import ignore from 'ignore'
import type { ScannerDiscoveryRule } from '@groma/scanner'
import { compileWatchPatterns } from '../watch-patterns.ts'
import { discoveryRuleFindings } from './discovery-rules.ts'

import packageJson from '../../../package.json'
import { GromaFileSystem } from '../../groma-filesystem.ts'
import { officialScannerCatalog, recommendScanners } from './catalog.ts'
import type { TechnologyFinding, ScannerRecommendation, OfficialScanner } from './catalog.ts'
import { scannerInventory, configuredScannerModules } from './inventory.ts'
import { readScannerConfig } from './config.ts'
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

async function projectDeclarations(repositoryRoot: string, rules: CompiledRule[]): Promise<string[]> {
  const child = Bun.spawn([
    'git', '-C', repositoryRoot, 'ls-files', '-z', '--cached', '--others', '--exclude-standard',
  ], { stdout: 'pipe', stderr: 'pipe' })
  const [code, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
  ])
  if (code !== 0) throw new Error(stderr.trim() || `git ls-files exited ${code}`)
  return [...new Set(stdout.split('\0').filter(Boolean).filter(file => declarationFile(file, rules)))].sort()
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
    rule, matches: compileWatchPatterns({ include: rule.files, exclude: [] }),
  })))
  const config = initialized ? await readScannerConfig(repositoryRoot) : undefined
  const matcher = ignore({ ignorecase: false }).add(config?.exclude ?? [])
  for (const file of await projectDeclarations(repositoryRoot, rules)) {
    if (matcher.ignores(file)) continue
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

export function formatDiscovery(discovery: ScannerDiscovery): string {
  const lines = discovery.findings.map(finding => {
    const clue = finding.kind === 'framework' ? 'framework declaration, runtime use unverified' : 'project declaration'
    const resolved = finding.resolvedVersion === undefined ? ''
      : `; installed ${finding.resolvedVersion.version} at ${finding.resolvedVersion.file}`
    return `${finding.technology}\t${finding.version ?? 'version unresolved'}\t${finding.file} (${finding.declaration}; ${clue}${resolved})`
  })
  for (const recommendation of discovery.recommendations) {
    lines.push(`${recommendation.id}\t${recommendation.status}\t${recommendation.installSource ?? recommendation.package}\t${recommendation.reason}`)
  }
  for (const item of discovery.inventory) {
    if (!discovery.recommendations.some(recommendation => recommendation.id === item.id)) {
      lines.push(`${item.id}\tconfigured (${item.status})\t${item.source}`)
    }
  }
  lines.push(...discovery.limits.map(limit => `coverage limit\t${limit}`))
  lines.push('Discovery covers supported project declarations, not every technology or runtime interaction.')
  return lines.join('\n')
}
