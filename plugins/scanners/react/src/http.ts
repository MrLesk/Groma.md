import type { ScanHttpRequest } from '@groma/scanner'
import ts from 'typescript'
import { axiosRequest, fetchMethod, type ClientContext, type RequestFact } from '../../http-clients.ts'
import { requestUrl } from '../../http-url.ts'
import { urlContext, urlParts } from '../../http-values.ts'

interface ReactContext extends ClientContext {
  checker: ts.TypeChecker
}

/** The runtime `fetch`: a name the project declares itself is a local function, not the client. */
function isRuntimeFetch(callee: ts.Expression, checker: ts.TypeChecker): boolean {
  if (!ts.isIdentifier(callee) || callee.text !== 'fetch') return false
  const declaration = checker.getSymbolAtLocation(callee)?.valueDeclaration
  return declaration === undefined || declaration.getSourceFile().isDeclarationFile
}

function fetchRequest(call: ts.CallExpression, context: ReactContext): RequestFact | undefined {
  if (!isRuntimeFetch(call.expression, context.checker)) return undefined
  const [url, init] = call.arguments
  if (url === undefined) return undefined
  return { ...fetchMethod(context, url, init), ...requestUrl(urlParts(context, url)) }
}

/**
 * The requests the recognized clients send in the components. `analyzed` holds every file of the
 * project, so a change to a value anywhere in it keeps that value from being folded.
 */
export function reactHttpRequests(
  sources: readonly ts.SourceFile[],
  analyzed: readonly ts.SourceFile[],
  checker: ts.TypeChecker,
  callerOperation: (call: ts.Node) => string | undefined,
): ScanHttpRequest[] {
  const context: ReactContext = urlContext(ts, checker, analyzed)
  const requests: ScanHttpRequest[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const request = fetchRequest(node, context) ?? axiosRequest(context, node)
      const operation = request === undefined ? undefined : callerOperation(node)
      if (request !== undefined && operation !== undefined) requests.push({ operation, ...request })
    }
    ts.forEachChild(node, visit)
  }
  for (const source of sources) visit(source)
  return requests
}
