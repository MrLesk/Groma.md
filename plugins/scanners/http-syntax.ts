/*
 * The value syntax every TypeScript-family reader shares: the wrappers that leave a value as it is, what
 * an object literal states for one property, the variable an expression initializes, and URL text. The
 * classic compiler's and the native SDK's nodes have the same shape, so each reader passes its own
 * predicates, and only the checker questions stay with each reader.
 */
interface Node {
  kind: number
  parent: Node
}
interface TextNode extends Node { text: string }
interface Wrapped extends Node { expression: Node }
interface Binary extends Node { operatorToken: { kind: number } }
interface Property extends Node { name?: Node }
interface ObjectLiteral extends Node { properties: readonly Property[] }

/** The wrappers that leave a value as it is. */
export interface WrapperCompiler {
  isParenthesizedExpression(node: Node): node is Wrapped
  isAsExpression(node: Node): node is Wrapped
  isSatisfiesExpression(node: Node): node is Wrapped
  isNonNullExpression(node: Node): node is Wrapped
  isTypeAssertionExpression(node: Node): node is Wrapped
}

export interface SyntaxCompiler extends WrapperCompiler {
  SyntaxKind: { PlusToken: number }
  isIdentifier(node: Node): node is TextNode
  isStringLiteral(node: Node): node is TextNode
  isNumericLiteral(node: Node): node is TextNode
  isNoSubstitutionTemplateLiteral(node: Node): boolean
  isTemplateExpression(node: Node): boolean
  isBinaryExpression(node: Node): node is Binary
  isPropertyAssignment(node: Node): node is Node & { initializer: Node }
  isGetAccessorDeclaration(node: Node): boolean
  isSetAccessorDeclaration(node: Node): boolean
  isVariableDeclaration(node: Node): boolean
}

/** Where a name comes from: a module, and the export it names, `default` and `*` included. */
export interface ImportOrigin {
  module: string
  name: string
}

/**
 * What an expression certainly holds: the expression that states its value, `absent` for a property
 * a readable object literal does not have, `unseen` for a value outside the sources, such as
 * configuration, and `unknown` for anything computed, reassignable or changed.
 */
export type Held<N> = { node: N } | 'absent' | 'unseen' | 'unknown'

/** Parentheses, `as`, `satisfies`, `!` and a type assertion, which change no value. */
export function wrapper(ts: WrapperCompiler, node: Node): node is Wrapped {
  return ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)
    || ts.isNonNullExpression(node) || ts.isTypeAssertionExpression(node)
}

/** The expression inside parentheses, `as`, `satisfies`, `!` and a type assertion, which change no value. */
export function unwrapped<N extends Node>(ts: SyntaxCompiler, node: N): N {
  let current: Node = node
  while (wrapper(ts, current)) current = current.expression
  return current as N
}

/** A written property name; a spread or a computed name states none. */
export function propertyKey(ts: SyntaxCompiler, property: Property): string | undefined {
  const name = property.name
  if (name === undefined) return undefined
  return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? name.text : undefined
}

/**
 * The value an object literal gives one property. The last property with the name wins; a spread or a
 * computed name could be that property, a method or shorthand states no literal value, and an
 * accessor can change any property of its object.
 */
export function ownProperty<N extends Node>(ts: SyntaxCompiler, object: ObjectLiteral, name: string): Held<N> {
  let found: Held<N> = 'absent'
  for (const property of object.properties) {
    const key = propertyKey(ts, property)
    if (key === undefined || ts.isGetAccessorDeclaration(property) || ts.isSetAccessorDeclaration(property)) return 'unknown'
    if (key === name) found = ts.isPropertyAssignment(property) ? { node: property.initializer as N } : 'unknown'
  }
  return found
}

/** The variable whose initializer the expression is. */
export function holderOf<N extends Node>(ts: SyntaxCompiler, node: Node): N | undefined {
  let current = node
  while (wrapper(ts, current.parent)) current = current.parent
  return ts.isVariableDeclaration(current.parent) ? current.parent as N : undefined
}

/** Text a URL is written as, rather than a value, such as a `Request`, that carries its own method. */
export function urlText(ts: SyntaxCompiler, node: Node): boolean {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) return true
  return ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken
}
