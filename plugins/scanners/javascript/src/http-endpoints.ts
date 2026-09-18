import type { ScanHttpEndpoint } from '@groma/scanner'
import ts from 'typescript'
import { withOrder } from '../../http-order.ts'
import type { Node, RouterCompiler, RouterContext } from '../../http-routers.ts'
import { routerEndpoints, serveEndpoints } from '../../http-routes.ts'
import {
  declarationOf, heldAt, importOrigin, literalText, objectEntries, unassigned, urlParts,
} from '../../http-values.ts'
import type { FileEvidence } from './evidence.ts'
import type { JavaScriptContext } from './http-requests.ts'

/*
 * Express, Fastify, Hono and Koa routes, and Bun.serve routes, through the TypeScript family's shared
 * router reader. The scanner reads one file at a time, so a router mounted in another file states no
 * path and reports nothing.
 */

/** The shared readers describe nodes by less of their shape than the classic compiler's. */
function classic(node: Node): ts.Node {
  return node as unknown as ts.Node
}

/** The function a handler expression certainly holds. */
function handlerFunction(context: JavaScriptContext, handler: ts.Node): ts.Node | undefined {
  const value = heldAt(context, handler)
  const node = typeof value === 'object' ? value.node as ts.Node : undefined
  return node !== undefined && ts.isFunctionLike(node) ? node : undefined
}

/** The router reader's questions, answered by the classic compiler over this one file. */
function routerContext(context: JavaScriptContext, evidence: FileEvidence): RouterContext {
  const operationAt = (node: Node): string => evidence.operationAt(classic(node))
  return {
    // The classic predicates also accept undefined, which the shared reader never passes.
    ts: ts as unknown as RouterCompiler,
    frameworks: new Set(['express', 'fastify', 'hono', 'koa']),
    // The scan reads each file alone, so it never sees the files that import a registrar.
    exportsEscape: true,
    declarationOf: async node => declarationOf(context, classic(node)) as Node | undefined,
    global: async node => context.checker.getSymbolAtLocation(classic(node)) === undefined,
    importOrigin: async node => importOrigin(context, classic(node)),
    unassigned: async node => ts.isVariableDeclaration(classic(node)) && unassigned(context, classic(node) as ts.VariableDeclaration),
    references: async node => context.bindings.references(classic(node)) as unknown as Node[],
    heldAt: async (node, ...path) => heldAt(context, classic(node), ...path) as Awaited<ReturnType<RouterContext['heldAt']>>,
    objectEntries: async node => objectEntries(context, classic(node)) as Map<string, Node> | undefined,
    urlParts: async node => urlParts(context, classic(node)),
    literalText: async node => literalText(context, node === undefined ? undefined : classic(node)),
    handlerOperation: async (handler, registration) => {
      const target = handler === undefined ? undefined : handlerFunction(context, classic(handler))
      return target === undefined ? operationAt(registration) : evidence.operationAt(target)
    },
    callerOperation: operationAt,
    file: node => classic(node).getSourceFile().fileName,
  }
}

/** Endpoints this file serves; an ordered entry the scan cannot read blocks its paths. */
export async function httpEndpoints(
  context: JavaScriptContext, source: ts.SourceFile, evidence: FileEvidence,
): Promise<ScanHttpEndpoint[]> {
  const routers = routerContext(context, evidence)
  const placed = await routerEndpoints([source], evidence.calls, routers)
  return [...withOrder(placed), ...await serveEndpoints(evidence.calls, routers)]
}
