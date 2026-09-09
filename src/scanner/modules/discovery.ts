import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

import packageJson from '../../../package.json'
import { GromaFileSystem } from '../../groma-filesystem.ts'
import { officialScannerCatalog, recommendScanners } from './catalog.ts'
import type { TechnologyFinding, ScannerRecommendation } from './catalog.ts'
import { embeddedScanner, scannerInventory } from './inventory.ts'
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

function declarationFile(file: string): boolean {
  if (file.split('/').some(part => excluded.has(part))) return false
  const name = path.posix.basename(file)
  return ['package.json', 'pom.xml', 'go.mod', 'Cargo.toml', 'tsconfig.json'].includes(name)
    || name.endsWith('.csproj')
}

async function projectDeclarations(repositoryRoot: string): Promise<string[]> {
  const child = Bun.spawn([
    'git', '-C', repositoryRoot, 'ls-files', '-z', '--cached', '--others', '--exclude-standard',
  ], { stdout: 'pipe', stderr: 'pipe' })
  const [code, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
  ])
  if (code !== 0) throw new Error(stderr.trim() || `git ls-files exited ${code}`)
  return [...new Set(stdout.split('\0').filter(declarationFile))].sort()
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
}

function packageFindings(file: string, source: string): TechnologyFinding[] {
  const manifest = record(JSON.parse(source))
  const findings: TechnologyFinding[] = []
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const dependencies = record(manifest[section])
    for (const [name, technology, kind] of [
      ['typescript', 'typescript', 'language'],
      ['@angular/core', 'angular', 'framework'],
      ['vue', 'vue', 'framework'],
      ['react', 'react', 'framework'],
    ] as const) {
      const version = dependencies[name]
      if (typeof version !== 'string') continue
      findings.push({ technology, kind, file, declaration: `${section}.${name}`, version })
    }
  }
  return findings
}

async function resolveDependencyVersion(
  repositoryRoot: string,
  finding: TechnologyFinding,
): Promise<void> {
  const packageName = finding.technology === 'angular' ? '@angular/core' : finding.technology
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
    const manifest = record(JSON.parse(source))
    if (typeof manifest.version === 'string') {
      finding.resolvedVersion = {
        version: manifest.version,
        file: path.relative(repositoryRoot, filename).split(path.sep).join('/'),
      }
    }
    return
  }
}

/** Literal project declarations only: no property evaluation or build execution. */
function xmlValues(source: string, tag: string): string[] {
  const content = source.replace(/<!--[\s\S]*?-->/g, '')
  const pattern = new RegExp(`<${tag.replaceAll('.', '\\.')}\\s*>([^<]+)</${tag.replaceAll('.', '\\.')}\\s*>`, 'g')
  return [...content.matchAll(pattern)].map(match => (match[1] ?? '').trim())
}

function javaFindings(file: string, source: string): TechnologyFinding[] {
  const findings: TechnologyFinding[] = []
  for (const tag of ['java.version', 'maven.compiler.release', 'maven.compiler.source']) {
    for (const version of xmlValues(source, tag)) {
      findings.push({ technology: 'java', kind: 'language', file, declaration: tag, version })
    }
  }
  if (findings.length === 0) {
    findings.push({ technology: 'java', kind: 'language', file, declaration: 'Maven project; Java version unresolved' })
  }
  if (xmlValues(source, 'groupId').includes('org.springframework.boot')) {
    findings.push({
      technology: 'spring-boot', kind: 'framework', file,
      declaration: 'org.springframework.boot declaration; runtime use unverified',
    })
  }
  return findings
}

function csharpFindings(file: string, source: string): TechnologyFinding[] {
  const targets = [...xmlValues(source, 'TargetFramework'), ...xmlValues(source, 'TargetFrameworks')]
    .flatMap(value => value.split(';'))
  return (targets.length === 0 ? [undefined] : targets).map(version => ({
    technology: 'csharp', kind: 'language', file, declaration: 'MSBuild TargetFramework', version,
  }))
}

function cargoFindings(file: string, source: string): TechnologyFinding[] {
  const manifest = record(Bun.TOML.parse(source))
  if (manifest.package === undefined && manifest.workspace === undefined) return []
  const project = record(manifest.package)
  const version = project['rust-version']
  return [{
    technology: 'rust', kind: 'language', file,
    declaration: manifest.package === undefined ? 'Cargo workspace' : 'Cargo package rust-version',
    version: typeof version === 'string' ? version : undefined,
  }]
}

function findingsFrom(file: string, source: string): TechnologyFinding[] {
  const name = path.posix.basename(file)
  if (name === 'package.json') return packageFindings(file, source)
  if (name === 'pom.xml') return javaFindings(file, source)
  if (name.endsWith('.csproj')) return csharpFindings(file, source)
  if (name === 'Cargo.toml') return cargoFindings(file, source)
  if (name === 'go.mod') {
    return [{
      technology: 'go', kind: 'language', file, declaration: 'Go module go directive',
      version: /^go\s+(\S+)/m.exec(source)?.[1],
    }]
  }
  return [{ technology: 'typescript', kind: 'language', file, declaration: 'TypeScript project configuration' }]
}

function coverageLimits(findings: TechnologyFinding[]): string[] {
  const supported = new Set(officialScannerCatalog.flatMap(scanner => scanner.technologies))
  const limits = findings.filter(finding => !supported.has(finding.technology)).map(finding => {
    return `${finding.file}: no official scanner covers ${finding.technology} framework evidence.`
  })
  for (const finding of findings) {
    if (finding.version === undefined) {
      limits.push(`${finding.file}: ${finding.technology} version is not resolved by declaration discovery.`)
    }
  }
  return [...new Set(limits)]
}

export async function discoverScanners(
  repositoryRoot: string,
  options: ScannerResolutionOptions = {},
): Promise<ScannerDiscovery> {
  const findings: TechnologyFinding[] = []
  const limits: string[] = []
  for (const file of await projectDeclarations(repositoryRoot)) {
    try {
      const detected = findingsFrom(file, await readFile(path.join(repositoryRoot, file), 'utf8'))
      if (path.posix.basename(file) === 'package.json') {
        for (const finding of detected) await resolveDependencyVersion(repositoryRoot, finding)
      }
      findings.push(...detected)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      if (!(error instanceof SyntaxError)) throw error
      limits.push(`${file}: declaration could not be parsed; technology support remains uncertain.`)
    }
  }
  const inventory = GromaFileSystem.find(repositoryRoot) === undefined
    ? [embeddedScanner]
    : await scannerInventory(repositoryRoot, options)
  return {
    findings, inventory,
    recommendations: recommendScanners(findings, inventory, packageJson.version),
    limits: [...limits, ...coverageLimits(findings)],
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
