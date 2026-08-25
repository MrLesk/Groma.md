export interface ScannerIdentity {
  language: string
  engine: string
  engineVersion: string
}

export interface ScanRoot {
  kind: string
  name: string
  file: string
}

export interface ScanScope {
  id: string
  name: string
}

export interface ScanSymbol {
  id: string
  name: string
  kind: string
}

export interface ScanFile {
  file: string
  symbols: ScanSymbol[]
}

export interface ScanPlacement {
  file: string
  scope: string
}

export interface ScanRelationship {
  source: string
  target: string
  kind: string
}

export interface ScanDiagnostic {
  severity: string
  code: string
  message: string
}

export interface ScanObservation {
  schemaVersion: 1
  scanner: ScannerIdentity
  complete: true
  root: ScanRoot
  scopes: ScanScope[]
  files: ScanFile[]
  placements: ScanPlacement[]
  relationships: ScanRelationship[]
  diagnostics: ScanDiagnostic[]
}

type ObservationInput = Omit<ScanObservation, 'schemaVersion' | 'complete'>

function compare(...values: string[]): string {
  return values.join('\0')
}

function uniqueBy<T>(values: T[], key: (value: T) => string, label: string): T[] {
  const seen = new Set<string>()
  for (const value of values) {
    const id = key(value)
    if (seen.has(id)) throw new Error(`duplicate ${label}: ${id}`)
    seen.add(id)
  }
  return [...values].sort((left, right) => key(left).localeCompare(key(right)))
}

export function createScanObservation(input: ObservationInput): ScanObservation {
  const scopes = uniqueBy(input.scopes, scope => scope.id, 'scope id')
  const files = uniqueBy(input.files.map(file => ({
    ...file,
    symbols: [...new Map(file.symbols.map(symbol => [
      compare(symbol.id, symbol.kind),
      symbol,
    ])).values()].sort((left, right) => {
      return compare(left.id, left.kind).localeCompare(compare(right.id, right.kind))
    }),
  })), file => file.file, 'file path')
  const scopeIds = new Set(scopes.map(scope => scope.id))
  const filePaths = new Set(files.map(file => file.file))
  const placements = [...new Map(input.placements.map(placement => [
    compare(placement.file, placement.scope),
    placement,
  ])).values()].sort((left, right) => {
    return compare(left.file, left.scope).localeCompare(compare(right.file, right.scope))
  })
  const relationships = [...new Map(input.relationships.map(relationship => [
    compare(relationship.source, relationship.target, relationship.kind),
    relationship,
  ])).values()].sort((left, right) => {
    return compare(left.source, left.target, left.kind)
      .localeCompare(compare(right.source, right.target, right.kind))
  })

  const placedFiles = new Set<string>()
  for (const placement of placements) {
    if (!filePaths.has(placement.file)) {
      throw new Error(`placement references unknown file: ${placement.file}`)
    }
    if (!scopeIds.has(placement.scope)) {
      throw new Error(`placement references unknown scope: ${placement.scope}`)
    }
    if (placedFiles.has(placement.file)) {
      throw new Error(`file has multiple placements: ${placement.file}`)
    }
    placedFiles.add(placement.file)
  }
  for (const file of filePaths) {
    if (!placedFiles.has(file)) throw new Error(`file has no placement: ${file}`)
  }
  const evidenceIds = new Set([...scopeIds, ...filePaths])
  for (const relationship of relationships) {
    if (!evidenceIds.has(relationship.source)) {
      throw new Error(`relationship references unknown source: ${relationship.source}`)
    }
    if (!evidenceIds.has(relationship.target)) {
      throw new Error(`relationship references unknown target: ${relationship.target}`)
    }
  }

  return {
    schemaVersion: 1,
    scanner: input.scanner,
    complete: true,
    root: input.root,
    scopes,
    files,
    placements,
    relationships,
    diagnostics: [...new Map(input.diagnostics.map(diagnostic => [
      compare(diagnostic.severity, diagnostic.code, diagnostic.message),
      diagnostic,
    ])).values()].sort((left, right) => {
      return compare(left.severity, left.code, left.message)
        .localeCompare(compare(right.severity, right.code, right.message))
    }),
  }
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`)
  return value
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value
}

export function parseScanObservation(source: string): ScanObservation {
  const value = object(JSON.parse(source), 'observation')
  if (value.schemaVersion !== 1) throw new Error('unsupported scanner schema')
  if (value.complete !== true) throw new Error('scanner observation is incomplete')
  const scanner = object(value.scanner, 'scanner')
  const root = object(value.root, 'root')

  return createScanObservation({
    scanner: {
      language: string(scanner.language, 'scanner.language'),
      engine: string(scanner.engine, 'scanner.engine'),
      engineVersion: string(scanner.engineVersion, 'scanner.engineVersion'),
    },
    root: {
      kind: string(root.kind, 'root.kind'),
      name: string(root.name, 'root.name'),
      file: string(root.file, 'root.file'),
    },
    scopes: array(value.scopes, 'scopes').map((entry, index) => {
      const scope = object(entry, `scopes[${index}]`)
      return {
        id: string(scope.id, `scopes[${index}].id`),
        name: string(scope.name, `scopes[${index}].name`),
      }
    }),
    files: array(value.files, 'files').map((entry, index) => {
      const file = object(entry, `files[${index}]`)
      return {
        file: string(file.file, `files[${index}].file`),
        symbols: array(file.symbols, `files[${index}].symbols`).map((entry, symbolIndex) => {
          const symbol = object(entry, `files[${index}].symbols[${symbolIndex}]`)
          return {
            id: string(symbol.id, 'symbol.id'),
            name: string(symbol.name, 'symbol.name'),
            kind: string(symbol.kind, 'symbol.kind'),
          }
        }),
      }
    }),
    placements: array(value.placements, 'placements').map((entry, index) => {
      const placement = object(entry, `placements[${index}]`)
      return {
        file: string(placement.file, `placements[${index}].file`),
        scope: string(placement.scope, `placements[${index}].scope`),
      }
    }),
    relationships: array(value.relationships, 'relationships').map((entry, index) => {
      const relationship = object(entry, `relationships[${index}]`)
      return {
        source: string(relationship.source, `relationships[${index}].source`),
        target: string(relationship.target, `relationships[${index}].target`),
        kind: string(relationship.kind, `relationships[${index}].kind`),
      }
    }),
    diagnostics: array(value.diagnostics, 'diagnostics').map((entry, index) => {
      const diagnostic = object(entry, `diagnostics[${index}]`)
      return {
        severity: string(diagnostic.severity, `diagnostics[${index}].severity`),
        code: string(diagnostic.code, `diagnostics[${index}].code`),
        message: string(diagnostic.message, `diagnostics[${index}].message`),
      }
    }),
  })
}
