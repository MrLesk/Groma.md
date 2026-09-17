import type { ScannerDiscoveryRule } from '@groma/scanner'
import type { TechnologyFinding } from './catalog.ts'

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
}

function dependencyFindings(
  file: string, source: string, rule: Extract<ScannerDiscoveryRule, { type: 'dependency' }>,
): TechnologyFinding[] {
  const manifest = record(JSON.parse(source))
  return ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].flatMap(section => {
    const version = record(manifest[section])[rule.package]
    return typeof version !== 'string' ? [] : [{
      technology: rule.technology, kind: rule.kind, file, declaration: `${section}.${rule.package}`, version,
    }]
  })
}

/** Literal XML values only: no property evaluation or build execution. */
function xmlValues(source: string, tag: string): string[] {
  const content = source.replace(/<!--[\s\S]*?-->/g, '')
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`<${escaped}\\s*>([^<]+)</${escaped}\\s*>`, 'g')
  return [...content.matchAll(pattern)].map(match => (match[1] ?? '').trim())
}

function xmlFindings(
  file: string, source: string, rule: Extract<ScannerDiscoveryRule, { type: 'xml' }>,
): TechnologyFinding[] {
  if (rule.when && !xmlValues(source, rule.when.tag).includes(rule.when.equals)) return []
  const base = { technology: rule.technology, kind: rule.kind, file }
  const findings = rule.versionTags.flatMap(tag => xmlValues(source, tag).flatMap(value =>
    value.split(';').map(version => ({ ...base, declaration: tag, version }))))
  return findings.length === 0 ? [{ ...base, declaration: rule.declaration }] : findings
}

/** A presence rule whose patterns all match a file extension finds its technology in source files, not in a project declaration. */
function findsSourceFiles(rule: Extract<ScannerDiscoveryRule, { type: 'file' }>): boolean {
  return rule.files.every(pattern => (pattern.split('/').at(-1) ?? '').startsWith('*.'))
}

export function discoveryRuleFindings(file: string, source: string, rule: ScannerDiscoveryRule): TechnologyFinding[] {
  const base = { technology: rule.technology, kind: rule.kind, file }
  switch (rule.type) {
    case 'dependency': return dependencyFindings(file, source, rule)
    case 'xml': return xmlFindings(file, source, rule)
    case 'file': return [{ ...base, declaration: rule.declaration, sourceFiles: findsSourceFiles(rule) }]
    case 'text': return [{ ...base, declaration: rule.declaration, version: new RegExp(rule.versionPattern, 'm').exec(source)?.[1] }]
    case 'toml': {
      const manifest = record(Bun.TOML.parse(source))
      if (!rule.tables.some(table => manifest[table] !== undefined)) return []
      const version = rule.versionPath.reduce<unknown>((value, key) => record(value)[key], manifest)
      return [{ ...base, declaration: rule.declaration, version: typeof version === 'string' ? version : undefined }]
    }
  }
}
