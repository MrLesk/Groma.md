import {
  isBinaryExpression, isFunctionDeclaration, isGetAccessorDeclaration, isIdentifier, isImportClause,
  isImportDeclaration, isImportSpecifier, isMetaProperty, isNamespaceImport, isNoSubstitutionTemplateLiteral,
  isObjectLiteralExpression, isPropertyAccessExpression, isPropertyAssignment, isSetAccessorDeclaration,
  isStringLiteral, isTemplateExpression, isVariableDeclaration, NodeFlags, SyntaxKind,
  type Node, type SourceFile, type VariableDeclaration,
} from 'typescript/unstable/ast'
import { SymbolFlags, type Checker } from 'typescript/unstable/async'

import { ownProperty, propertyKey, unwrapped, type Held as SyntaxHeld } from '../../http-syntax.ts'
import { computedPart, configuredPart, type UrlPart } from '../../http-url.ts'
import { syntax, type Bindings } from './http-bindings.ts'

/*
 * The value rules of ../../http-values.ts, which the framework scanners run over the classic compiler,
 * asked of the native SDK's asynchronous checker. Change both together.
 */

export interface HttpContext {
  checker: Checker
  /** How the program's sources use each variable, so a property is read only while nothing changes it. */
  bindings: Bindings
  /** Certain values of an expression, such as object literals and functions; undefined when unresolved. */
  values(node: Node): Promise<Node[] | undefined>
  /** The operation serving a route: its resolved handler when certain, else the registering operation. */
  handlerOperation(handler: Node | undefined, registration: Node): Promise<string>
  /** The operation that runs this expression. */
  callerOperation(node: Node): string
  /** The repository-relative path of the file that holds a node. */
  file(node: Node): string
}

/** Where a local name comes from, for recognizing a framework without resolving its types. */
export interface ImportOrigin {
  module: string
  /** The imported name: `default`, `*`, or the exported name. */
  name: string
}

/** What an expression certainly holds, as ../../http-syntax.ts describes it. */
export type Held = SyntaxHeld<Node>

const MAX_DEPTH = 8
const methodToken = /^[A-Z][A-Z-]*$/

/** An import in the name's own file binds the same spelling; the checker then tells whether it is that import. */
function spelledImport(node: Node): boolean {
  if (!isIdentifier(node)) return false
  const source: SourceFile = node.getSourceFile()
  return source.statements.some(statement => {
    const clause = isImportDeclaration(statement) ? statement.importClause : undefined
    if (clause === undefined) return false
    const bindings = clause.namedBindings
    const named = bindings !== undefined && !isNamespaceImport(bindings) && bindings.elements.some(entry => entry.name.text === node.text)
    return clause.name?.text === node.text || (bindings !== undefined && isNamespaceImport(bindings) && bindings.name.text === node.text) || named
  })
}

/** The module an imported name comes from and the export it names; a shadowing name is not the import. */
export async function importOrigin(node: Node, checker: Checker): Promise<ImportOrigin | undefined> {
  if (!spelledImport(node)) return undefined
  const [symbol] = await checker.getSymbolAtLocation([node])
  const declaration = await symbol?.declarations[0]?.resolve()
  if (declaration === undefined) return undefined
  const imported = isImportClause(declaration) ? { clause: declaration, name: 'default' }
    : isNamespaceImport(declaration) ? { clause: declaration.parent, name: '*' }
      : isImportSpecifier(declaration)
        ? { clause: declaration.parent.parent, name: (declaration.propertyName ?? declaration.name).text }
        : undefined
  const statement = imported?.clause.parent
  const specifier = statement !== undefined && isImportDeclaration(statement) ? statement.moduleSpecifier : undefined
  return specifier !== undefined && isStringLiteral(specifier) ? { module: specifier.text, name: imported!.name } : undefined
}

export async function declarationOf(node: Node, checker: Checker): Promise<Node | undefined> {
  const [symbol] = await checker.getSymbolAtLocation([node])
  if (!symbol) return undefined
  const canonical = symbol.flags & SymbolFlags.Alias ? await checker.getAliasedSymbol(symbol) : symbol
  return (canonical.valueDeclaration ?? canonical.declarations[0])?.resolve()
}

/** A declaration in an ambient context, such as a `declare` statement or `declare global`, whose value lives outside the sources. */
function ambient(declaration: Node): boolean {
  return (declaration.flags & NodeFlags.Ambient) !== 0
}

/** A `const`, or a variable declared once that the sources never assign again, keeps its initializer. */
async function unassigned(declaration: VariableDeclaration, context: HttpContext): Promise<boolean> {
  if (declaration.parent.flags & NodeFlags.Const) return true
  const [symbol] = await context.checker.getSymbolAtLocation([declaration.name])
  return (symbol?.declarations.length ?? 0) === 1 && !await context.bindings.reassigned(declaration)
}

/** A variable holds its initializer; a property path through it holds only while no use can change it. */
async function variableHeld(name: Node, path: readonly string[], context: HttpContext, depth: number): Promise<Held> {
  const declaration = await declarationOf(name, context.checker)
  if (declaration === undefined || declaration.getSourceFile().fileName.endsWith('.d.ts') || ambient(declaration)) return 'unseen'
  // A function the name declares is the value it holds, such as a route's handler.
  if (path.length === 0 && isFunctionDeclaration(declaration)) return { node: declaration }
  if (!isVariableDeclaration(declaration) || declaration.initializer === undefined) return 'unknown'
  if (!isIdentifier(declaration.name) || !await unassigned(declaration, context)) return 'unknown'
  if (path.length > 0 && !await context.bindings.unchanged(declaration, path, name)) return 'unknown'
  return held(declaration.initializer, path, context, depth + 1)
}

async function held(node: Node, path: readonly string[], context: HttpContext, depth: number): Promise<Held> {
  if (depth > MAX_DEPTH) return 'unknown'
  const value = unwrapped(syntax, node)
  const [name, ...rest] = path
  if (isObjectLiteralExpression(value) && name !== undefined) {
    const property = ownProperty<Node>(syntax, value, name)
    if (typeof property !== 'string') return held(property.node, rest, context, depth + 1)
    return property === 'absent' && rest.length === 0 ? 'absent' : 'unknown'
  }
  if (isPropertyAccessExpression(value) && isIdentifier(value.name)) {
    return held(value.expression, [value.name.text, ...path], context, depth + 1)
  }
  if (isIdentifier(value)) return variableHeld(value, path, context, depth)
  if (name === undefined) return { node: value }
  // `import.meta.env` is the runtime's configuration, and a field read through `this` holds the
  // client's own setting, such as its base URL.
  return isMetaProperty(value) || value.kind === SyntaxKind.ThisKeyword ? 'unseen' : 'unknown'
}

/**
 * What an expression certainly holds, read through variables and object-literal properties: the
 * expression itself without `path`, else the property at that path of the object it holds.
 */
export function heldAt(context: HttpContext, node: Node, ...path: string[]): Promise<Held> {
  return held(node, path, context, 0)
}

/** A held value as URL text: a value outside the sources is configuration, anything else unknown is computed. */
export async function heldParts(context: HttpContext, value: Held): Promise<UrlPart[]> {
  if (value === 'unseen') return [configuredPart]
  return typeof value === 'string' ? [computedPart] : urlParts(value.node, context)
}

/** Resolve a URL expression into literal text and the holes the source computes. */
export async function urlParts(node: Node, context: HttpContext, depth = 0): Promise<UrlPart[]> {
  if (depth > MAX_DEPTH) return [computedPart]
  const value = unwrapped(syntax, node)
  if (isStringLiteral(value) || isNoSubstitutionTemplateLiteral(value)) return [{ kind: 'text', text: value.text }]
  if (isTemplateExpression(value)) {
    const parts: UrlPart[] = [{ kind: 'text', text: value.head.text }]
    for (const span of value.templateSpans) {
      parts.push(...await urlParts(span.expression, context, depth + 1), { kind: 'text', text: span.literal.text })
    }
    return parts
  }
  if (isBinaryExpression(value) && value.operatorToken.kind === SyntaxKind.PlusToken) {
    return [...await urlParts(value.left, context, depth + 1), ...await urlParts(value.right, context, depth + 1)]
  }
  if (!isIdentifier(value) && !isPropertyAccessExpression(value)) return [computedPart]
  const resolved = await held(value, [], context, depth + 1)
  return typeof resolved === 'string' ? heldParts(context, resolved) : urlParts(resolved.node, context, depth + 1)
}

/** Text a route or method needs; anything computed leaves the construct unsupported. */
export async function literalText(node: Node | undefined, context: HttpContext): Promise<string | undefined> {
  if (node === undefined) return undefined
  const parts = await urlParts(node, context)
  const [first] = parts
  return parts.length === 1 && first?.kind === 'text' ? first.text : undefined
}

/** An uppercase method token the shared contract accepts. */
export function methodName(text: string | undefined): string | undefined {
  const method = text?.toUpperCase()
  return method !== undefined && methodToken.test(method) ? method : undefined
}

/**
 * The properties of the object literal an expression certainly holds, by name, the last of a name
 * winning; undefined when the literal has a key the scanner cannot read, such as a spread.
 */
export async function objectEntries(node: Node | undefined, context: HttpContext): Promise<Map<string, Node> | undefined> {
  if (node === undefined) return undefined
  const value = await heldAt(context, node)
  if (typeof value !== 'object' || !isObjectLiteralExpression(value.node)) return undefined
  const entries = new Map<string, Node>()
  for (const property of value.node.properties) {
    const key = propertyKey(syntax, property)
    if (key === undefined || isGetAccessorDeclaration(property) || isSetAccessorDeclaration(property)) return undefined
    if (isPropertyAssignment(property)) entries.set(key, property.initializer)
    else entries.delete(key)
  }
  return entries
}
