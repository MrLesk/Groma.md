import type { ScanHttpRequest } from '@groma/scanner'
import ts from 'typescript'
import {
  axiosRequest, createdBase, optionsMethod,
  type Client, type ClientContext, type RequestFact,
} from '../../http-clients.ts'
import { requestUrl } from '../../http-url.ts'
import { constantOf, urlParts } from '../../http-values.ts'

interface ReactContext extends ClientContext {
  checker: ts.TypeChecker
}

/** Where a local name comes from, so a client is recognized without resolving its types. */
function importedFrom(node: ts.Node, checker: ts.TypeChecker): string | undefined {
  const declaration = checker.getSymbolAtLocation(node)?.declarations?.[0]
  const clause = declaration !== undefined && (ts.isImportSpecifier(declaration) || ts.isImportClause(declaration))
    ? (ts.isImportSpecifier(declaration) ? declaration.parent.parent.parent : declaration.parent)
    : undefined
  if (clause === undefined || !ts.isImportDeclaration(clause) || !ts.isStringLiteral(clause.moduleSpecifier)) return undefined
  return clause.moduleSpecifier.text
}

/** The runtime `fetch`: a name the project declares itself is a local function, not the client. */
function isRuntimeFetch(callee: ts.Expression, checker: ts.TypeChecker): boolean {
  if (!ts.isIdentifier(callee) || callee.text !== 'fetch') return false
  const declaration = checker.getSymbolAtLocation(callee)?.valueDeclaration
  return declaration === undefined || declaration.getSourceFile().isDeclarationFile
}

/** `axios` itself, or an instance assigned once from `axios.create`, whose base starts every path. */
function axiosClient(node: ts.Node, context: ReactContext): Client | undefined {
  if (!ts.isIdentifier(node)) return undefined
  if (importedFrom(node, context.checker) === 'axios') return { base: [] }
  // Only a value assigned once: a reassigned instance could carry another base at runtime.
  const created = constantOf<ts.Expression>(context, node)
  if (created === undefined || !ts.isCallExpression(created)) return undefined
  const callee = created.expression
  if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== 'create') return undefined
  if (importedFrom(callee.expression, context.checker) !== 'axios') return undefined
  return { base: createdBase(context, created) }
}

function fetchRequest(call: ts.CallExpression, context: ReactContext): RequestFact | undefined {
  if (!isRuntimeFetch(call.expression, context.checker)) return undefined
  const [url, init] = call.arguments
  if (url === undefined) return undefined
  return { ...optionsMethod(context, init), ...requestUrl(urlParts(context, url)) }
}

/**
 * The requests the recognized clients send. A React application is a client: its components serve no
 * HTTP endpoint, so this scanner reports none.
 */
export function reactHttpRequests(
  sources: readonly ts.SourceFile[],
  checker: ts.TypeChecker,
  callerOperation: (call: ts.Node) => string | undefined,
): ScanHttpRequest[] {
  const context: ReactContext = { ts, checker }
  const requests: ScanHttpRequest[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const request = fetchRequest(node, context) ?? axiosRequest(context, node, client => axiosClient(client as ts.Node, context))
      const operation = request === undefined ? undefined : callerOperation(node)
      if (request !== undefined && operation !== undefined) requests.push({ operation, ...request })
    }
    ts.forEachChild(node, visit)
  }
  for (const source of sources) visit(source)
  return requests
}
