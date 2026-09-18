import { bindingUses, type BindingChecker, type BindingCompiler, type Bindings } from './http-bindings.ts'
import { computedPart, configuredPart, type UrlPart } from './http-url.ts'

/*
 * The compiler-dependent half of an HTTP request producer, shared by the framework scanners. Each of
 * them passes the classic `typescript` module it pins and bundles, because the repository's own
 * `typescript` package is the 7.x SDK, which has no classic API to import types from. The TypeScript
 * scanner keeps its own copy in typescript/src/http-values.ts, which reads that SDK's syntax tree;
 * change both together.
 */
interface Node {
  kind: number
  parent: Node
  getSourceFile(): { fileName: string; isDeclarationFile: boolean }
}
interface TextNode extends Node { text: string }
interface Wrapped extends Node { expression: Node }
interface Access extends Node { expression: Node; name: Node }
interface Template extends Node {
  head: { text: string }
  templateSpans: readonly { expression: Node; literal: { text: string } }[]
}
interface Binary extends Node { left: Node; right: Node; operatorToken: { kind: number } }
interface Property extends Node { name?: Node }
interface ObjectLiteral extends Node { properties: readonly Property[] }
interface Variable extends Node { name: Node; initializer?: Node; parent: Node & { flags: number } }
interface ImportDeclaration extends Node { moduleSpecifier: Node }
interface ImportClause extends Node { parent: ImportDeclaration }
interface NamespaceImport extends Node { name: Node; parent: ImportClause }
interface ImportSpecifier extends Node { name: TextNode; propertyName?: TextNode; parent: Node & { parent: ImportClause } }
interface CompilerSymbol {
  flags: number
  valueDeclaration?: Node
  declarations?: readonly Node[]
}
interface Checker extends BindingChecker {
  getSymbolAtLocation(node: Node): CompilerSymbol | undefined
  getAliasedSymbol(symbol: CompilerSymbol): CompilerSymbol
}

export interface UrlCompiler extends BindingCompiler {
  SyntaxKind: BindingCompiler['SyntaxKind'] & { PlusToken: number; ThisKeyword: number }
  NodeFlags: { Const: number }
  isStringLiteral(node: Node): node is TextNode
  isNumericLiteral(node: Node): node is TextNode
  isNoSubstitutionTemplateLiteral(node: Node): node is TextNode
  isTemplateExpression(node: Node): node is Template
  isBinaryExpression(node: Node): node is Binary
  isIdentifier(node: Node): node is TextNode
  isPropertyAccessExpression(node: Node): node is Access
  isObjectLiteralExpression(node: Node): node is ObjectLiteral
  isPropertyAssignment(node: Node): node is Node & { initializer: Node }
  isVariableDeclaration(node: Node): node is Variable
  isMetaProperty(node: Node): boolean
  isImportClause(node: Node): node is ImportClause
  isNamespaceImport(node: Node): node is NamespaceImport
  isImportSpecifier(node: Node): node is ImportSpecifier
  isParenthesizedExpression(node: Node): node is Wrapped
  isAsExpression(node: Node): node is Wrapped
  isSatisfiesExpression(node: Node): node is Wrapped
  isNonNullExpression(node: Node): node is Wrapped
  isTypeAssertionExpression(node: Node): node is Wrapped
  isGetAccessorDeclaration(node: Node): boolean
  isSetAccessorDeclaration(node: Node): boolean
}

export interface UrlContext {
  ts: UrlCompiler
  checker: Checker
  /** How the analyzed sources use each variable, so a property is read only while nothing changes it. */
  bindings: Bindings
}

/**
 * The context a scanner's readers share. `sources` are every file the scanner analyzes, so a change
 * anywhere in them is seen; `fileAlone` marks a scanner that reads each file by itself.
 */
export function urlContext<C extends UrlCompiler, K extends Checker>(
  ts: C, checker: K, sources: readonly (Node & { fileName: string })[], fileAlone = false,
): { ts: C; checker: K; bindings: Bindings } {
  return { ts, checker, bindings: bindingUses({ ts, checker }, sources, { fileAlone }) }
}

/**
 * What an expression certainly holds: the expression that states its value, `absent` for a property
 * a readable object literal does not have, `unseen` for a value outside the sources, such as
 * configuration, and `unknown` for anything computed, reassignable or changed.
 */
export type Held = { node: Node } | 'absent' | 'unseen' | 'unknown'

const MAX_DEPTH = 8
const methodToken = /^[A-Z][A-Z-]*$/

/**
 * The declaration a name resolves to, following an import alias to its target. A caller names its own
 * compiler's declaration type, of which these structural types describe a part.
 */
export function declarationOf<D extends Node = Node>({ ts, checker }: UrlContext, node: Node): D | undefined {
  let symbol = checker.getSymbolAtLocation(node)
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol)
  return (symbol?.valueDeclaration ?? symbol?.declarations?.[0]) as D | undefined
}

/** The module an imported name comes from and the export it names, `default` and `*` included. */
export function importOrigin({ ts, checker }: UrlContext, node: Node): { module: string; name: string } | undefined {
  const declaration = checker.getSymbolAtLocation(node)?.declarations?.[0]
  if (declaration === undefined) return undefined
  const imported = ts.isImportClause(declaration) ? { clause: declaration, name: 'default' }
    : ts.isNamespaceImport(declaration) ? { clause: declaration.parent, name: '*' }
      : ts.isImportSpecifier(declaration)
        ? { clause: declaration.parent.parent, name: (declaration.propertyName ?? declaration.name).text }
        : undefined
  const specifier = imported?.clause.parent.moduleSpecifier
  return specifier !== undefined && ts.isStringLiteral(specifier) ? { module: specifier.text, name: imported!.name } : undefined
}

function unwrapped(ts: UrlCompiler, node: Node): Node {
  let current = node
  while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isSatisfiesExpression(current)
    || ts.isNonNullExpression(current) || ts.isTypeAssertionExpression(current)) current = current.expression
  return current
}

function keyOf(ts: UrlCompiler, property: Property): string | undefined {
  const name = property.name
  if (name === undefined) return undefined
  return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? name.text : undefined
}

/**
 * The value an object literal gives one property. The last property with the name wins; a spread or a
 * computed name could be that property, a method or shorthand states no literal value, and an
 * accessor can change any property of its object.
 */
function ownProperty(ts: UrlCompiler, object: ObjectLiteral, name: string): Held {
  let found: Held = 'absent'
  for (const property of object.properties) {
    const key = keyOf(ts, property)
    if (key === undefined || ts.isGetAccessorDeclaration(property) || ts.isSetAccessorDeclaration(property)) return 'unknown'
    if (key === name) found = ts.isPropertyAssignment(property) ? { node: property.initializer } : 'unknown'
  }
  return found
}

/** A `const`, or a variable declared once that the sources never assign again, keeps its initializer. */
function unassigned(context: UrlContext, declaration: Variable): boolean {
  const { ts, checker } = context
  if ((declaration.parent.flags & ts.NodeFlags.Const) !== 0) return true
  const declarations = checker.getSymbolAtLocation(declaration.name)?.declarations ?? []
  return declarations.length === 1 && !context.bindings.reassigned(declaration)
}

/** A variable holds its initializer; a property path through it holds only while no use can change it. */
function variableHeld(context: UrlContext, name: Node, path: readonly string[], depth: number): Held {
  const { ts } = context
  const declaration = declarationOf(context, name)
  if (declaration === undefined || declaration.getSourceFile().isDeclarationFile) return 'unseen'
  if (!ts.isVariableDeclaration(declaration) || declaration.initializer === undefined) return 'unknown'
  if (!ts.isIdentifier(declaration.name) || !unassigned(context, declaration)) return 'unknown'
  if (path.length > 0 && !context.bindings.unchanged(declaration, path, name)) return 'unknown'
  return held(context, declaration.initializer, path, depth + 1)
}

function held(context: UrlContext, node: Node, path: readonly string[], depth: number): Held {
  const { ts } = context
  if (depth > MAX_DEPTH) return 'unknown'
  const value = unwrapped(ts, node)
  const [name, ...rest] = path
  if (ts.isObjectLiteralExpression(value) && name !== undefined) {
    const property = ownProperty(ts, value, name)
    if (typeof property !== 'string') return held(context, property.node, rest, depth + 1)
    return property === 'absent' && rest.length === 0 ? 'absent' : 'unknown'
  }
  if (ts.isPropertyAccessExpression(value) && ts.isIdentifier(value.name)) {
    return held(context, value.expression, [value.name.text, ...path], depth + 1)
  }
  if (ts.isIdentifier(value)) return variableHeld(context, value, path, depth)
  if (name === undefined) return { node: value }
  // `import.meta.env` is the runtime's configuration, and a field read through `this` holds the
  // client's own setting, such as its base URL.
  return ts.isMetaProperty(value) || value.kind === ts.SyntaxKind.ThisKeyword ? 'unseen' : 'unknown'
}

/**
 * What an expression certainly holds, read through variables and object-literal properties: the
 * expression itself without `path`, else the property at that path of the object it holds.
 */
export function heldAt(context: UrlContext, node: Node, ...path: string[]): Held {
  return held(context, node, path, 0)
}

/** A held value as URL text: a value outside the sources is configuration, anything else unknown is computed. */
export function heldParts(context: UrlContext, value: Held): UrlPart[] {
  if (value === 'unseen') return [configuredPart]
  return typeof value === 'string' ? [computedPart] : urlParts(context, value.node)
}

/** Resolve a URL expression into literal text and the holes the source computes. */
export function urlParts(context: UrlContext, node: Node, depth = 0): UrlPart[] {
  const { ts } = context
  if (depth > MAX_DEPTH) return [computedPart]
  const value = unwrapped(ts, node)
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return [{ kind: 'text', text: value.text }]
  if (ts.isTemplateExpression(value)) {
    const parts: UrlPart[] = [{ kind: 'text', text: value.head.text }]
    for (const span of value.templateSpans) {
      parts.push(...urlParts(context, span.expression, depth + 1), { kind: 'text', text: span.literal.text })
    }
    return parts
  }
  if (ts.isBinaryExpression(value) && value.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return [...urlParts(context, value.left, depth + 1), ...urlParts(context, value.right, depth + 1)]
  }
  if (!ts.isIdentifier(value) && !ts.isPropertyAccessExpression(value)) return [computedPart]
  const resolved = held(context, value, [], depth + 1)
  return typeof resolved === 'string' ? heldParts(context, resolved) : urlParts(context, resolved.node, depth + 1)
}

/** Text a method needs; anything computed leaves the method out of the fact. */
export function methodName(context: UrlContext, node: Node | undefined): string | undefined {
  if (node === undefined) return undefined
  const parts = urlParts(context, node)
  const [first] = parts
  const method = parts.length === 1 && first?.kind === 'text' ? first.text.toUpperCase() : undefined
  return method !== undefined && methodToken.test(method) ? method : undefined
}
