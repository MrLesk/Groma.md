import type { ScanHttpEndpoint } from '@groma/scanner'
import type { CallExpression, Node, SourceFile, VariableDeclaration } from 'typescript/unstable/ast'

import { withOrder } from '../../http-order.ts'
import type { Node as RouterNode, RouterContext } from '../../http-routers.ts'
import { routerEndpoints, serveEndpoints } from '../../http-routes.ts'
import { syntax } from './http-bindings.ts'
import { controllerEndpoints } from './http-controllers.ts'
import {
  declarationOf, heldAt, importOrigin, literalText, objectEntries, unassigned, urlParts, type HttpContext,
} from './http-values.ts'

/*
 * Express, Fastify and Hono routes through the TypeScript family's shared router reader, NestJS
 * controllers, and Bun.serve routes.
 */

/** The shared router reader describes nodes by less of their shape than the native SDK's. */
function native(node: RouterNode): Node {
  return node as unknown as Node
}

/** The router reader's questions, answered by the native SDK's checker over the program. */
function routerContext(context: HttpContext): RouterContext {
  return {
    ts: syntax,
    frameworks: new Set(['express', 'fastify', 'hono']),
    // The program holds every file that imports a registrar.
    exportsEscape: false,
    declarationOf: async node => await declarationOf(native(node), context.checker) as RouterNode | undefined,
    global: async node => {
      const declaration = await declarationOf(native(node), context.checker)
      return declaration === undefined || declaration.getSourceFile().fileName.endsWith('.d.ts')
    },
    importOrigin: node => importOrigin(native(node), context.checker),
    unassigned: node => unassigned(native(node) as VariableDeclaration, context),
    references: async node => await context.bindings.references(native(node)) as unknown as RouterNode[],
    heldAt: async (node, ...path) => await heldAt(context, native(node), ...path) as Awaited<ReturnType<RouterContext['heldAt']>>,
    objectEntries: async node => await objectEntries(native(node), context) as Map<string, RouterNode> | undefined,
    urlParts: node => urlParts(native(node), context),
    literalText: node => literalText(node === undefined ? undefined : native(node), context),
    handlerOperation: (handler, registration) => context.handlerOperation(handler === undefined ? undefined : native(handler), native(registration)),
    callerOperation: node => context.callerOperation(native(node)),
    file: node => context.file(native(node)),
  }
}

/** Endpoints the supported frameworks serve; an ordered entry the scan cannot read blocks its paths. */
export async function httpEndpoints(
  sources: readonly SourceFile[], calls: readonly CallExpression[], context: HttpContext,
): Promise<ScanHttpEndpoint[]> {
  const routers = routerContext(context)
  const placed = await routerEndpoints(sources, calls, routers)
  placed.push(...await controllerEndpoints(sources, calls, context))
  return [...withOrder(placed), ...await serveEndpoints(calls, routers)]
}
