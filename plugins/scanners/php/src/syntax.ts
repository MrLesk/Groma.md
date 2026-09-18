import { Engine, type Node, type Program } from 'php-parser'

export type Syntax = Node & { name?: unknown; body?: unknown }

/** Class-like declarations; their methods are named after them. */
export const typeKinds = new Set(['class', 'interface', 'trait', 'enum'])

/**
 * The scan's symbol name: `Ns\name` for a function or type, and `Type::method` for a method,
 * where `type` is the type's own symbol name.
 */
export function symbolName(namespace: string, name: string, type?: string): string {
  if (type !== undefined) return `${type}::${name}`
  return namespace ? `${namespace}\\${name}` : name
}

/** A php-parser node whose fields are read by name. */
export type Fields = Syntax & Record<string, unknown>

/**
 * The one place php-parser nodes are widened to read a child node or list by field name.
 * php-parser writes an absent child as null, which reads here as undefined.
 */
export function field(node: Syntax, key: string): Fields | undefined {
  return ((node as Fields)[key] ?? undefined) as Fields | undefined
}

export function list(node: Syntax | undefined, key: string): Fields[] {
  return ((node === undefined ? undefined : (node as Fields)[key]) ?? []) as Fields[]
}

/** Declarations that hold executable code. */
export const callables = new Set(['function', 'method', 'closure', 'arrowfunc'])

/** The member a call names, such as `get` in `Route::get(...)` or `$app->get(...)`. */
export function memberOf(call: Fields): string | undefined {
  const what = field(call, 'what')
  if (what?.kind !== 'staticlookup' && what?.kind !== 'propertylookup') return undefined
  return nameOf(field(what, 'offset'))
}

/** A declaration's operation and symbol id: its file and its zero-based start offset. */
export function operationId(file: string, node: Syntax): string {
  return `${file}#${node.loc!.start.offset}`
}

/** The operation of the code outside every function, class and method: the file's own top-level code. */
export function moduleOperationId(file: string): string {
  return `${file}#module`
}

/** PHP syntax through 8.4; parser errors throw instead of producing a partial tree. */
export function parsePhp(file: string, source: string): Program {
  const parser = new Engine({ parser: { version: '8.4', suppressErrors: false },
    ast: { withPositions: true }, lexer: { short_tags: true } })
  return parser.parseCode(source, file)
}

export function isSyntax(value: unknown): value is Syntax {
  return value !== null && typeof value === 'object' && 'kind' in value && typeof value.kind === 'string'
}

export function nameOf(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  return isSyntax(value) && typeof value.name === 'string' ? value.name : undefined
}

/** A name as PHP reads a fully qualified spelling such as `\foo`: without its one leading backslash. */
export function qualifiedName(written: string): string {
  return written.replace(/^\\/, '')
}

/** The plain function a call names, such as `curl_init` in `\curl_init(...)`. */
export function calledFunction(call: Fields): string | undefined {
  const what = field(call, 'what')
  return call.kind === 'call' && what?.kind === 'name' ? qualifiedName(String(what.name)) : undefined
}

/** What a file says about names at one point: its namespace, its `use` aliases and the enclosing type. */
export interface NameScope {
  namespace: string
  /** Alias or last name segment to its fully qualified name. */
  imports: ReadonlyMap<string, string>
  /** Fully qualified name of the enclosing type. */
  type?: string
}

/** The fully qualified name a class reference states, through the file's `use` aliases. */
export function typeName(node: Fields | undefined, scope: NameScope): string | undefined {
  if (node?.kind === 'selfreference' || node?.kind === 'staticreference') return scope.type
  if (node?.kind !== 'name') return undefined
  const written = String(node.name)
  if (written.startsWith('\\')) return qualifiedName(written)
  const [head, ...rest] = written.split('\\')
  const imported = scope.imports.get(head!)
  if (imported !== undefined) return [imported, ...rest].join('\\')
  return symbolName(scope.namespace, written)
}

export function children(node: Syntax): Syntax[] {
  return Object.entries(node).filter(([key]) => !['loc', 'leadingComments', 'trailingComments'].includes(key))
    .flatMap(([, value]) => Array.isArray(value) ? value.filter(isSyntax) : isSyntax(value) ? [value] : [])
}
