import type { ScanHttpRequest } from '@groma/scanner'
import {
  isCallExpression, isIdentifier, isObjectLiteralExpression, isPropertyAccessExpression,
  type CallExpression, type Node,
} from 'typescript/unstable/ast'

import { holderOf, urlText } from '../../http-syntax.ts'
import { computedPart, joinBase, methodText, requestUrl, type UrlPart } from '../../http-url.ts'
import { syntax } from './http-bindings.ts'
import {
  declarationOf, heldAt, heldParts, importOrigin, literalText, urlParts, type HttpContext,
} from './http-values.ts'

/*
 * The fetch and axios forms of ../../http-clients.ts, which the framework scanners read over the classic
 * compiler, read here with the native SDK's asynchronous checker. Change both together.
 */

/** An axios client: the base it starts every path with, and the method of a request that states none. */
interface Client {
  base: UrlPart[]
  /** Undefined when the client's configuration hides it. */
  method: string | undefined
}

type RequestFact = Omit<ScanHttpRequest, 'operation'>

/** The method options state, the fallback when they state none, and nothing when they hide it. */
async function declaredMethod(context: HttpContext, options: Node | undefined, fallback: string | undefined): Promise<string | undefined> {
  if (options === undefined) return fallback
  const declared = await heldAt(context, options, 'method')
  if (declared === 'absent') return fallback
  return typeof declared === 'string' ? undefined : methodText(await literalText(declared.node, context))
}

/** The base a configuration states, the fallback when it states none, and a hidden one as the value it is. */
async function optionsBase(context: HttpContext, config: Node | undefined, fallback: UrlPart[]): Promise<UrlPart[]> {
  if (config === undefined) return fallback
  const base = await heldAt(context, config, 'baseURL')
  return base === 'absent' ? fallback : heldParts(context, base)
}

/** The runtime's `fetch`: a name the project declares itself is a local function, not the client. */
async function fetchRequest(call: CallExpression, context: HttpContext): Promise<RequestFact | undefined> {
  const callee = call.expression
  if (!isIdentifier(callee) || callee.text !== 'fetch') return undefined
  const declaration = await declarationOf(callee, context.checker)
  if (declaration !== undefined && !declaration.getSourceFile().fileName.endsWith('.d.ts')) return undefined
  const [url, init] = call.arguments
  if (url === undefined) return undefined
  // A URL states the request; any other input, such as a `Request`, carries a method of its own.
  const input = await heldAt(context, url)
  const method = input === 'unseen' || (typeof input === 'object' && urlText(syntax, input.node))
    ? await declaredMethod(context, init, 'GET') : undefined
  return { ...(method === undefined ? {} : { method }), ...requestUrl(await urlParts(url, context)) }
}

/**
 * A client after the sources set its `defaults`: exactly one assignment to `defaults.baseURL` or
 * `defaults.method` is that setting; more than one, or any other change to `defaults`, hides both.
 */
async function withDefaults(context: HttpContext, client: Client, holders: readonly Node[]): Promise<Client> {
  const found = await Promise.all(holders.map(holder => context.bindings.settings(holder, ['defaults'], ['baseURL', 'method'])))
  const bases = found.flatMap(settings => settings.assigned.get('baseURL') ?? [])
  const methods = found.flatMap(settings => settings.assigned.get('method') ?? [])
  if (found.some(settings => settings.changed) || bases.length > 1 || methods.length > 1) return { base: [computedPart], method: undefined }
  return {
    base: bases[0] === undefined ? client.base : await urlParts(bases[0], context),
    method: methods[0] === undefined ? client.method : methodText(await literalText(methods[0], context)),
  }
}

/** `axios` itself, as the `axios.defaults` assignments in the sources leave it. */
function defaultClient(context: HttpContext): Promise<Client> {
  return withDefaults(context, { base: [], method: 'GET' }, context.bindings.defaultImports('axios'))
}

/** The axios default export; a named export such as `isAxiosError` or `post` is not a client. */
async function isAxios(node: Node, context: HttpContext): Promise<boolean> {
  const origin = await importOrigin(node, context.checker)
  return origin?.module === 'axios' && origin.name === 'default'
}

/**
 * The instance `axios.create(config)` makes, when a name certainly holds one: the base and default method
 * its configuration states, else those of `axios` when nothing sets them there, and then its own
 * `defaults`.
 */
async function createdClient(node: Node, context: HttpContext): Promise<Client | undefined> {
  const created = await heldAt(context, node)
  const call = typeof created === 'object' && isCallExpression(created.node) ? created.node : undefined
  const callee = call?.expression
  if (call === undefined || callee === undefined || !isPropertyAccessExpression(callee)) return undefined
  if (callee.name.text !== 'create' || !await isAxios(callee.expression, context)) return undefined
  // `axios.create` copies what `axios.defaults` hold when it runs, which the scan cannot order.
  const parent = await defaultClient(context)
  const inherited: Client = { base: parent.base.length === 0 ? [] : [computedPart], method: parent.method === 'GET' ? 'GET' : undefined }
  const [config] = call.arguments
  const client = { base: await optionsBase(context, config, inherited.base), method: await declaredMethod(context, config, inherited.method) }
  const holders = [await declarationOf(node, context.checker), holderOf<Node>(syntax, call)].filter(holder => holder !== undefined)
  return withDefaults(context, client, [...new Set(holders)])
}

/** `axios` itself, or an instance a name holds from `axios.create`, whose configuration starts every request. */
async function axiosClient(node: Node, context: HttpContext): Promise<Client | undefined> {
  if (!isIdentifier(node)) return undefined
  return await isAxios(node, context) ? defaultClient(context) : createdClient(node, context)
}

/**
 * One request: the call's own method, else the one its options or client state, and its path after
 * the base the request configuration states, else the client's.
 */
async function sent(
  context: HttpContext, client: Client, url: UrlPart[], method: string | undefined, config: Node | undefined,
): Promise<RequestFact> {
  const effective = method ?? await declaredMethod(context, config, client.method)
  const base = await optionsBase(context, config, client.base)
  return { ...(effective === undefined ? {} : { method: effective }), ...requestUrl(joinBase(base, url)) }
}

/** The `axios(config)` and `axios.request(config)` forms, whose URL is one of the options. */
async function configRequest(context: HttpContext, client: Client, config: Node | undefined): Promise<RequestFact | undefined> {
  const url = config === undefined ? 'absent' : await heldAt(context, config, 'url')
  return url === 'absent' ? undefined : sent(context, client, await heldParts(context, url), undefined, config)
}

const shorthand = new Map([
  ['get', 'GET'], ['post', 'POST'], ['put', 'PUT'], ['patch', 'PATCH'],
  ['delete', 'DELETE'], ['head', 'HEAD'], ['options', 'OPTIONS'],
])

/** The shorthands whose second argument is the request body, which moves the configuration to the third. */
const withBody = new Set(['post', 'put', 'patch'])

async function axiosRequest(call: CallExpression, context: HttpContext): Promise<RequestFact | undefined> {
  const callee = call.expression
  const [first, second, third] = call.arguments
  if (isPropertyAccessExpression(callee)) {
    const client = await axiosClient(callee.expression, context)
    if (client === undefined) return undefined
    const member = callee.name.text
    const method = shorthand.get(member)
    if (method !== undefined && first !== undefined) {
      return sent(context, client, await urlParts(first, context), method, withBody.has(member) ? third : second)
    }
    return member === 'request' ? configRequest(context, client, first) : undefined
  }
  const client = await axiosClient(callee, context)
  if (client === undefined || first === undefined) return undefined
  const value = await heldAt(context, first)
  if (typeof value === 'object' && isObjectLiteralExpression(value.node)) return configRequest(context, client, first)
  return sent(context, client, await urlParts(first, context), undefined, second)
}

/** Requests the supported clients send; anything computed stays in the fact as unknown text. */
export async function httpRequests(calls: readonly CallExpression[], context: HttpContext): Promise<ScanHttpRequest[]> {
  const requests: ScanHttpRequest[] = []
  for (const call of calls) {
    const request = await fetchRequest(call, context) ?? await axiosRequest(call, context)
    if (request !== undefined) requests.push({ operation: context.callerOperation(call), ...request })
  }
  return requests
}
