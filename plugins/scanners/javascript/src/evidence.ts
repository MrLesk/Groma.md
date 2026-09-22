import type { ScanInvocation, ScanOperation, ScanSymbol } from '@groma/scanner'
import ts from 'typescript'
import { typeScriptOperations } from '../../typescript-operations.ts'
import { topLevelDeclarations } from './declarations.ts'

export interface FileEvidence {
  symbols: ScanSymbol[]
  operations: ScanOperation[]
  invocations: ScanInvocation[]
  /** Every call this file makes, in source order, for the producers that read call arguments. */
  calls: ts.CallExpression[]
  /** The operation that runs a node: the nearest enclosing function, else the module itself. */
  operationAt(node: ts.Node): string
}

const { executable, operationFields } = typeScriptOperations(ts)

/** Every operation and call of one parsed file. Calls stay unresolved: source alone proves no target. */
export function javaScriptEvidence(file: string, source: ts.SourceFile): FileEvidence {
  const operations: ScanOperation[] = []
  const invocations: ScanInvocation[] = []
  const calls: ts.CallExpression[] = []
  const owners = new Map<ts.Node, string>()
  const lineOf = (position: number) => source.getLineAndCharacterOfPosition(position).line + 1
  let moduleCode: ScanOperation | undefined

  function operation(node: ts.Node): ScanOperation {
    const position = node.getStart(source)
    const recorded = { id: `${file}#${position}`, file, position, ...operationFields(node) }
    operations.push(recorded)
    owners.set(node, recorded.id)
    return recorded
  }

  /** Code outside every function belongs to the module itself, as the reference scanner reports it. */
  function moduleOperation(): ScanOperation {
    if (moduleCode === undefined) {
      moduleCode = { id: `${file}#module`, file, name: '(anonymous)', position: source.getStart(source) }
      operations.push(moduleCode)
    }
    return moduleCode
  }

  function invocation(node: ts.CallExpression, owner: ScanOperation): void {
    const position = node.getStart(source)
    invocations.push({
      source: owner.id, targets: [], unresolved: true, line: lineOf(position), position,
      ...(ts.isPropertyAccessExpression(node.expression) ? { member: node.expression.name.text } : {}),
    })
  }

  function visit(node: ts.Node, owner: ScanOperation | undefined): void {
    // Accessors run as their own body even though they are not compared as duplicate operations.
    const inside = executable(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)
      ? operation(node) : owner
    if (ts.isCallExpression(node)) {
      calls.push(node)
      invocation(node, inside ?? moduleOperation())
    }
    node.forEachChild(child => visit(child, inside))
  }

  function operationAt(node: ts.Node): string {
    for (let current: ts.Node | undefined = node; current; current = current.parent) {
      const id = owners.get(current)
      if (id !== undefined) return id
    }
    return moduleOperation().id
  }

  source.forEachChild(child => visit(child, undefined))
  // A Code reference names a declaration, so each name is one symbol even when the file repeats it.
  const symbols = new Map(topLevelDeclarations(source)
    .map(declaration => [`${file}#${declaration.name}`, { id: `${file}#${declaration.name}`, ...declaration }] as const))
  return { symbols: [...symbols.values()], operations, invocations, calls, operationAt }
}
