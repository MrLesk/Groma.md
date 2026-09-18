import type { ScanInvocation, ScanOperation, ScanSymbol } from '@groma/scanner'
import ts from 'typescript'
import { topLevelDeclarations } from './declarations.ts'
import { tokenizeOperation } from './tokens.ts'

// The operation and named-operation rules follow the reference ../../typescript/src/source-operations.ts
// and docs/architecture-findings.md; change both together.

export interface FileEvidence {
  symbols: ScanSymbol[]
  operations: ScanOperation[]
  invocations: ScanInvocation[]
}

/** Functions, function literals and methods with a body. Constructors and accessors carry no evidence. */
function executable(node: ts.Node): boolean {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node)
    || ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.body !== undefined)
}

/**
 * A function written as a property of an object literal argument, such as `subscribe({ next: value => ... })`.
 * The argument may belong to a function call or a `new` call.
 */
function callArgumentProperty(node: ts.Node): boolean {
  const property = ts.isPropertyAssignment(node.parent) ? node.parent : node
  if (!ts.isPropertyAssignment(property) && !ts.isMethodDeclaration(property)) return false
  const invocation = property.parent.parent
  return ts.isObjectLiteralExpression(property.parent)
    && (ts.isCallExpression(invocation) || ts.isNewExpression(invocation))
}

/** Name of an operation core may compare; undefined for module code and anonymous callbacks. */
function comparableName(node: ts.Node): string | undefined {
  if (callArgumentProperty(node)) return undefined
  const named = node as ts.NamedDeclaration
  if (named.name && ts.isIdentifier(named.name)) return named.name.text
  const parent = node.parent
  if (ts.isPropertyAssignment(parent) || ts.isVariableDeclaration(parent)) return parent.name.getText()
  return undefined
}

/** Every operation and call of one parsed file. Calls stay unresolved: source alone proves no target. */
export function javaScriptEvidence(file: string, source: ts.SourceFile): FileEvidence {
  const operations: ScanOperation[] = []
  const invocations: ScanInvocation[] = []
  const lineOf = (position: number) => source.getLineAndCharacterOfPosition(position).line + 1
  let moduleCode: ScanOperation | undefined

  function operation(node: ts.Node): ScanOperation {
    const position = node.getStart(source)
    const name = comparableName(node)
    // Only named operations are compared as possible duplicate logic.
    const body = name === undefined ? {}
      : { startLine: lineOf(position), endLine: lineOf(node.end), tokens: tokenizeOperation(node) }
    const recorded = { id: `${file}#${position}`, file, name: name ?? '(anonymous)', position, ...body }
    operations.push(recorded)
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
    const inside = executable(node) ? operation(node) : owner
    if (ts.isCallExpression(node)) invocation(node, inside ?? moduleOperation())
    node.forEachChild(child => visit(child, inside))
  }

  source.forEachChild(child => visit(child, undefined))
  // A Code reference names a declaration, so each name is one symbol even when the file repeats it.
  const symbols = new Map(topLevelDeclarations(source)
    .map(declaration => [`${file}#${declaration.name}`, { id: `${file}#${declaration.name}`, ...declaration }] as const))
  return { symbols: [...symbols.values()], operations, invocations }
}
