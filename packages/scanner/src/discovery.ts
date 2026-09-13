/** Declarative project discovery; these rules never load scanner code. */
export interface DiscoveryRuleBase {
  files: string[]
  technology: string
  kind: 'language' | 'framework'
}

export type ScannerDiscoveryRule = DiscoveryRuleBase & (
  | { type: 'file'; declaration: string }
  | { type: 'dependency'; package: string }
  | { type: 'xml'; versionTags: string[]; declaration: string; when?: { tag: string; equals: string } }
  | { type: 'toml'; tables: string[]; versionPath: string[]; declaration: string }
  | { type: 'text'; versionPattern: string; declaration: string }
)

export interface ScannerDiscoveryMetadata {
  /** Technologies actually covered; rules may also report unsupported framework clues. */
  technologies: string[]
  rules: ScannerDiscoveryRule[]
  /** Set only for a release selected for public installation. */
  compatibility?: { groma: string; technologyVersions: Record<string, string> }
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('scanner discovery metadata must contain objects')
  }
  return value as Record<string, unknown>
}

function string(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error('scanner discovery metadata requires non-empty strings')
  return value
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('scanner discovery metadata requires string arrays')
  return value.map(string)
}

function rule(value: unknown): ScannerDiscoveryRule {
  const input = object(value)
  const kind = input.kind
  if (kind !== 'language' && kind !== 'framework') throw new Error('discovery kind must be language or framework')
  const base: DiscoveryRuleBase = { files: strings(input.files), technology: string(input.technology), kind }
  switch (input.type) {
    case 'dependency': return { ...base, type: input.type, package: string(input.package) }
    case 'file': return { ...base, type: input.type, declaration: string(input.declaration) }
    case 'xml': {
      const when = input.when === undefined ? undefined : object(input.when)
      return {
        ...base, type: input.type, versionTags: strings(input.versionTags), declaration: string(input.declaration),
        ...(when === undefined ? {} : { when: { tag: string(when.tag), equals: string(when.equals) } }),
      }
    }
    case 'toml': return {
      ...base, type: input.type, tables: strings(input.tables), versionPath: strings(input.versionPath),
      declaration: string(input.declaration),
    }
    case 'text': {
      const versionPattern = string(input.versionPattern)
      new RegExp(versionPattern, 'm')
      return { ...base, type: input.type, versionPattern, declaration: string(input.declaration) }
    }
    default: throw new Error('unsupported scanner discovery rule type')
  }
}

export function parseScannerDiscovery(value: unknown): ScannerDiscoveryMetadata {
  const input = object(value)
  if (!Array.isArray(input.rules)) throw new Error('scanner discovery rules must be an array')
  const result: ScannerDiscoveryMetadata = { technologies: strings(input.technologies), rules: input.rules.map(rule) }
  if (input.compatibility !== undefined) {
    const compatibility = object(input.compatibility)
    result.compatibility = {
      groma: string(compatibility.groma),
      technologyVersions: Object.fromEntries(Object.entries(object(compatibility.technologyVersions))
        .map(([technology, version]) => [technology, string(version)])),
    }
  }
  return result
}
