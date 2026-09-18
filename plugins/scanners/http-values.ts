import { bindingUses, type Bindings } from './http-bindings.ts'
import type { Checker } from './http-checker.ts'
import {
  ownProperty, propertyKey, unwrapped,
  type Held, type ImportOrigin, type Node, type SourceFile, type SyntaxCompiler, type TextNode,
} from './http-syntax.ts'
import { computedPart, configuredPart, methodText, type UrlPart } from './http-url.ts'
import { boundExport, requiredModule, type IndexCompiler } from './http-uses.ts'

/*
 * The values the TypeScript-family HTTP readers fold: what a name certainly holds, URL text, methods,
 * option objects, and where an imported or required name comes from. Every scanner in the family reads
 * them here, the framework scanners over the classic compiler they bundle and the TypeScript scanner
 * over the native SDK, each through its own Checker adapter.
 */
interface Access extends Node { expression: Node; name: TextNode }
interface Template extends Node {
  head: { text: string }
  templateSpans: readonly { expression: Node; literal: { text: string } }[]
}
interface Binary extends Node { left: Node; right: Node; operatorToken: { kind: number } }
interface ObjectLiteral extends Node { properties: readonly (Node & { name?: Node })[] }
interface Variable extends Node { name: Node; initializer?: Node; parent: Node & { flags: number } }
interface BindingElement extends Node { name?: Node; propertyName?: Node; parent: Node & { parent: Node } }

export interface UrlCompiler extends IndexCompiler, SyntaxCompiler {
  SyntaxKind: IndexCompiler['SyntaxKind'] & SyntaxCompiler['SyntaxKind'] & { ThisKeyword: number }
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
  isBindingElement(node: Node): node is BindingElement
  isGetAccessorDeclaration(node: Node): boolean
  isSetAccessorDeclaration(node: Node): boolean
}

/** What every HTTP reader of a scan shares: the compiler's syntax, its checker, and how the sources use each variable. */
export interface UrlContext {
  ts: UrlCompiler
  checker: Checker
  bindings: Bindings
}

/**
 * The context a scanner's readers share. `sources` are every file the scanner analyzes, so a change
 * anywhere in them is seen; `fileAlone` marks a scanner that reads each file by itself.
 */
export function urlContext<C extends UrlCompiler>(
  ts: C, checker: Checker, sources: readonly SourceFile[], fileAlone = false,
): { ts: C; checker: Checker; bindings: Bindings } {
  return { ts, checker, bindings: bindingUses(ts, checker, sources, { fileAlone }) }
}

const MAX_DEPTH = 8

/** A declaration file states types, never a value the scanner can read. */
function declarationFile(node: Node): boolean {
  return /\.d\.[cm]?ts$/.test(node.getSourceFile().fileName)
}

/** The declaration a name resolves to, following an import alias to its target. */
export async function declarationOf(context: UrlContext, node: Node): Promise<Node | undefined> {
  const { checker } = context
  const [symbol] = await checker.symbolsAt([node])
  return symbol === undefined ? undefined : checker.declaration(await checker.aliased(symbol))
}

const moduleNamesByFile = new WeakMap<SourceFile, Set<string>>()

/** The names a file binds to a module, by import or `require`, which only those names can come from. */
function moduleNames(ts: UrlCompiler, source: SourceFile): Set<string> {
  let names = moduleNamesByFile.get(source)
  if (names !== undefined) return names
  const found = new Set<string>()
  const visit = (node: Node): void => {
    const name = (node as Node & { name?: Node }).name
    if (name !== undefined && ts.isIdentifier(name) && boundExport(ts, node) !== undefined) found.add(name.text)
    ts.forEachChild(node, visit)
  }
  visit(source)
  names = found
  moduleNamesByFile.set(source, names)
  return names
}

/**
 * The module an imported or required name comes from and the export it names. A `require('m')` call is
 * the module's default export, a name that shadows an import is not it, and a CommonJS binding counts
 * only while the sources never assign it again.
 */
export async function importOrigin(context: UrlContext, node: Node): Promise<ImportOrigin | undefined> {
  const { ts, checker } = context
  const required = requiredModule(ts, node)
  if (required !== undefined) return { module: required, name: 'default' }
  if (!ts.isIdentifier(node) || !moduleNames(ts, node.getSourceFile()).has(node.text)) return undefined
  const [symbol] = await checker.symbolsAt([node])
  const declaration = symbol === undefined ? undefined : await checker.declaration(symbol)
  const origin = declaration === undefined ? undefined : boundExport(ts, declaration)
  if (origin === undefined || (!ts.isVariableDeclaration(declaration!) && !ts.isBindingElement(declaration!))) return origin
  return await unassigned(context, declaration) ? origin : undefined
}

/**
 * A name nothing in the sources declares or imports, or that only a declaration file states, which the
 * runtime provides, such as `fetch` or `Bun`.
 */
export async function runtimeGlobal(context: UrlContext, node: Node): Promise<boolean> {
  if (await importOrigin(context, node) !== undefined) return false
  const declaration = await declarationOf(context, node)
  return declaration === undefined || declarationFile(declaration)
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
export async function unassigned(context: UrlContext, declaration: Variable | BindingElement): Promise<boolean> {
  const { ts, checker } = context
  const list = ts.isVariableDeclaration(declaration) ? declaration.parent : declaration.parent.parent.parent as Node & { flags?: number }
  if (((list.flags ?? 0) & ts.NodeFlags.Const) !== 0) return true
  if (declaration.name === undefined) return false
  const [symbol] = await checker.symbolsAt([declaration.name])
  return symbol !== undefined && checker.declarationCount(symbol) === 1 && !await context.bindings.reassigned(declaration)
}

/** A variable holds its initializer; a property path through it holds only while no use can change it. */
async function variableHeld(context: UrlContext, name: Node, path: readonly string[], depth: number): Promise<Held> {
  const { ts } = context
  const declaration = await declarationOf(context, name)
  // A name only a declaration file or a `declare` statement states has no value the scanner can see.
  if (declaration === undefined || declarationFile(declaration) || ambient(ts, declaration)) return 'unseen'
  // A function the name declares is the value it holds, such as a route's handler.
  if (path.length === 0 && ts.isFunctionDeclaration(declaration)) return { node: declaration }
  if (!ts.isVariableDeclaration(declaration) || declaration.initializer === undefined) return 'unknown'
  if (!ts.isIdentifier(declaration.name) || !await unassigned(context, declaration)) return 'unknown'
  if (path.length > 0 && !await context.bindings.unchanged(declaration, path, name)) return 'unknown'
  return held(context, declaration.initializer, path, depth + 1)
}

async function held(context: UrlContext, node: Node, path: readonly string[], depth: number): Promise<Held> {
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
export function heldAt(context: UrlContext, node: Node, ...path: string[]): Promise<Held> {
  return held(context, node, path, 0)
}

/** A held value as URL text: a value outside the sources is configuration, anything else unknown is computed. */
export async function heldParts(context: UrlContext, value: Held): Promise<UrlPart[]> {
  if (value === 'unseen') return [configuredPart]
  return typeof value === 'string' ? [computedPart] : urlParts(context, value.node)
}

/** Resolve a URL expression into literal text and the holes the source computes. */
export async function urlParts(context: UrlContext, node: Node, depth = 0): Promise<UrlPart[]> {
  const { ts } = context
  if (depth > MAX_DEPTH) return [computedPart]
  const value = unwrapped(ts, node)
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return [{ kind: 'text', text: value.text }]
  if (ts.isTemplateExpression(value)) {
    const parts: UrlPart[] = [{ kind: 'text', text: value.head.text }]
    for (const span of value.templateSpans) {
      parts.push(...await urlParts(context, span.expression, depth + 1), { kind: 'text', text: span.literal.text })
    }
    return parts
  }
  if (ts.isBinaryExpression(value) && value.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return [...await urlParts(context, value.left, depth + 1), ...await urlParts(context, value.right, depth + 1)]
  }
  if (!ts.isIdentifier(value) && !ts.isPropertyAccessExpression(value)) return [computedPart]
  const resolved = await held(context, value, [], depth + 1)
  return typeof resolved === 'string' ? heldParts(context, resolved) : urlParts(context, resolved.node, depth + 1)
}

/** Literal text an expression states; anything computed states none. */
export async function literalText(context: UrlContext, node: Node | undefined): Promise<string | undefined> {
  if (node === undefined) return undefined
  const [first, ...rest] = await urlParts(context, node)
  return rest.length === 0 && first?.kind === 'text' ? first.text : undefined
}

/** Text a method needs; anything computed leaves the method out of the fact. */
export async function methodName(context: UrlContext, node: Node | undefined): Promise<string | undefined> {
  return methodText(await literalText(context, node))
}

/**
 * The properties of the object literal an expression certainly holds, by name, the last of a name
 * winning; undefined when the literal has a key the scanner cannot read, such as a spread.
 */
export async function objectEntries(context: UrlContext, node: Node | undefined): Promise<Map<string, Node> | undefined> {
  const { ts } = context
  const value = node === undefined ? undefined : await heldAt(context, node)
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
