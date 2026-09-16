import { Engine, type Node } from 'php-parser'
import type { ScanInvocation, ScanOperation, ScanSymbol } from '@groma/scanner'

type Syntax = Node & { name?: unknown; body?: unknown }
interface Scope { namespace: string; type?: string; operation?: string }
const types = new Set(['class', 'interface', 'trait', 'enum'])
const callables = new Set(['function', 'method', 'closure', 'arrowfunc'])

function syntax(value: unknown): value is Syntax {
  return value !== null && typeof value === 'object' && 'kind' in value && typeof value.kind === 'string'
}

function nameOf(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  return syntax(value) && typeof value.name === 'string' ? value.name : undefined
}

function children(node: Syntax): Syntax[] {
  return Object.entries(node).filter(([key]) => !['loc', 'leadingComments', 'trailingComments'].includes(key))
    .flatMap(([, value]) => Array.isArray(value) ? value.filter(syntax) : syntax(value) ? [value] : [])
}

/** PHP syntax facts only: declarations do not establish runtime loading or call targets. */
export function phpEvidence(file: string, source: string) {
  const parser = new Engine({ parser: { version: '8.4', suppressErrors: false },
    ast: { withPositions: true }, lexer: { short_tags: true } })
  const tree = parser.parseCode(source, file)
  const symbols: ScanSymbol[] = []
  const operations: ScanOperation[] = []
  const invocations: ScanInvocation[] = []

  function declaration(node: Syntax, scope: Scope): Scope {
    const position = node.loc!.start.offset
    const id = `${file}#${position}`
    const local = nameOf(node.name)
    const prefix = node.kind === 'method' ? `${scope.type}::` : scope.namespace ? `${scope.namespace}\\` : ''
    const name = local ? prefix + local : `callback at ${node.loc!.start.line}`
    if (local) symbols.push({ id, name, kind: node.kind })
    if (types.has(node.kind)) return { namespace: scope.namespace, type: name }
    if (!node.body) return { ...scope, operation: undefined }
    operations.push({ id, file, name, position })
    return { ...scope, operation: id }
  }

  function visit(node: Syntax, scope: Scope): void {
    let current = scope
    if (node.kind === 'namespace') current = { namespace: nameOf(node.name) ?? '' }
    else if (types.has(node.kind) || callables.has(node.kind)) current = declaration(node, scope)
    if ((node.kind === 'call' || node.kind === 'new') && current.operation) {
      invocations.push({ source: current.operation, targets: [], unresolved: true,
        line: node.loc!.start.line, position: node.loc!.start.offset })
    }
    for (const child of children(node)) visit(child, current)
  }

  visit(tree, { namespace: '' })
  return { symbols, operations, invocations }
}
