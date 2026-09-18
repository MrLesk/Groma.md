/*
 * How one reference uses a variable, read from syntax alone: the property path it reaches, and whether it
 * writes there, hands the value on or only reads it. Shared by the TypeScript-family scanners that bundle
 * the classic compiler.
 */
interface Node {
  kind: number
  parent: Node
}
interface Identifier extends Node { text: string }
interface Access extends Node { expression: Node; name: Node }
interface ElementAccess extends Node { expression: Node; argumentExpression: Node }
interface Wrapped extends Node { expression: Node }
interface Binary extends Node { left: Node; right: Node; operatorToken: { kind: number } }
interface Unary extends Node { operator: number; operand: Node }
interface Loop extends Node { initializer: Node }
interface Named extends Node { name: Node }
interface Initialized extends Node { initializer: Node }
interface Modified extends Node { modifiers?: readonly { kind: number }[] }
export interface SourceFile extends Node { fileName: string }

export interface UseCompiler {
  SyntaxKind: {
    FirstAssignment: number; LastAssignment: number; EqualsToken: number; PlusPlusToken: number
    MinusMinusToken: number; ExportKeyword: number
  }
  isIdentifier(node: Node): node is Identifier
  isPropertyAccessExpression(node: Node): node is Access
  isElementAccessExpression(node: Node): node is ElementAccess
  isParenthesizedExpression(node: Node): node is Wrapped
  isAsExpression(node: Node): node is Wrapped
  isSatisfiesExpression(node: Node): node is Wrapped
  isNonNullExpression(node: Node): node is Wrapped
  isTypeAssertionExpression(node: Node): node is Wrapped
  isBinaryExpression(node: Node): node is Binary
  isPrefixUnaryExpression(node: Node): node is Unary
  isPostfixUnaryExpression(node: Node): node is Unary
  isDeleteExpression(node: Node): node is Wrapped
  isForInStatement(node: Node): node is Loop
  isForOfStatement(node: Node): node is Loop
  isArrayLiteralExpression(node: Node): boolean
  isObjectLiteralExpression(node: Node): boolean
  isSpreadElement(node: Node): boolean
  isSpreadAssignment(node: Node): boolean
  isShorthandPropertyAssignment(node: Node): node is Named
  isPropertyAssignment(node: Node): node is Initialized
  isCallExpression(node: Node): node is Wrapped
  isNewExpression(node: Node): node is Wrapped
  isTaggedTemplateExpression(node: Node): node is Node & { tag: Node }
  isStringLiteral(node: Node): node is Identifier
  isNumericLiteral(node: Node): node is Identifier
  isImportClause(node: Node): node is Node & { name?: Node }
  isImportSpecifier(node: Node): node is Named
  isNamespaceImport(node: Node): node is Named
  isImportEqualsDeclaration(node: Node): node is Named
  isExportSpecifier(node: Node): boolean
  isExportAssignment(node: Node): node is Wrapped
  isSourceFile(node: Node): boolean
  isExternalModule(file: SourceFile): boolean
  isQualifiedName(node: Node): boolean
  isTypeQueryNode(node: Node): boolean
}

/**
 * One use of a variable: `write` replaces the value at the path, `escape` hands the value at the path
 * to code that may change it, `read` escapes too unless the value it reads is primitive, and `export`
 * names it in an export statement.
 */
export interface Use {
  kind: 'write' | 'escape' | 'read' | 'export'
  path: readonly string[]
  reference: Node
  /** The expression whose type decides a read. */
  value: Node
  /** What a plain `=` assignment writes at the path. */
  assigned?: Node
}

function wrapper(ts: UseCompiler, node: Node): node is Wrapped {
  return ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)
    || ts.isNonNullExpression(node) || ts.isTypeAssertionExpression(node)
}

/** A part of a destructuring pattern, which an assignment above it writes to. */
function patternPart(ts: UseCompiler, parent: Node, target: Node): boolean {
  if (ts.isPropertyAssignment(parent)) return parent.initializer === target
  return ts.isArrayLiteralExpression(parent) || ts.isObjectLiteralExpression(parent) || ts.isSpreadElement(parent)
    || ts.isSpreadAssignment(parent) || ts.isShorthandPropertyAssignment(parent) || wrapper(ts, parent)
}

function assignment(ts: UseCompiler, parent: Binary, direct: boolean): { assigned?: Node } | undefined {
  const operator = parent.operatorToken.kind
  if (operator < ts.SyntaxKind.FirstAssignment || operator > ts.SyntaxKind.LastAssignment) return undefined
  return operator === ts.SyntaxKind.EqualsToken && direct ? { assigned: parent.right } : {}
}

function counted(ts: UseCompiler, parent: Node): boolean {
  return (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent))
    && (parent.operator === ts.SyntaxKind.PlusPlusToken || parent.operator === ts.SyntaxKind.MinusMinusToken)
}

/**
 * Whether the expression is written to: assigned, destructured into, counted, deleted or iterated into;
 * for a plain assignment of the expression itself, also the value it writes.
 */
function writeOf(ts: UseCompiler, node: Node): { assigned?: Node } | undefined {
  let target = node
  while (patternPart(ts, target.parent, target)) target = target.parent
  const parent = target.parent
  const direct = target === node || wrapper(ts, target)
  if (ts.isBinaryExpression(parent) && parent.left === target) return assignment(ts, parent, direct)
  if ((ts.isForInStatement(parent) || ts.isForOfStatement(parent)) && parent.initializer === target) return {}
  return direct && (counted(ts, parent) || ts.isDeleteExpression(parent)) ? {} : undefined
}

function literalKey(ts: UseCompiler, node: Node): string | undefined {
  return ts.isStringLiteral(node) || ts.isNumericLiteral(node) ? node.text : undefined
}

/** A call through the expression passes the object before its last property as `this`. */
function calledThrough(ts: UseCompiler, node: Node): boolean {
  const parent = node.parent
  if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) return parent.expression === node
  return ts.isTaggedTemplateExpression(parent) && parent.tag === node
}

/** The property an access on the expression reads, when the parent is a property or literal element access. */
function accessKey(ts: UseCompiler, parent: Node, object: Node): string | undefined {
  if (ts.isPropertyAccessExpression(parent)) {
    return parent.expression === object && ts.isIdentifier(parent.name) ? parent.name.text : undefined
  }
  if (!ts.isElementAccessExpression(parent) || parent.expression !== object) return undefined
  return literalKey(ts, parent.argumentExpression)
}

/** Follow property and literal element access from a use to the whole expression it reads or writes. */
export function useOf(ts: UseCompiler, reference: Node): Use {
  let chain = reference
  let receiver: Node | undefined
  const path: string[] = []
  for (;;) {
    const parent = chain.parent
    if (wrapper(ts, parent)) { chain = parent; continue }
    const key = accessKey(ts, parent, chain)
    if (key === undefined) break
    receiver = chain
    path.push(key)
    chain = parent
  }
  const write = writeOf(ts, chain)
  if (write !== undefined) return { kind: 'write', path, reference, value: chain, ...write }
  if (receiver !== undefined && calledThrough(ts, chain)) {
    return { kind: path.length > 1 ? 'read' : 'escape', path: path.slice(0, -1), reference, value: receiver }
  }
  return { kind: path.length > 0 ? 'read' : 'escape', path, reference, value: chain }
}

/** The local names imports bind, which can stand for a variable another file declares. */
export function importedName(ts: UseCompiler, node: Node): boolean {
  const parent = node.parent
  if (ts.isImportClause(parent)) return parent.name === node
  return (ts.isImportSpecifier(parent) || ts.isNamespaceImport(parent) || ts.isImportEqualsDeclaration(parent))
    && parent.name === node
}

/** A name in a type, such as `typeof config`, reads nothing at runtime. */
export function typePosition(ts: UseCompiler, node: Node): boolean {
  let current = node
  while (ts.isQualifiedName(current.parent)) current = current.parent
  return ts.isTypeQueryNode(current.parent)
}

/** A name an export statement states: `export { config }` or `export default config`. */
export function exportStatement(ts: UseCompiler, node: Node): boolean {
  const parent = node.parent
  return ts.isExportSpecifier(parent) || (ts.isExportAssignment(parent) && parent.expression === node)
}

export function exported(ts: UseCompiler, declaration: Node): boolean {
  const statement = declaration.parent.parent as Modified | undefined
  return statement?.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) === true
}

/** A variable a top-level statement declares. */
export function topLevel(ts: UseCompiler, declaration: Node): boolean {
  const statement = declaration.parent?.parent
  return statement?.parent !== undefined && ts.isSourceFile(statement.parent)
}

/** A file with no import, export, `require` or `exports` is a script, whose top-level names are globals. */
export function scriptFile(ts: UseCompiler, source: SourceFile, names: ReadonlyMap<string, readonly Identifier[]>): boolean {
  if (ts.isExternalModule(source) || /\.[cm]js$/.test(source.fileName)) return false
  const required = (names.get('require') ?? []).some(node => ts.isCallExpression(node.parent) && node.parent.expression === node)
  const exporting = ['module', 'exports'].some(name => (names.get(name) ?? [])
    .some(node => ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node))
  return !required && !exporting
}
