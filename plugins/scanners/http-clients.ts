import type { ScanHttpRequest } from '@groma/scanner'
import { holderOf, urlText } from './http-syntax.ts'
import { computedPart, joinBase, requestUrl, type UrlPart } from './http-url.ts'
import {
  declarationOf, heldAt, heldParts, importOrigin, methodName, urlParts, type UrlCompiler, type UrlContext,
} from './http-values.ts'

/*
 * The client forms the framework scanners read the same way: an options object's method and base, and
 * the axios clients and call shapes. Every option is read through the shared value reader, so a
 * changed, duplicated or unreadable property is never taken for the literal it once held. Each scanner
 * keeps only the recognition its ecosystem needs, such as which name is its runtime `fetch`. The
 * TypeScript scanner has its own copy over the native SDK; change both together.
 */
interface Node {
  kind: number
  parent: Node
  getSourceFile(): { fileName: string; isDeclarationFile: boolean }
}
interface TextNode extends Node { text: string }
interface PropertyAccess extends Node { expression: Node; name: TextNode }
export interface Call extends Node { expression: Node; arguments: readonly Node[] }

export interface ClientCompiler extends UrlCompiler {
  isCallExpression(node: Node): node is Call
  isPropertyAccessExpression(node: Node): node is PropertyAccess
}

export interface ClientContext extends UrlContext {
  ts: ClientCompiler
}

/** An axios client: the base it starts every path with, and the method of a request that states none. */
export interface Client {
  base: UrlPart[]
  /** Undefined when the client's configuration hides it. */
  method: string | undefined
}

export type RequestFact = Omit<ScanHttpRequest, 'operation'>

/** The method options state, the fallback when they state none, and nothing when they hide it. */
function declaredMethod(context: ClientContext, options: Node | undefined, fallback: string | undefined): string | undefined {
  if (options === undefined) return fallback
  const declared = heldAt(context, options, 'method')
  if (declared === 'absent') return fallback
  return typeof declared === 'string' ? undefined : methodName(context, declared.node)
}

/** The base a configuration states, the fallback when it states none, and a hidden one as the value it is. */
export function optionsBase(context: ClientContext, config: Node | undefined, fallback: UrlPart[]): UrlPart[] {
  if (config === undefined) return fallback
  const base = heldAt(context, config, 'baseURL')
  return base === 'absent' ? fallback : heldParts(context, base)
}

/** No options means the default method; options the scanner cannot read leave the method out. */
export function optionsMethod(context: ClientContext, options: Node | undefined): { method?: string } {
  const method = declaredMethod(context, options, 'GET')
  return method === undefined ? {} : { method }
}

/**
 * The method of a `fetch`-style call: its options state it for a URL, while any other input, such as a
 * `Request`, carries a method of its own.
 */
export function fetchMethod(context: ClientContext, input: Node, options: Node | undefined): { method?: string } {
  const value = heldAt(context, input)
  const url = value === 'unseen' || (typeof value === 'object' && urlText(context.ts, value.node))
  return url ? optionsMethod(context, options) : {}
}

/**
 * A client after the sources set its `defaults`: exactly one assignment to `defaults.baseURL` or
 * `defaults.method` is that setting; more than one, or any other change to `defaults`, hides both.
 * Interceptors, and code the client is handed to, are not read.
 */
function withDefaults(context: ClientContext, client: Client, holders: readonly Node[]): Client {
  const found = holders.map(holder => context.bindings.settings(holder, ['defaults'], ['baseURL', 'method']))
  // The bindings describe nodes by less of their shape than these readers need.
  const bases = found.flatMap(settings => settings.assigned.get('baseURL') ?? []) as Node[]
  const methods = found.flatMap(settings => settings.assigned.get('method') ?? []) as Node[]
  if (found.some(settings => settings.changed) || bases.length > 1 || methods.length > 1) return { base: [computedPart], method: undefined }
  return {
    base: bases[0] === undefined ? client.base : urlParts(context, bases[0]),
    method: methods[0] === undefined ? client.method : methodName(context, methods[0]),
  }
}

/** `axios` itself, as the `axios.defaults` assignments in the sources leave it. */
function defaultClient(context: ClientContext): Client {
  return withDefaults(context, { base: [], method: 'GET' }, context.bindings.defaultImports('axios') as Node[])
}

/**
 * One request: the call's own method, else the one its options or client state, and its path after
 * the base the request configuration states, else the client's.
 */
function sent(
  context: ClientContext, client: Client, url: UrlPart[], method: string | undefined, config: Node | undefined,
): RequestFact {
  const effective = method ?? declaredMethod(context, config, client.method)
  const base = optionsBase(context, config, client.base)
  return { ...(effective === undefined ? {} : { method: effective }), ...requestUrl(joinBase(base, url)) }
}

/** The `axios(config)` and `axios.request(config)` forms, whose URL is one of the options. */
function configRequest(context: ClientContext, client: Client, config: Node | undefined): RequestFact | undefined {
  const url = config === undefined ? 'absent' : heldAt(context, config, 'url')
  return url === 'absent' ? undefined : sent(context, client, heldParts(context, url), undefined, config)
}

function holdsObject(context: ClientContext, node: Node | undefined): boolean {
  const value = node === undefined ? undefined : heldAt(context, node)
  return typeof value === 'object' && context.ts.isObjectLiteralExpression(value.node)
}

const SHORTHAND = new Map([
  ['get', 'GET'], ['post', 'POST'], ['put', 'PUT'], ['patch', 'PATCH'],
  ['delete', 'DELETE'], ['head', 'HEAD'], ['options', 'OPTIONS'],
])

/** The shorthands whose second argument is the request body, which moves the configuration to the third. */
const WITH_BODY = new Set(['post', 'put', 'patch'])

/** The request an axios call sends, through the client `axiosClient` recognizes. */
export function axiosRequest(context: ClientContext, call: Call): RequestFact | undefined {
  const { ts } = context
  const callee = call.expression
  const [first, second, third] = call.arguments
  if (ts.isPropertyAccessExpression(callee)) {
    const client = axiosClient(context, callee.expression)
    if (client === undefined) return undefined
    const member = callee.name.text
    const method = SHORTHAND.get(member)
    if (method !== undefined && first !== undefined) {
      return sent(context, client, urlParts(context, first), method, WITH_BODY.has(member) ? third : second)
    }
    return member === 'request' ? configRequest(context, client, first) : undefined
  }
  const client = axiosClient(context, callee)
  if (client === undefined || first === undefined) return undefined
  if (holdsObject(context, first)) return configRequest(context, client, first)
  return sent(context, client, urlParts(context, first), undefined, second)
}

/** The axios default export; a named export such as `isAxiosError` or `post` is not a client. */
function isAxios(context: ClientContext, node: Node): boolean {
  const origin = importOrigin(context, node)
  return origin?.module === 'axios' && origin.name === 'default'
}

/**
 * The instance `axios.create(config)` makes, when a name certainly holds one: the base and default method
 * its configuration states, else those of `axios` when nothing sets them there, and then its own
 * `defaults`.
 */
function createdClient(context: ClientContext, node: Node): Client | undefined {
  const { ts } = context
  const created = heldAt(context, node)
  const call = typeof created === 'object' && ts.isCallExpression(created.node) ? created.node : undefined
  const callee = call?.expression
  if (call === undefined || callee === undefined || !ts.isPropertyAccessExpression(callee)) return undefined
  if (callee.name.text !== 'create' || !isAxios(context, callee.expression)) return undefined
  // `axios.create` copies what `axios.defaults` hold when it runs, which the scan cannot order.
  const parent = defaultClient(context)
  const inherited: Client = { base: parent.base.length === 0 ? [] : [computedPart], method: parent.method === 'GET' ? 'GET' : undefined }
  const [config] = call.arguments
  const client = { base: optionsBase(context, config, inherited.base), method: declaredMethod(context, config, inherited.method) }
  const holders = [declarationOf(context, node), holderOf<Node>(context.ts, call)].filter(holder => holder !== undefined)
  return withDefaults(context, client, [...new Set(holders)])
}

/** `axios` itself, or an instance a name holds from `axios.create`, whose configuration starts every request. */
function axiosClient(context: ClientContext, node: Node): Client | undefined {
  if (!context.ts.isIdentifier(node)) return undefined
  return isAxios(context, node) ? defaultClient(context) : createdClient(context, node)
}
