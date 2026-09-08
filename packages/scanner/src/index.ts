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

export interface ScanOperation {
  id: string
  file: string
  name: string
  /** Zero-based UTF-16 declaration start, excluding leading trivia; shared across compiler instances. */
  position?: number
  /** Inclusive 1-based lines; required when tokens are present. */
  startLine?: number
  endLine?: number
  /** Binding-normalized tokens for this operation body. Fingerprinting belongs to core. */
  tokens?: string[]
}

export interface ScanInvocation {
  source: string
  targets: string[]
  unresolved: boolean
  /** A concrete argument binding distinguishes supplied callbacks from direct calls. */
  binding?: { file: string; line: number; position?: number }
  line: number
  /** Zero-based UTF-16 invocation start, excluding leading trivia. */
  position?: number
  member?: string
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
  /** Omitted when a scanner does not extract operation evidence. Never persisted as a graph. */
  operations?: ScanOperation[]
  invocations?: ScanInvocation[]
  diagnostics: ScanDiagnostic[]
}

export interface ScannerPlugin {
  id: string
  matchesFile(relativePath: string): boolean
  scan(repositoryRoot: string): Promise<ScanObservation | undefined>
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
    ...operationEvidence(input, filePaths),
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
    ...parseOperations(value),
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

function parseOperations(value: Record<string, unknown>): Pick<ScanObservation, 'operations' | 'invocations'> {
  if (value.operations === undefined) {
    if (value.invocations !== undefined) throw new Error('invocations require operation declarations')
    return {}
  }
  const operations = array(value.operations, 'operations').map(entry => {
    const operation = object(entry, 'operation')
    return {
      id: string(operation.id, 'operation.id'),
      file: string(operation.file, 'operation.file'),
      name: string(operation.name, 'operation.name'),
      ...sourcePosition(operation.position),
      ...operationTokens(operation),
    }
  })
  const invocations = array(value.invocations, 'invocations').map(entry => {
    const invocation = object(entry, 'invocation')
    if (typeof invocation.unresolved !== 'boolean') throw new Error('invocation.unresolved must be a boolean')
    if (!Number.isInteger(invocation.line) || Number(invocation.line) < 1) throw new Error('invocation.line must be a positive integer')
    const binding = invocation.binding === undefined ? undefined : object(invocation.binding, 'invocation.binding')
    if (binding && (!Number.isInteger(binding.line) || Number(binding.line) < 1)) throw new Error('binding.line must be a positive integer')
    return {
      source: string(invocation.source, 'invocation.source'),
      targets: array(invocation.targets, 'invocation.targets').map(target => string(target, 'invocation.target')),
      unresolved: invocation.unresolved,
      line: Number(invocation.line),
      ...sourcePosition(invocation.position),
      ...(invocation.member === undefined ? {} : { member: string(invocation.member, 'invocation.member') }),
      ...(binding === undefined ? {} : { binding: { file: string(binding.file, 'binding.file'), line: Number(binding.line), ...sourcePosition(binding.position) } }),
    }
  })
  return { operations, invocations }
}

function operationEvidence(input: ObservationInput, files: Set<string>): Pick<ScanObservation, 'operations' | 'invocations'> {
  if (input.operations === undefined && input.invocations !== undefined) throw new Error('invocations require operation declarations')
  if (input.operations === undefined) return {}
  const operations = uniqueBy(input.operations, operation => operation.id, 'operation id')
  const ids = new Set(operations.map(operation => operation.id))
  for (const operation of operations) {
    if (!files.has(operation.file)) throw new Error(`operation references unknown file: ${operation.file}`)
    sourcePosition(operation.position)
    validateOperationTokens(operation)
  }
  const invocations = input.invocations ?? []
  for (const invocation of invocations) validateInvocation(invocation, ids, files)
  return { operations, invocations }
}

function operationTokens(operation: Record<string, unknown>): Pick<ScanOperation, 'startLine' | 'endLine' | 'tokens'> {
  if (operation.tokens === undefined) {
    if (operation.startLine !== undefined || operation.endLine !== undefined) {
      throw new Error('operation range requires tokens')
    }
    return {}
  }
  if (operation.startLine === undefined || operation.endLine === undefined) {
    throw new Error('operation tokens require a source range')
  }
  if (!Number.isInteger(operation.startLine) || Number(operation.startLine) < 1) {
    throw new Error('operation.startLine must be a positive integer')
  }
  if (!Number.isInteger(operation.endLine) || Number(operation.endLine) < 1) {
    throw new Error('operation.endLine must be a positive integer')
  }
  const startLine = Number(operation.startLine)
  const endLine = Number(operation.endLine)
  if (endLine < startLine) throw new Error('operation.endLine must be at or after startLine')
  return {
    startLine,
    endLine,
    tokens: array(operation.tokens, 'operation.tokens').map(token => string(token, 'operation.token')),
  }
}

function validateOperationTokens(operation: ScanOperation): void {
  operationTokens({
    tokens: operation.tokens,
    startLine: operation.startLine,
    endLine: operation.endLine,
  })
}

function validateInvocation(invocation: ScanInvocation, ids: Set<string>, files: Set<string>): void {
  sourcePosition(invocation.position)
  sourcePosition(invocation.binding?.position)
  if (!invocation.targets.length && !invocation.unresolved) throw new Error('an empty target set must be unresolved')
  if (!ids.has(invocation.source) || invocation.targets.some(target => !ids.has(target))) {
    throw new Error('invocation references unknown operation')
  }
  if (invocation.binding && !files.has(invocation.binding.file)) throw new Error('invocation binding references unknown file')
}

function sourcePosition(position: unknown): { position?: number } {
  if (position === undefined) return {}
  if (!Number.isInteger(position) || Number(position) < 0) throw new Error('source position must be a non-negative integer')
  return { position: Number(position) }
}
