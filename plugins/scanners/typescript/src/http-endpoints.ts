import type { ScanHttpEndpoint } from '@groma/scanner'
import type { CallExpression, SourceFile } from 'typescript/unstable/ast'

import { withOrder } from '../../http-order.ts'
import type { RouterContext } from '../../http-routers.ts'
import { routerEndpoints, serveEndpoints } from '../../http-routes.ts'
import { controllerEndpoints } from './http-controllers.ts'

/**
 * The endpoints the program serves: Express, Fastify and Hono routes through the TypeScript family's
 * shared router reader, NestJS controllers, and Bun.serve routes.
 */
export async function httpEndpoints(
  context: RouterContext, sources: readonly SourceFile[], calls: readonly CallExpression[],
): Promise<ScanHttpEndpoint[]> {
  const placed = await routerEndpoints(context, sources, calls)
  placed.push(...await controllerEndpoints(context, sources, calls))
  return [...withOrder(placed), ...await serveEndpoints(context, calls)]
}
