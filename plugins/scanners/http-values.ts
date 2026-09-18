import { bindingUses, type BindingChecker, type BindingCompiler, type Bindings } from './http-bindings.ts'
import {
  ownProperty, propertyKey, unwrapped, type Held as SyntaxHeld, type ImportOrigin, type SyntaxCompiler,
} from './http-syntax.ts'
import { computedPart, configuredPart, methodText, type UrlPart } from './http-url.ts'
import { requiredModule } from './http-uses.ts'

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
interface ObjectLiteral extends Node { properties: readonly (Node & { name?: Node })[] }
interface Variable extends Node { name: Node; initializer?: Node; parent: Node & { flags: number } }
interface BindingElement extends Node { name: Node; propertyName?: Node; parent: Node & { parent: Node } }
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

export interface UrlCompiler extends BindingCompiler, SyntaxCompiler {
  SyntaxKind: BindingCompiler['SyntaxKind'] & SyntaxCompiler['SyntaxKind'] & { ThisKeyword: number }
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
  isFunctionDeclaration(node: Node): boolean
  isImportClause(node: Node): node is ImportClause
  isNamespaceImport(node: Node): node is NamespaceImport
  isImportSpecifier(node: Node): node is ImportSpecifier
  isBindingElement(node: Node): node is BindingElement
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

/** What an expression certainly holds, as ./http-syntax.ts describes it. */
export type Held = SyntaxHeld<Node>

const MAX_DEPTH = 8

/**
 * The declaration a name resolves to, following an import alias to its target. A caller names its own
 * compiler's declaration type, of which these structural types describe a part.
 */
export function declarationOf<D extends Node = Node>({ ts, checker }: UrlContext, node: Node): D | undefined {
  let symbol = checker.getSymbolAtLocation(node)
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol)
  return (symbol?.valueDeclaration ?? symbol?.declarations?.[0]) as D | undefined
}

/**
 * The module an imported or required name comes from and the export it names. A `require('m')` call is
 * the module's default export, and a CommonJS binding counts only while the sources never assign it
 * again.
 */
export function importOrigin(context: UrlContext, node: Node): ImportOrigin | undefined {
  const { ts, checker } = context
  const required = requiredModule(ts, node)
  if (required !== undefined) return { module: required, name: 'default' }
  const declaration = checker.getSymbolAtLocation(node)?.declarations?.[0]
  if (declaration === undefined) return undefined
  if (ts.isVariableDeclaration(declaration) || ts.isBindingElement(declaration)) return requireOrigin(context, declaration)
  const imported = ts.isImportClause(declaration) ? { clause: declaration, name: 'default' }
    : ts.isNamespaceImport(declaration) ? { clause: declaration.parent, name: '*' }
      : ts.isImportSpecifier(declaration)
        ? { clause: declaration.parent.parent, name: (declaration.propertyName ?? declaration.name).text }
        : undefined
  const specifier = imported?.clause.parent.moduleSpecifier
  return specifier !== undefined && ts.isStringLiteral(specifier) ? { module: specifier.text, name: imported!.name } : undefined
}

/**
 * A declaration in an ambient context, such as a `declare` statement or `declare global`, whose value
 * lives outside the sources. The classic compilers keep the flag out of their public types.
 */
function ambient(ts: UrlCompiler, declaration: Node & { flags?: number }): boolean {
  const flag = (ts.NodeFlags as { Ambient?: number }).Ambient ?? 0
  return ((declaration.flags ?? 0) & flag) !== 0
}

/**
 * A `const`, or a variable declared once that the sources never assign again, keeps its initializer.
 * A destructured name counts by its own assignments and the declaration list that holds it.
 */
export function unassigned(context: UrlContext, declaration: Variable | BindingElement): boolean {
  const { ts, checker } = context
  const list = ts.isVariableDeclaration(declaration) ? declaration.parent : declaration.parent.parent.parent as Node & { flags?: number }
  if (((list.flags ?? 0) & ts.NodeFlags.Const) !== 0) return true
  const declarations = checker.getSymbolAtLocation(declaration.name)?.declarations ?? []
  return declarations.length === 1 && !context.bindings.reassigned(declaration)
}

/** The module export a CommonJS declaration binds, before asking whether the binding keeps it. */
function requiredExport(ts: UrlCompiler, declaration: Variable | BindingElement): ImportOrigin | undefined {
  if (ts.isBindingElement(declaration)) {
    const variable = declaration.parent.parent
    const module = ts.isVariableDeclaration(variable) ? requiredModule(ts, variable.initializer) : undefined
    const key = declaration.propertyName ?? declaration.name
    return module !== undefined && ts.isIdentifier(key) ? { module, name: key.text } : undefined
  }
  const value = declaration.initializer === undefined ? undefined : unwrapped(ts, declaration.initializer)
  const direct = requiredModule(ts, value)
  if (direct !== undefined) return { module: direct, name: 'default' }
  if (value === undefined || !ts.isPropertyAccessExpression(value) || !ts.isIdentifier(value.name)) return undefined
  const module = requiredModule(ts, unwrapped(ts, value.expression))
  return module === undefined ? undefined : { module, name: value.name.text }
}

/** `const m = require('m')`, `const name = require('m').name` and `const { name } = require('m')`. */
function requireOrigin(context: UrlContext, declaration: Variable | BindingElement): ImportOrigin | undefined {
  const origin = requiredExport(context.ts, declaration)
  return origin !== undefined && unassigned(context, declaration) ? origin : undefined
}

/** A variable holds its initializer; a property path through it holds only while no use can change it. */
function variableHeld(context: UrlContext, name: Node, path: readonly string[], depth: number): Held {
  const { ts } = context
  const declaration = declarationOf(context, name)
  // A name only a declaration file or a `declare` statement states has no value the scanner can see.
  if (declaration === undefined || declaration.getSourceFile().isDeclarationFile) return 'unseen'
  if (ambient(ts, declaration)) return 'unseen'
  // A function the name declares is the value it holds, such as a route's handler.
  if (path.length === 0 && ts.isFunctionDeclaration(declaration)) return { node: declaration }
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
    const property = ownProperty<Node>(ts, value, name)
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

/** Literal text an expression states; anything computed states none. */
export function literalText(context: UrlContext, node: Node | undefined): string | undefined {
  if (node === undefined) return undefined
  const [first, ...rest] = urlParts(context, node)
  return rest.length === 0 && first?.kind === 'text' ? first.text : undefined
}

/** Text a method needs; anything computed leaves the method out of the fact. */
export function methodName(context: UrlContext, node: Node | undefined): string | undefined {
  return methodText(literalText(context, node))
}

/**
 * The properties of the object literal an expression certainly holds, by name, the last of a name
 * winning; undefined when the literal has a key the scanner cannot read, such as a spread.
 */
export function objectEntries(context: UrlContext, node: Node | undefined): Map<string, Node> | undefined {
  const { ts } = context
  const value = node === undefined ? undefined : heldAt(context, node)
  if (typeof value !== 'object' || !ts.isObjectLiteralExpression(value.node)) return undefined
  const entries = new Map<string, Node>()
  for (const property of value.node.properties) {
    const key = propertyKey(ts, property)
    if (key === undefined || ts.isGetAccessorDeclaration(property) || ts.isSetAccessorDeclaration(property)) return undefined
    if (ts.isPropertyAssignment(property)) entries.set(key, property.initializer)
    else entries.delete(key)
  }
  return entries
}
