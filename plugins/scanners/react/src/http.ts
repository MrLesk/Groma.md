import type { ScanHttpRequest } from '@groma/scanner'
import ts from 'typescript'
import { requestUrl, type UrlPart } from '../../http-url.ts'
import { constantOf, methodName, urlParts, type UrlContext } from '../../http-values.ts'

const SHORTHAND = new Map([
  ['get', 'GET'], ['post', 'POST'], ['put', 'PUT'], ['patch', 'PATCH'],
  ['delete', 'DELETE'], ['head', 'HEAD'], ['options', 'OPTIONS'],
])

interface ReactContext extends UrlContext {
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

/** No options means the default method; options the scanner cannot read leave the method out. */
function optionsMethod(options: ts.Expression | undefined, context: ReactContext): { method?: string } {
  if (options === undefined) return { method: 'GET' }
  const object = objectValue(options, context)
  if (object === undefined) return {}
  const declared = propertyValue(object, 'method')
  if (declared === undefined) return { method: 'GET' }
  const method = methodName(context, declared)
  return method === undefined ? {} : { method }
}

/** The single object literal an expression certainly holds; a spread states nothing certain. */
function objectValue(node: ts.Expression | undefined, context: ReactContext): ts.ObjectLiteralExpression | undefined {
  if (node === undefined) return undefined
  const resolved = ts.isObjectLiteralExpression(node) ? node : constantOf<ts.Expression>(context, node)
  if (resolved === undefined || !ts.isObjectLiteralExpression(resolved)) return undefined
  return resolved.properties.some(ts.isSpreadAssignment) ? undefined : resolved
}

function propertyValue(object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  for (const property of object.properties) {
    const key = property.name !== undefined && 'text' in property.name ? property.name.text : undefined
    if (key !== name) continue
    if (ts.isPropertyAssignment(property)) return property.initializer
    // `{ method }` states a value the scanner must still resolve.
    if (ts.isShorthandPropertyAssignment(property)) return property.name
  }
  return undefined
}

/** `axios` itself, or an instance from `axios.create`, whose `baseURL` starts every path. */
function axiosClient(node: ts.Expression, context: ReactContext): { base: UrlPart[] } | undefined {
  if (!ts.isIdentifier(node)) return undefined
  if (importedFrom(node, context.checker) === 'axios') return { base: [] }
  // Only a value assigned once: a reassigned instance could carry another base at runtime.
  const created = constantOf<ts.Expression>(context, node)
  if (created === undefined || !ts.isCallExpression(created)) return undefined
  const callee = created.expression
  if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== 'create') return undefined
  if (importedFrom(callee.expression, context.checker) !== 'axios') return undefined
  const config = objectValue(created.arguments[0], context)
  const baseUrl = config === undefined ? undefined : propertyValue(config, 'baseURL')
  return { base: baseUrl === undefined ? [] : urlParts(context, baseUrl) }
}

function urlRequest(
  base: UrlPart[], method: string | undefined, url: ts.Expression | undefined, context: ReactContext,
): Omit<ScanHttpRequest, 'operation'> | undefined {
  if (url === undefined) return undefined
  return {
    ...(method === undefined ? {} : { method }),
    ...requestUrl([...base, ...urlParts(context, url)]),
  }
}

/** The `axios(config)` and `axios.request(config)` forms, whose method defaults to GET. */
function configRequest(
  base: UrlPart[], config: ts.Expression | undefined, context: ReactContext,
): Omit<ScanHttpRequest, 'operation'> | undefined {
  const options = objectValue(config, context)
  if (options === undefined) return undefined
  const declared = propertyValue(options, 'method')
  const method = declared === undefined ? 'GET' : methodName(context, declared)
  return urlRequest(base, method, propertyValue(options, 'url'), context)
}

function axiosRequest(call: ts.CallExpression, context: ReactContext): Omit<ScanHttpRequest, 'operation'> | undefined {
  const callee = call.expression
  if (ts.isPropertyAccessExpression(callee)) {
    const client = axiosClient(callee.expression, context)
    if (client === undefined) return undefined
    const method = SHORTHAND.get(callee.name.text)
    if (method !== undefined) return urlRequest(client.base, method, call.arguments[0], context)
    return callee.name.text === 'request' ? configRequest(client.base, call.arguments[0], context) : undefined
  }
  const client = axiosClient(callee, context)
  if (client === undefined) return undefined
  const [first, second] = call.arguments
  if (objectValue(first, context) !== undefined) return configRequest(client.base, first, context)
  return urlRequest(client.base, optionsMethod(second, context).method, first, context)
}

function fetchRequest(call: ts.CallExpression, context: ReactContext): Omit<ScanHttpRequest, 'operation'> | undefined {
  if (!isRuntimeFetch(call.expression, context.checker)) return undefined
  const [url, init] = call.arguments
  if (url === undefined) return undefined
  return { ...optionsMethod(init, context), ...requestUrl(urlParts(context, url)) }
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
      const request = fetchRequest(node, context) ?? axiosRequest(node, context)
      const operation = request === undefined ? undefined : callerOperation(node)
      if (request !== undefined && operation !== undefined) requests.push({ operation, ...request })
    }
    ts.forEachChild(node, visit)
  }
  for (const source of sources) visit(source)
  return requests
}
