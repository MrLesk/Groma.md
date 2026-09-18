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
  getSourceFile(): { fileName: string; isDeclarationFile: boolean }
}
interface TextNode extends Node { text: string }
interface Wrapped extends Node { expression: Node }
interface Template extends Node {
  head: { text: string }
  templateSpans: readonly { expression: Node; literal: { text: string } }[]
}
interface Binary extends Node { left: Node; right: Node; operatorToken: { kind: number } }
/** A variable declaration or an object-literal property; the parent carries a variable list's flags. */
interface Initialized extends Node { initializer?: Node; parent: Node & { flags: number } }
interface CompilerSymbol {
  flags: number
  valueDeclaration?: Node
  declarations?: readonly Node[]
}
interface Checker {
  getSymbolAtLocation(node: Node): CompilerSymbol | undefined
  getAliasedSymbol(symbol: CompilerSymbol): CompilerSymbol
}

export interface UrlCompiler {
  SyntaxKind: { PlusToken: number }
  NodeFlags: { Const: number }
  SymbolFlags: { Alias: number }
  isStringLiteral(node: Node): node is TextNode
  isNoSubstitutionTemplateLiteral(node: Node): node is TextNode
  isParenthesizedExpression(node: Node): node is Wrapped
  isAsExpression(node: Node): node is Wrapped
  isNonNullExpression(node: Node): node is Wrapped
  isTemplateExpression(node: Node): node is Template
  isBinaryExpression(node: Node): node is Binary
  isIdentifier(node: Node): node is TextNode
  isPropertyAccessExpression(node: Node): node is Wrapped
  isPropertyAssignment(node: Node): node is Initialized
  isVariableDeclaration(node: Node): node is Initialized
  isParameter(node: Node): boolean
}

export interface UrlContext {
  ts: UrlCompiler
  checker: Checker
}

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

/**
 * A value assigned once: a `const` variable or an object-literal property. A class field is not one,
 * because a constructor can replace it even when it is `readonly`.
 */
function constantValue({ ts }: UrlContext, declaration: Node): Node | undefined {
  if (ts.isPropertyAssignment(declaration)) return declaration.initializer
  if (!ts.isVariableDeclaration(declaration) || declaration.initializer === undefined) return undefined
  return (declaration.parent.flags & ts.NodeFlags.Const) !== 0 ? declaration.initializer : undefined
}

function referenceRoot({ ts }: UrlContext, node: Node): Node {
  let current = node
  while (ts.isPropertyAccessExpression(current)) current = current.expression
  return current
}

/**
 * A value the scanner cannot see is configuration: its root resolves to nothing, as `import.meta.env`
 * does, or only to a declaration without source, as an ambient `declare` and `process.env` do.
 */
function unseenValue(context: UrlContext, node: Node): UrlPart {
  const root = referenceRoot(context, node)
  const declaration = context.ts.isIdentifier(root) ? declarationOf(context, root) : undefined
  return declaration === undefined || declaration.getSourceFile().isDeclarationFile ? configuredPart : computedPart
}

function referenceParts(context: UrlContext, node: Node, depth: number): UrlPart[] {
  const declaration = declarationOf(context, node)
  if (declaration === undefined || declaration.getSourceFile().isDeclarationFile) {
    return [unseenValue(context, node)]
  }
  if (context.ts.isParameter(declaration)) return [computedPart]
  const constant = constantValue(context, declaration)
  return constant === undefined ? [computedPart] : urlParts(context, constant, depth + 1)
}

/** Resolve a URL expression into literal text and the holes the source computes. */
export function urlParts(context: UrlContext, node: Node, depth = 0): UrlPart[] {
  const { ts } = context
  if (depth > MAX_DEPTH) return [computedPart]
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [{ kind: 'text', text: node.text }]
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) {
    return urlParts(context, node.expression, depth + 1)
  }
  if (ts.isTemplateExpression(node)) {
    const parts: UrlPart[] = [{ kind: 'text', text: node.head.text }]
    for (const span of node.templateSpans) {
      parts.push(...urlParts(context, span.expression, depth + 1), { kind: 'text', text: span.literal.text })
    }
    return parts
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return [...urlParts(context, node.left, depth + 1), ...urlParts(context, node.right, depth + 1)]
  }
  if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) return referenceParts(context, node, depth)
  return [computedPart]
}

/** Text a method needs; anything computed leaves the method out of the fact. */
export function methodName(context: UrlContext, node: Node | undefined): string | undefined {
  if (node === undefined) return undefined
  const parts = urlParts(context, node)
  const [first] = parts
  const method = parts.length === 1 && first?.kind === 'text' ? first.text.toUpperCase() : undefined
  return method !== undefined && methodToken.test(method) ? method : undefined
}

/** The value a name is assigned once, such as a client's configuration object. */
export function constantOf<V extends Node = Node>(context: UrlContext, node: Node): V | undefined {
  const declaration = declarationOf(context, node)
  return (declaration === undefined ? undefined : constantValue(context, declaration)) as V | undefined
}
