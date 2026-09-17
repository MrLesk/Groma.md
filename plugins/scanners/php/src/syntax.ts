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

export function children(node: Syntax): Syntax[] {
  return Object.entries(node).filter(([key]) => !['loc', 'leadingComments', 'trailingComments'].includes(key))
    .flatMap(([, value]) => Array.isArray(value) ? value.filter(isSyntax) : isSyntax(value) ? [value] : [])
}
