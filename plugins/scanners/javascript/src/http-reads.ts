import ts from 'typescript'
import { urlParts } from '../../http-values.ts'
import type { FileScope } from './http-scope.ts'

/*
 * Values one file states. URL text and method names come from the shared ../../http-values.ts, which
 * resolves them through the file scope; these readers add the object and instance forms the clients
 * and routers of this ecosystem are written with.
 */

export interface HttpReader {
  ts: typeof ts
  checker: FileScope['checker']
  scope: FileScope
}

const methodPattern = /^[A-Z][A-Z-]*$/

export function httpReader(scope: FileScope): HttpReader {
  return { ts, checker: scope.checker, scope }
}

/** An uppercase method token the shared contract accepts. */
export function methodFromText(text: string | undefined): string | undefined {
  const method = text?.toUpperCase()
  return method !== undefined && methodPattern.test(method) ? method : undefined
}

/** Text a route, prefix or method needs; a computed or assembled value leaves the construct unsupported. */
export function literalText(reader: HttpReader, node: ts.Node | undefined): string | undefined {
  if (node === undefined) return undefined
  const [part, ...rest] = urlParts(reader, node)
  return rest.length === 0 && part?.kind === 'text' ? part.text : undefined
}

/**
 * The value a name holds when this file declares it and never assigns it again. A reassignable
 * client or router can change its base or prefix, so its name states nothing.
 */
export function instanceValue(reader: HttpReader, node: ts.Node): ts.Expression | undefined {
  if (!ts.isIdentifier(node) || reader.scope.reassigns(node.text)) return undefined
  const declaration = reader.scope.declarationOf(node)
  if (declaration === undefined || !ts.isVariableDeclaration(declaration)) return undefined
  return declaration.initializer
}

/** The single object literal an expression certainly holds. */
export function objectValue(reader: HttpReader, node: ts.Node | undefined): ts.ObjectLiteralExpression | undefined {
  if (node === undefined) return undefined
  const value = ts.isObjectLiteralExpression(node) ? node : instanceValue(reader, node)
  const object = value !== undefined && ts.isObjectLiteralExpression(value) ? value : undefined
  // A spread can override any property, so the literal states nothing certain.
  return object?.properties.some(ts.isSpreadAssignment) ? undefined : object
}

/** A written property name; a computed name or a spread states no literal key. */
export function propertyName(property: ts.ObjectLiteralElementLike): string | undefined {
  const name = property.name
  if (name === undefined) return undefined
  return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? name.text : undefined
}

export function propertyValue(object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  for (const property of object.properties) {
    if (propertyName(property) !== name) continue
    if (ts.isPropertyAssignment(property)) return property.initializer
    // `{ method }` states a value the scanner must still resolve.
    if (ts.isShorthandPropertyAssignment(property)) return property.name
  }
  return undefined
}

/** A function written in place, or one this file declares under the name the expression states. */
export function functionValue(reader: HttpReader, node: ts.Node): ts.Node | undefined {
  if (ts.isFunctionLike(node)) return node
  if (!ts.isIdentifier(node)) return undefined
  const declaration = reader.scope.declarationOf(node)
  if (declaration !== undefined && ts.isFunctionDeclaration(declaration)) return declaration
  const value = instanceValue(reader, node)
  return value !== undefined && ts.isFunctionLike(value) ? value : undefined
}
