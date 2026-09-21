import type { ScanHttpEndpoint, ScanHttpRequest } from '@groma/scanner'
import ts from 'typescript'
import { classicChecker } from '../../http-checker.ts'
import { withOrder } from '../../http-order.ts'
import type { RouterCompiler, RouterContext } from '../../http-routers.ts'
import { routerEndpoints, serveEndpoints } from '../../http-routes.ts'
import type { Node } from '../../http-syntax.ts'
import { heldAt, urlContext } from '../../http-values.ts'
import type { FileEvidence } from './evidence.ts'
import { httpRequest } from './http-requests.ts'

/**
 * The compiler's own name resolution for one file, as a program holding only that file: imports and
 * the runtime's globals resolve to nothing, as everything outside the file does for this scanner.
 */
export function fileChecker(source: ts.SourceFile): ts.TypeChecker {
  const options: ts.CompilerOptions = { allowJs: true, noLib: true, noResolve: true, types: [], noEmit: true }
  const host: ts.CompilerHost = {
    getSourceFile: name => name === source.fileName ? source : undefined,
    getDefaultLibFileName: () => 'lib.d.ts',
    writeFile: () => undefined,
    getCurrentDirectory: () => '',
    getCanonicalFileName: name => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: name => name === source.fileName,
    readFile: () => undefined,
  }
  return ts.createProgram([source.fileName], options, host).getTypeChecker()
}

function classic(node: Node): ts.Node {
  return node as unknown as ts.Node
}

/**
 * The shared readers' context over this one file. The file is read alone, so a value from another file
 * is one the scan cannot see, and exporting a router hands it to files the scan never reads.
 */
function fileContext(source: ts.SourceFile, evidence: FileEvidence): RouterContext {
  const context = urlContext(ts as typeof ts & RouterCompiler, classicChecker(ts, fileChecker(source)), [source], true)
  const operationAt = (node: Node): string => evidence.operationAt(classic(node))
  return {
    ...context,
    frameworks: new Set(['express', 'fastify', 'hono', 'koa']),
    exportsHandOff: true,
    async handlerOperation(handler, registration) {
      const held = handler === undefined ? undefined : await heldAt(context, handler)
      return typeof held === 'object' && ts.isFunctionLike(classic(held.node)) ? operationAt(held.node) : operationAt(registration)
    },
    callerOperation: operationAt,
    file: node => node.getSourceFile().fileName,
  }
}

/** The HTTP facts one file states, named against the operations its evidence already recorded. */
export async function javaScriptHttpFacts(source: ts.SourceFile, evidence: FileEvidence): Promise<{
  httpEndpoints: ScanHttpEndpoint[]
  httpRequests: ScanHttpRequest[]
}> {
  const context = fileContext(source, evidence)
  const httpRequests: ScanHttpRequest[] = []
  for (const call of evidence.calls) {
    const request = await httpRequest(context, call)
    if (request !== undefined) httpRequests.push({ operation: evidence.operationAt(call), ...request })
  }
  const placed = await routerEndpoints(context, [source], evidence.calls)
  return { httpEndpoints: [...withOrder(placed), ...await serveEndpoints(context, evidence.calls)], httpRequests }
}
