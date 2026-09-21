import { httpEvidence, type ScanHttpEndpoint, type ScanHttpRequest } from './http.ts'
import { array, object, string } from './values.ts'

export { parseScannerDiscovery } from './discovery.ts'
export type { ScannerDiscoveryMetadata, ScannerDiscoveryRule } from './discovery.ts'
export type {
  HttpEndpointSegment, HttpRequestSegment, ScanHttpEndpoint, ScanHttpRequest,
} from './http.ts'

export interface ScannerIdentity {
  id: string
  technology: string
  engine: string
  engineVersion: string
}

export interface ScanRoot {
  id: string
  kind: string
  name: string
  file?: string
  parent?: string
}

export interface ScanSymbol {
  id: string
  name: string
  kind: string
}

export interface ScanFile {
  file: string
  roots: string[]
  symbols: ScanSymbol[]
}

/** An explicit language or framework declaration associates these source files. */
export interface ScanSourceUnit {
  primary: string
  files: string[]
}

/** A compiler, build or launch declaration designates this source as an execution entry. */
export interface ScanEntryPoint {
  /** Inventoried physical source entry; different declarations of it describe one execution unit. */
  file: string
  /** Source or configuration file that declares the entry. */
  declaration: string
  name: string
  /** Includes the entry itself and this scanner's files in its source unit, excluding referenced units. */
  files: string[]
}

export interface ScanDiagnostic {
  severity: string
  code: string
  message: string
  file?: string
  line?: number
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
  /**
   * Binding-normalized tokens for this operation body. Fingerprinting belongs to core.
   * The compared operations rule in `docs/architecture-findings.md#compared-operations` states which
   * operations carry tokens, so a scanner tokenizes no anonymous callback and filters no body by size.
   */
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
  roots: ScanRoot[]
  files: ScanFile[]
  sourceUnits?: ScanSourceUnit[]
  entryPoints?: ScanEntryPoint[]
  /** Omitted when a scanner does not extract operation evidence. Never persisted as a graph. */
  operations?: ScanOperation[]
  invocations?: ScanInvocation[]
  /** Omitted when a scanner does not extract HTTP evidence. Facts link to declared operations. */
  httpEndpoints?: ScanHttpEndpoint[]
  httpRequests?: ScanHttpRequest[]
  diagnostics: ScanDiagnostic[]
}

/** Scanner-owned JSON settings supplied by Groma; plugins do not read Groma configuration files. */
export type ScannerSettings = Readonly<Record<string, unknown>>

/**
 * Who may use a declaration by name, on one scale for every language:
 * `public` any dependent code, `protected` the declaring type and its subtypes,
 * `internal` the same package, module, assembly or crate, and `private` the
 * declaring type (for a member) or the declaring file or module (top level).
 */
export type CodeVisibility = 'public' | 'protected' | 'internal' | 'private'

/** One named declaration in a source outline: a top-level function or type, or a type's method. */
export interface CodeSymbol {
  name: string
  /** 1-based line of the declared name. */
  line: number
  visibility: CodeVisibility
  /** The Code reference's `symbols` name this symbol in the spelling this scanner's Code links use, so a member may be qualified by its type. */
  entry: boolean
}

/** A top-level function, or a function literal assigned directly to a top-level name. */
export interface CodeFunction extends CodeSymbol {
  kind: 'function'
}

/** A top-level class, interface, struct, record, enum, trait, protocol or defined type; never an alias. */
export interface CodeType extends CodeSymbol {
  kind: 'type'
  /** Every method and constructor this file declares on the type, in source order. */
  members: CodeSymbol[]
}

export type CodeDeclaration = CodeFunction | CodeType

export interface CodeFile {
  file: string
  declarations: CodeDeclaration[]
}

/** One Code file to outline; its `symbols` may come from another scanner's Code links for the same file. */
export interface SourceReference {
  file: string
  symbols: string[]
}

export interface ScannerPlugin {
  id: string
  /** Repository-relative patterns for source and configuration changes that trigger analysis. */
  watch: { include: string[]; exclude: string[] }
  /** Check source inputs and scanner-owned tools. Project dependency installation or builds must not be prerequisites. */
  checkReadiness?(repositoryRoot: string, settings?: ScannerSettings): Promise<void>
  /** Source outline for Code references, required of official scanners; this data is never architecture persistence. */
  readCodeStructure?(repositoryRoot: string, references: readonly SourceReference[], settings?: ScannerSettings): Promise<CodeFile[]>
  /**
   * Repository-relative files this scanner would analyze for these settings, required of official
   * scanners. It selects files the way `scan` does, without analyzing them or running project tools,
   * so Groma can explain why a file has no architecture owner.
   */
  listSourceFiles?(repositoryRoot: string, settings?: ScannerSettings): Promise<string[]>
  scan(repositoryRoot: string, settings?: ScannerSettings): Promise<ScanObservation | undefined>
}

type ObservationInput = Omit<ScanObservation, 'schemaVersion'>

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
  const roots = validateRoots(input.roots)
  const rootIds = new Set(roots.map(root => root.id))
  const files = uniqueBy(input.files.map(file => ({
    ...file,
    roots: [...new Set(file.roots)].sort(),
    symbols: [...new Map(file.symbols.map(symbol => [
      compare(symbol.id, symbol.kind),
      symbol,
    ])).values()].sort((left, right) => {
      return compare(left.id, left.kind).localeCompare(compare(right.id, right.kind))
    }),
  })), file => file.file, 'file path')
  const filePaths = new Set(files.map(file => file.file))
  for (const file of files) {
    if (file.roots.length === 0) throw new Error(`file has no root: ${file.file}`)
    for (const root of file.roots) {
      if (!rootIds.has(root)) throw new Error(`file references unknown root: ${root}`)
    }
  }
  for (const diagnostic of input.diagnostics) diagnosticLocation(diagnostic)

  return {
    schemaVersion: 1,
    scanner: input.scanner,
    roots,
    files,
    ...sourceUnits(input.sourceUnits, filePaths),
    ...entryPoints(input.entryPoints, filePaths),
    ...operationEvidence(input, filePaths),
    ...httpEvidence(input.httpEndpoints, input.httpRequests, input.operations && new Set(input.operations.map(operation => operation.id))),
    diagnostics: [...new Map(input.diagnostics.map(diagnostic => [
      diagnosticKey(diagnostic),
      diagnostic,
    ])).values()].sort((left, right) => {
      return diagnosticKey(left).localeCompare(diagnosticKey(right))
    }),
  }
}

function entryPoints(input: unknown, paths: Set<string>): Pick<ScanObservation, 'entryPoints'> {
  if (input === undefined) return {}
  const entries = array(input, 'entryPoints').map(value => {
    const entry = object(value, 'entry point')
    const files = [...new Set(array(entry.files, 'entry point.files').map(file => string(file, 'entry point.file')))].sort()
    for (const file of files) {
      if (!paths.has(file)) throw new Error(`entry point references unknown file: ${file}`)
    }
    const file = string(entry.file, 'entry point.file')
    if (!files.includes(file)) throw new Error(`entry point must include its own source file: ${file}`)
    return { file, declaration: string(entry.declaration, 'entry point.declaration'),
      name: string(entry.name, 'entry point.name'), files }
  })
  const key = (entry: ScanEntryPoint) => compare(entry.file, entry.declaration, entry.name, ...entry.files)
  return { entryPoints: [...new Map(entries.map(entry => [key(entry), entry])).values()]
    .sort((a, b) => key(a).localeCompare(key(b))) }
}

function sourceUnits(input: unknown, paths: Set<string>): Pick<ScanObservation, 'sourceUnits'> {
  if (input === undefined) return {}
  const units = array(input, 'sourceUnits').map(entry => {
    const unit = object(entry, 'source unit')
    const primary = string(unit.primary, 'source unit.primary')
    const files = [...new Set(array(unit.files, 'source unit.files').map(file => string(file, 'source unit.file')))].sort()
    if (!files.includes(primary)) throw new Error(`source unit omits primary file: ${primary}`)
    for (const file of files) {
      if (!paths.has(file)) throw new Error(`source unit references unknown file: ${file}`)
    }
    return { primary, files }
  })
  return { sourceUnits: [...new Map(units.map(unit => [compare(unit.primary, ...unit.files), unit])).values()]
    .sort((a, b) => compare(a.primary, ...a.files).localeCompare(compare(b.primary, ...b.files))) }
}

function validateRoots(input: ScanRoot[]): ScanRoot[] {
  const roots = uniqueBy(input, root => root.id, 'root id')
  const byId = new Map(roots.map(root => [root.id, root]))
  for (const root of roots) {
    const visited = new Set<string>([root.id])
    let parent = root.parent
    while (parent !== undefined) {
      if (visited.has(parent)) throw new Error(`root hierarchy contains a cycle: ${parent}`)
      visited.add(parent)
      const ancestor = byId.get(parent)
      if (ancestor === undefined) throw new Error(`root references unknown parent: ${parent}`)
      parent = ancestor.parent
    }
  }
  return roots
}

function diagnosticKey(diagnostic: ScanDiagnostic): string {
  return compare(diagnostic.severity, diagnostic.code, diagnostic.message,
    diagnostic.file ?? '', String(diagnostic.line ?? ''))
}

function diagnosticLocation(value: { file?: unknown; line?: unknown }): Pick<ScanDiagnostic, 'file' | 'line'> {
  if (value.line !== undefined && (!Number.isInteger(value.line) || Number(value.line) < 1)) {
    throw new Error('diagnostic.line must be a positive integer')
  }
  return {
    ...(value.file === undefined ? {} : { file: string(value.file, 'diagnostic.file') }),
    ...(value.line === undefined ? {} : { line: Number(value.line) }),
  }
}

export function parseScanObservation(source: string): ScanObservation {
  const value = object(JSON.parse(source), 'observation')
  if (value.schemaVersion !== 1) throw new Error('unsupported scanner schema')
  const scanner = object(value.scanner, 'scanner')

  return createScanObservation({
    scanner: {
      id: string(scanner.id, 'scanner.id'),
      technology: string(scanner.technology, 'scanner.technology'),
      engine: string(scanner.engine, 'scanner.engine'),
      engineVersion: string(scanner.engineVersion, 'scanner.engineVersion'),
    },
    ...parseOperations(value),
    // createScanObservation validates both fact lists.
    httpEndpoints: value.httpEndpoints as ScanHttpEndpoint[] | undefined,
    httpRequests: value.httpRequests as ScanHttpRequest[] | undefined,
    entryPoints: value.entryPoints as ScanEntryPoint[] | undefined,
    ...sourceUnits(value.sourceUnits, new Set(array(value.files, 'files').map(entry => string(object(entry, 'file').file, 'file.file')))),
    roots: array(value.roots, 'roots').map(entry => {
      const root = object(entry, 'root')
      return {
        id: string(root.id, 'root.id'),
        kind: string(root.kind, 'root.kind'),
        name: string(root.name, 'root.name'),
        ...(root.file === undefined ? {} : { file: string(root.file, 'root.file') }),
        ...(root.parent === undefined ? {} : { parent: string(root.parent, 'root.parent') }),
      }
    }),
    files: array(value.files, 'files').map((entry, index) => {
      const file = object(entry, `files[${index}]`)
      return {
        file: string(file.file, `files[${index}].file`),
        roots: array(file.roots, 'file.roots').map(root => string(root, 'file.root')),
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
    diagnostics: array(value.diagnostics, 'diagnostics').map((entry, index) => {
      const diagnostic = object(entry, `diagnostics[${index}]`)
      return {
        severity: string(diagnostic.severity, `diagnostics[${index}].severity`),
        code: string(diagnostic.code, `diagnostics[${index}].code`),
        message: string(diagnostic.message, `diagnostics[${index}].message`),
        ...diagnosticLocation(diagnostic),
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
