import type { ScanHttpRequest } from '@groma/scanner'
import { requestUrl, type UrlPart } from './http-url.ts'
import { methodName, urlParts, constantOf, type UrlCompiler, type UrlContext } from './http-values.ts'

/*
 * The client forms the framework scanners read the same way: an options object's method, and the
 * axios call shapes. Each scanner keeps only the recognition its ecosystem needs, such as which name
 * is a runtime client. The TypeScript scanner has its own copy over the native SDK; change both
 * together.
 */
interface Node {
  kind: number
  getSourceFile(): { fileName: string; isDeclarationFile: boolean }
}
interface TextNode extends Node { text: string }
interface Property extends Node { name?: Node; initializer?: Node }
interface PropertyAccess extends Node { expression: Node; name: TextNode }
export interface ObjectLiteral extends Node { properties: readonly Property[] }
export interface Call extends Node { expression: Node; arguments: readonly Node[] }

export interface ClientCompiler extends UrlCompiler {
  isObjectLiteralExpression(node: Node): node is ObjectLiteral
  isSpreadAssignment(node: Node): boolean
  isShorthandPropertyAssignment(node: Node): boolean
  isCallExpression(node: Node): node is Call
  isPropertyAccessExpression(node: Node): node is PropertyAccess
}

export interface ClientContext extends UrlContext {
  ts: ClientCompiler
}

/** An axios client: `axios` itself with no base, or an instance created with one. */
export interface Client {
  base: UrlPart[]
}

/**
 * The single object literal an expression certainly holds. A spread can override any property, and a
 * property name the scanner cannot read could be the one it looks for, so neither states anything.
 */
export function objectValue(context: ClientContext, node: Node | undefined): ObjectLiteral | undefined {
  const { ts } = context
  if (node === undefined) return undefined
  const resolved = ts.isObjectLiteralExpression(node) ? node : constantOf<Node>(context, node)
  if (resolved === undefined || !ts.isObjectLiteralExpression(resolved)) return undefined
  const readable = resolved.properties.every(property => (
    !ts.isSpreadAssignment(property) && property.name !== undefined
    && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
  ))
  return readable ? resolved : undefined
}

export function propertyValue(context: ClientContext, object: ObjectLiteral, name: string): Node | undefined {
  const { ts } = context
  for (const property of object.properties) {
    const key = property.name
    if (key === undefined || !ts.isIdentifier(key) && !ts.isStringLiteral(key) || key.text !== name) continue
    if (property.initializer !== undefined) return property.initializer
    // `{ method }` states a value the scanner must still resolve.
    if (ts.isShorthandPropertyAssignment(property)) return key
  }
  return undefined
}

/** No options means the default method; options the scanner cannot read leave the method out. */
export function optionsMethod(context: ClientContext, options: Node | undefined): { method?: string } {
  if (options === undefined) return { method: 'GET' }
  const object = objectValue(context, options)
  if (object === undefined) return {}
  const declared = propertyValue(context, object, 'method')
  if (declared === undefined) return { method: 'GET' }
  const method = methodName(context, declared)
  return method === undefined ? {} : { method }
}

export type RequestFact = Omit<ScanHttpRequest, 'operation'>

function urlRequest(
  context: ClientContext, base: UrlPart[], method: string | undefined, url: Node | undefined,
): RequestFact | undefined {
  if (url === undefined) return undefined
  return { ...(method === undefined ? {} : { method }), ...requestUrl([...base, ...urlParts(context, url)]) }
}

/** The `axios(config)` and `axios.request(config)` forms, whose method defaults to GET. */
function configRequest(context: ClientContext, base: UrlPart[], config: Node | undefined): RequestFact | undefined {
  const options = objectValue(context, config)
  if (options === undefined) return undefined
  const declared = propertyValue(context, options, 'method')
  const method = declared === undefined ? 'GET' : methodName(context, declared)
  return urlRequest(context, base, method, propertyValue(context, options, 'url'))
}

const SHORTHAND = new Map([
  ['get', 'GET'], ['post', 'POST'], ['put', 'PUT'], ['patch', 'PATCH'],
  ['delete', 'DELETE'], ['head', 'HEAD'], ['options', 'OPTIONS'],
])

/**
 * The request an axios call sends. `resolveClient` decides which names hold a client, because that is
 * where the ecosystems differ.
 */
export function axiosRequest(
  context: ClientContext, call: Call, resolveClient: (node: Node) => Client | undefined,
): RequestFact | undefined {
  const { ts } = context
  const callee = call.expression
  if (ts.isPropertyAccessExpression(callee)) {
    const client = resolveClient(callee.expression)
    if (client === undefined) return undefined
    const member = callee.name.text
    const method = SHORTHAND.get(member)
    if (method !== undefined) return urlRequest(context, client.base, method, call.arguments[0])
    return member === 'request' ? configRequest(context, client.base, call.arguments[0]) : undefined
  }
  const client = resolveClient(callee)
  if (client === undefined) return undefined
  const [first, second] = call.arguments
  if (objectValue(context, first) !== undefined) return configRequest(context, client.base, first)
  return urlRequest(context, client.base, optionsMethod(context, second).method, first)
}

/** The base an `axios.create({ baseURL })` call states, for a client the scanner has recognized. */
export function createdBase(context: ClientContext, created: Call): UrlPart[] {
  const config = objectValue(context, created.arguments[0])
  const baseUrl = config === undefined ? undefined : propertyValue(context, config, 'baseURL')
  return baseUrl === undefined ? [] : urlParts(context, baseUrl)
}
