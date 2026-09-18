import {
  isAsExpression, isBinaryExpression, isIdentifier, isImportDeclaration, isNamedImports,
  isNamespaceImport, isNoSubstitutionTemplateLiteral, isNonNullExpression, isObjectLiteralExpression,
  isParameterDeclaration, isParenthesizedExpression, isPropertyAccessExpression, isPropertyAssignment,
  isMetaProperty, isShorthandPropertyAssignment, isSpreadAssignment, isStringLiteral, isTemplateExpression,
  isVariableDeclaration, NodeFlags, SyntaxKind,
  type Node, type ObjectLiteralExpression, type ObjectLiteralElementLike, type SourceFile,
} from 'typescript/unstable/ast'
import { SymbolFlags, type Checker } from 'typescript/unstable/async'

import type { UrlPart } from './http-paths.ts'

export interface HttpContext {
  checker: Checker
  /** Certain values of an expression, such as object literals and functions; undefined when unresolved. */
  values(node: Node): Promise<Node[] | undefined>
  /** The operation serving a route: its resolved handler when certain, else the registering operation. */
  handlerOperation(handler: Node | undefined, registration: Node): Promise<string>
  /** The operation that runs this expression. */
  callerOperation(node: Node): string
}

/** Where a local name comes from, for recognizing a framework without resolving its types. */
export interface ImportOrigin {
  module: string
  /** The imported name: `default`, `*`, or the exported name. */
  name: string
}

const MAX_DEPTH = 8
const computed: UrlPart = { kind: 'hole', configured: false }

function importBinding(statement: Node, name: string): ImportOrigin | undefined {
  if (!isImportDeclaration(statement) || !statement.importClause) return undefined
  if (!isStringLiteral(statement.moduleSpecifier)) return undefined
  const module = statement.moduleSpecifier.text
  const clause = statement.importClause
  if (clause.name?.text === name) return { module, name: 'default' }
  const bindings = clause.namedBindings
  if (bindings && isNamespaceImport(bindings)) return bindings.name.text === name ? { module, name: '*' } : undefined
  if (bindings && isNamedImports(bindings)) {
    const element = bindings.elements.find(entry => entry.name.text === name)
    if (element) return { module, name: (element.propertyName ?? element.name).text }
  }
  return undefined
}

/** The import that introduced this identifier in its own file; re-exported wrappers are not followed. */
export function importOrigin(node: Node): ImportOrigin | undefined {
  if (!isIdentifier(node)) return undefined
  const source: SourceFile = node.getSourceFile()
  for (const statement of source.statements) {
    const origin = importBinding(statement, node.text)
    if (origin) return origin
  }
  return undefined
}

export async function declarationOf(node: Node, checker: Checker): Promise<Node | undefined> {
  const [symbol] = await checker.getSymbolAtLocation([node])
  if (!symbol) return undefined
  const canonical = symbol.flags & SymbolFlags.Alias ? await checker.getAliasedSymbol(symbol) : symbol
  return canonical.valueDeclaration?.resolve()
}

function constantDeclaration(declaration: Node): Node | undefined {
  if (isPropertyAssignment(declaration)) return declaration.initializer
  if (!isVariableDeclaration(declaration) || !declaration.initializer) return undefined
  return declaration.parent.flags & NodeFlags.Const ? declaration.initializer : undefined
}

function referenceRoot(node: Node): Node {
  let current = node
  while (isPropertyAccessExpression(current)) current = current.expression
  return current
}

const configuration: UrlPart = { kind: 'hole', configured: true }

/** `process.env.X` and `import.meta.env.X` read configuration, whatever ambient types declare them. */
function environmentRead(node: Node): boolean {
  if (!isPropertyAccessExpression(node) || !isPropertyAccessExpression(node.expression)) return false
  const owner = node.expression
  if (owner.name.text !== 'env') return false
  return isMetaProperty(owner.expression) || (isIdentifier(owner.expression) && owner.expression.text === 'process')
}

/** A value the scanner cannot see is configuration when its root is not project source. */
async function unseenValue(node: Node, context: HttpContext): Promise<UrlPart> {
  const root = referenceRoot(node)
  const declaration = isIdentifier(root) ? await declarationOf(root, context.checker) : undefined
  if (declaration === undefined) return configuration
  return declaration.getSourceFile().fileName.endsWith('.d.ts') ? configuration : computed
}

async function referenceParts(node: Node, context: HttpContext, depth: number): Promise<UrlPart[]> {
  if (environmentRead(node)) return [configuration]
  const declaration = await declarationOf(node, context.checker)
  if (declaration === undefined) return [await unseenValue(node, context)]
  if (isParameterDeclaration(declaration)) return [computed]
  const constant = constantDeclaration(declaration)
  return constant === undefined ? [computed] : urlParts(constant, context, depth + 1)
}

/** Resolve a URL expression into literal text and the holes the source computes. */
export async function urlParts(node: Node, context: HttpContext, depth = 0): Promise<UrlPart[]> {
  if (depth > MAX_DEPTH) return [computed]
  if (isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node)) return [{ kind: 'text', text: node.text }]
  if (isParenthesizedExpression(node) || isAsExpression(node) || isNonNullExpression(node)) {
    return urlParts(node.expression, context, depth + 1)
  }
  if (isTemplateExpression(node)) {
    const parts: UrlPart[] = [{ kind: 'text', text: node.head.text }]
    for (const span of node.templateSpans) {
      parts.push(...await urlParts(span.expression, context, depth + 1), { kind: 'text', text: span.literal.text })
    }
    return parts
  }
  if (isBinaryExpression(node) && node.operatorToken.kind === SyntaxKind.PlusToken) {
    return [...await urlParts(node.left, context, depth + 1), ...await urlParts(node.right, context, depth + 1)]
  }
  if (isIdentifier(node) || isPropertyAccessExpression(node)) return referenceParts(node, context, depth)
  return [computed]
}

/** Text a route or method needs; anything computed leaves the construct unsupported. */
export async function literalText(node: Node | undefined, context: HttpContext): Promise<string | undefined> {
  if (node === undefined) return undefined
  const parts = await urlParts(node, context)
  const [first] = parts
  return parts.length === 1 && first?.kind === 'text' ? first.text : undefined
}

const methodToken = /^[A-Z][A-Z-]*$/

/** An uppercase method token the shared contract accepts. */
export function methodName(text: string | undefined): string | undefined {
  const method = text?.toUpperCase()
  return method !== undefined && methodToken.test(method) ? method : undefined
}

/** The single object literal an expression certainly holds. */
export async function objectValue(
  node: Node | undefined, context: HttpContext,
): Promise<ObjectLiteralExpression | undefined> {
  if (node === undefined) return undefined
  const object = isObjectLiteralExpression(node) ? node : await resolvedObject(node, context)
  // A spread can override any property, so the literal states nothing certain.
  return object?.properties.some(isSpreadAssignment) ? undefined : object
}

async function resolvedObject(node: Node, context: HttpContext): Promise<ObjectLiteralExpression | undefined> {
  const values = await context.values(node)
  const objects = (values ?? []).filter(isObjectLiteralExpression)
  return objects.length === 1 ? objects[0] : undefined
}

/** A written property name; a computed name or a spread states no literal key. */
export function propertyName(property: ObjectLiteralElementLike): string | undefined {
  const name = 'name' in property ? property.name : undefined
  return name !== undefined && 'text' in name ? name.text : undefined
}

export function propertyValue(object: ObjectLiteralExpression, name: string): Node | undefined {
  for (const property of object.properties) {
    if (propertyName(property) !== name) continue
    if (isPropertyAssignment(property)) return property.initializer
    // `{ method }` states a value the scanner must still resolve.
    if (isShorthandPropertyAssignment(property)) return property.name
  }
  return undefined
}
