import type { ScanHttpRequest } from '@groma/scanner'
import { holderOf, urlText, type Node } from './http-syntax.ts'
import { computedPart, joinBase, methodText, requestUrl, withBase, type UrlPart } from './http-url.ts'
import {
  declarationOf, heldAt, heldParts, importOrigin, literalText, methodName, runtimeGlobal, urlParts, type UrlContext,
} from './http-values.ts'

/*
 * The client forms every TypeScript-family scanner reads the same way: `fetch` and ofetch calls, an
 * options object's method and base, and the axios clients and call shapes. Every option is read through
 * the shared value reader, so a changed, duplicated or unreadable property is never taken for the
 * literal it once held. Each scanner keeps only the recognition its ecosystem needs, such as which name
 * is its runtime `fetch`.
 */
interface Call extends Node { expression: Node; arguments: readonly Node[] }

/** An axios client: the base it starts every path with, and the method of a request that states none. */
interface Client {
  base: UrlPart[]
  /** Undefined when the client's configuration hides it. */
  method: string | undefined
}

export type RequestFact = Omit<ScanHttpRequest, 'operation'>

/** A fetch-style client: the runtime's `fetch`, or ofetch, whose `baseURL` option starts the path. */
export type FetchClient = 'fetch' | 'ofetch'

/** The method options state, the fallback when they state none, and nothing when they hide it. */
async function declaredMethod(context: UrlContext, options: Node | undefined, fallback: string | undefined): Promise<string | undefined> {
  if (options === undefined) return fallback
  const declared = await heldAt(context, options, 'method')
  if (declared === 'absent') return fallback
  return typeof declared === 'string' ? undefined : methodName(context, declared.node)
}

/** The base a configuration states, the fallback when it states none, and a hidden one as the value it is. */
async function optionsBase(context: UrlContext, config: Node | undefined, fallback: UrlPart[]): Promise<UrlPart[]> {
  if (config === undefined) return fallback
  const base = await heldAt(context, config, 'baseURL')
  return base === 'absent' ? fallback : heldParts(context, base)
}

/**
 * The runtime's `fetch`, or the default export of `node-fetch`. A `fetch` the project declares, or
 * imports from anywhere else, is its own function.
 */
export async function runtimeFetch(context: UrlContext, callee: Node): Promise<FetchClient | undefined> {
  if (!context.ts.isIdentifier(callee) || callee.text !== 'fetch') return undefined
  const origin = await importOrigin(context, callee)
  const fetch = origin === undefined ? await runtimeGlobal(context, callee) : origin.module === 'node-fetch' && origin.name === 'default'
  return fetch ? 'fetch' : undefined
}

/**
 * A request through a fetch-style client, which `client` recognizes from the callee. The options state
 * the method of a URL, while any other input, such as a `Request`, carries a method of its own; ofetch
 * also reads a `baseURL` option.
 */
export async function fetchRequest(
  context: UrlContext, call: Call, client: (callee: Node) => Promise<FetchClient | undefined>,
): Promise<RequestFact | undefined> {
  const [url, options] = call.arguments
  const kind = url === undefined ? undefined : await client(call.expression)
  if (url === undefined || kind === undefined) return undefined
  const input = await heldAt(context, url)
  const method = input === 'unseen' || (typeof input === 'object' && urlText(context.ts, input.node))
    ? await declaredMethod(context, options, 'GET') : undefined
  const parts = await urlParts(context, url)
  const target = kind === 'ofetch' ? withBase(await optionsBase(context, options, []), parts) : parts
  return { ...(method === undefined ? {} : { method }), ...requestUrl(target) }
}

/**
 * A client after the sources set its `defaults`: exactly one assignment to `defaults.baseURL` or
 * `defaults.method` is that setting; more than one, or any other change to `defaults`, hides both.
 * Interceptors, and code the client is handed to, are not read.
 */
async function withDefaults(context: UrlContext, client: Client, holders: readonly Node[]): Promise<Client> {
  const found = await Promise.all(holders.map(holder => context.bindings.settings(holder, ['defaults'], ['baseURL', 'method'])))
  const bases = found.flatMap(settings => settings.assigned.get('baseURL') ?? [])
  const methods = found.flatMap(settings => settings.assigned.get('method') ?? [])
  if (found.some(settings => settings.changed) || bases.length > 1 || methods.length > 1) return { base: [computedPart], method: undefined }
  return {
    base: bases[0] === undefined ? client.base : await urlParts(context, bases[0]),
    method: methods[0] === undefined ? client.method : methodText(await literalText(context, methods[0])),
  }
}

/** `axios` itself, as the `axios.defaults` assignments in the sources leave it. */
function defaultClient(context: UrlContext): Promise<Client> {
  return withDefaults(context, { base: [], method: 'GET' }, context.bindings.defaultImports('axios'))
}

/**
 * One request: the call's own method, else the one its options or client state, and its path after
 * the base the request configuration states, else the client's.
 */
async function sent(
  context: UrlContext, client: Client, url: UrlPart[], method: string | undefined, config: Node | undefined,
): Promise<RequestFact> {
  const effective = method ?? await declaredMethod(context, config, client.method)
  const base = await optionsBase(context, config, client.base)
  return { ...(effective === undefined ? {} : { method: effective }), ...requestUrl(joinBase(base, url)) }
}

/** The `axios(config)` and `axios.request(config)` forms, whose URL is one of the options. */
async function configRequest(context: UrlContext, client: Client, config: Node | undefined): Promise<RequestFact | undefined> {
  const url = config === undefined ? 'absent' : await heldAt(context, config, 'url')
  return url === 'absent' ? undefined : sent(context, client, await heldParts(context, url), undefined, config)
}

async function holdsObject(context: UrlContext, node: Node): Promise<boolean> {
  const value = await heldAt(context, node)
  return typeof value === 'object' && context.ts.isObjectLiteralExpression(value.node)
}

const SHORTHAND = new Map([
  ['get', 'GET'], ['post', 'POST'], ['put', 'PUT'], ['patch', 'PATCH'],
  ['delete', 'DELETE'], ['head', 'HEAD'], ['options', 'OPTIONS'],
])

/** The shorthands whose second argument is the request body, which moves the configuration to the third. */
const WITH_BODY = new Set(['post', 'put', 'patch'])

/** The axios default export; a named export such as `isAxiosError` or `post` is not a client. */
async function isAxios(context: UrlContext, node: Node): Promise<boolean> {
  const origin = await importOrigin(context, node)
  return origin?.module === 'axios' && origin.name === 'default'
}

/**
 * The instance `axios.create(config)` makes, when a name certainly holds one: the base and default method
 * its configuration states, else those of `axios` when nothing sets them there, and then its own
 * `defaults`.
 */
async function createdClient(context: UrlContext, node: Node): Promise<Client | undefined> {
  const { ts } = context
  const created = await heldAt(context, node)
  const call = typeof created === 'object' && ts.isCallExpression(created.node) ? created.node : undefined
  const callee = call?.expression
  if (call === undefined || callee === undefined || !ts.isPropertyAccessExpression(callee) || !ts.isIdentifier(callee.name)) return undefined
  if (callee.name.text !== 'create' || !await isAxios(context, callee.expression)) return undefined
  // `axios.create` copies what `axios.defaults` hold when it runs, which the scan cannot order.
  const parent = await defaultClient(context)
  const inherited: Client = { base: parent.base.length === 0 ? [] : [computedPart], method: parent.method === 'GET' ? 'GET' : undefined }
  const [config] = call.arguments
  const client = { base: await optionsBase(context, config, inherited.base), method: await declaredMethod(context, config, inherited.method) }
  const holders = [await declarationOf(context, node), holderOf(ts, call)].filter(holder => holder !== undefined)
  return withDefaults(context, client, [...new Set(holders)])
}

/** `axios` itself, or an instance a name holds from `axios.create`, whose configuration starts every request. */
async function axiosClient(context: UrlContext, node: Node): Promise<Client | undefined> {
  if (!context.ts.isIdentifier(node)) return undefined
  return await isAxios(context, node) ? defaultClient(context) : createdClient(context, node)
}

/** The request an axios call sends, through `axios` itself or an instance of it. */
export async function axiosRequest(context: UrlContext, call: Call): Promise<RequestFact | undefined> {
  const { ts } = context
  const callee = call.expression
  const [first, second, third] = call.arguments
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name)) {
    const client = await axiosClient(context, callee.expression)
    if (client === undefined) return undefined
    const member = callee.name.text
    const method = SHORTHAND.get(member)
    if (method !== undefined && first !== undefined) {
      return sent(context, client, await urlParts(context, first), method, WITH_BODY.has(member) ? third : second)
    }
    return member === 'request' ? configRequest(context, client, first) : undefined
  }
  const client = await axiosClient(context, callee)
  if (client === undefined || first === undefined) return undefined
  if (await holdsObject(context, first)) return configRequest(context, client, first)
  return sent(context, client, await urlParts(context, first), undefined, second)
}
