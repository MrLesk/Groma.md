import type { ScanHttpRequest } from '@groma/scanner'
import ts from 'typescript'
import { axiosRequest, fetchRequest, runtimeFetch } from '../../http-clients.ts'
import { classicChecker } from '../../http-checker.ts'
import { urlContext } from '../../http-values.ts'

/**
 * The requests the recognized clients send in the components. `analyzed` holds every file of the
 * project, so a change to a value anywhere in it keeps that value from being folded.
 */
export async function reactHttpRequests(
  sources: readonly ts.SourceFile[],
  analyzed: readonly ts.SourceFile[],
  checker: ts.TypeChecker,
  callerOperation: (call: ts.Node) => string,
): Promise<ScanHttpRequest[]> {
  const context = urlContext(ts, classicChecker(ts, checker), analyzed)
  const calls: ts.CallExpression[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) calls.push(node)
    ts.forEachChild(node, visit)
  }
  for (const source of sources) visit(source)
  const requests: ScanHttpRequest[] = []
  for (const call of calls) {
    const request = await fetchRequest(context, call, callee => runtimeFetch(context, callee)) ?? await axiosRequest(context, call)
    if (request !== undefined) requests.push({ operation: callerOperation(call), ...request })
  }
  return requests
}
