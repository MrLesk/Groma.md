import type { Node } from 'php-parser'

export type Syntax = Node & { name?: unknown; body?: unknown }

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
