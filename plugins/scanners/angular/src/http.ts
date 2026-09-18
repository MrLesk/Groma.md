import type { HttpRequestSegment, ScanHttpRequest } from '@groma/scanner'
import ts from 'typescript'
import { angularImport } from './components.ts'

// The URL composition follows the reference plugins/scanners/typescript/src/http-paths.ts.

/** RFC 3986 path characters, the literal text the shared contract accepts. */
const pathText = /^[A-Za-z0-9\-._~!$&'()*+,;=:@%]+$/
const absolute = /^([A-Za-z][A-Za-z\d+.-]*:)?\/\//
const methodToken = /^[A-Z][A-Z-]*$/
const MAX_DEPTH = 8
/** A hole marker no literal path text can contain, so a real space is never mistaken for one. */
const HOLE = '\0'

const CLIENT = '@angular/common/http'

/** The HttpClient methods that take the URL first. */
const METHODS = new Map([
  ['get', 'GET'], ['post', 'POST'], ['put', 'PUT'], ['patch', 'PATCH'],
  ['delete', 'DELETE'], ['head', 'HEAD'], ['options', 'OPTIONS'],
])

/** One computed expression inside a URL; `configured` marks a value the scanner cannot see. */
type UrlPart = { kind: 'text'; text: string } | { kind: 'hole'; configured: boolean }

const computed: UrlPart = { kind: 'hole', configured: false }

function requestSegment(part: string): HttpRequestSegment {
  if (part === HOLE) return { kind: 'dynamic' }
  if (part.includes(HOLE) || !pathText.test(part)) return { kind: 'unknown' }
  return { kind: 'literal', value: part }
}

/** The path stops before the query and fragment, whose text never reaches the fact. */
function segmentsOf(parts: readonly UrlPart[]): HttpRequestSegment[] {
  const url = parts.map(part => part.kind === 'text' ? part.text : HOLE).join('')
  const end = Math.min(...['?', '#'].map(mark => url.includes(mark) ? url.indexOf(mark) : url.length))
  return url.slice(0, end).split('/').filter(part => part !== '').map(requestSegment)
}

/** A literal scheme and authority state a host, which is never comparable path text. */
function afterAuthority(text: string): string {
  const slash = text.indexOf('/', text.indexOf('//') + 2)
  return slash < 0 ? '' : text.slice(slash)
}

/**
 * Turn a resolved URL into the request fact. A base the scanner resolves to a host, or cannot
 * resolve at all, becomes a leading unknown segment; only a configuration value sets `configured`.
 */
function requestUrl(input: readonly UrlPart[]): { configured?: true; path: HttpRequestSegment[] } {
  const parts = input.filter(part => part.kind === 'hole' || part.text !== '')
  const [first, ...rest] = parts
  if (first === undefined) return { path: [{ kind: 'unknown' }] }
  if (first.kind === 'hole') {
    const path = segmentsOf(rest)
    return first.configured ? { configured: true, path } : { path: [{ kind: 'unknown' }, ...path] }
  }
  if (absolute.test(first.text)) {
    return { path: [{ kind: 'unknown' }, ...segmentsOf([{ kind: 'text', text: afterAuthority(first.text) }, ...rest])] }
  }
  if (!first.text.startsWith('/')) return { path: [{ kind: 'unknown' }, ...segmentsOf(parts)] }
  return { path: segmentsOf(parts) }
}

/** A declaration without a value, such as a type-only one, still counts as seen, so its value stays computed. */
function declarationOf(node: ts.Node, checker: ts.TypeChecker): ts.Declaration | undefined {
  let symbol = checker.getSymbolAtLocation(node)
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol)
  return symbol?.valueDeclaration ?? symbol?.declarations?.[0]
}

/** `readonly` still allows a constructor to replace the value, which a literal path must not hide. */
function reassigned(property: ts.PropertyDeclaration): boolean {
  const name = ts.isIdentifier(property.name) ? property.name.text : undefined
  if (name === undefined) return true
  let assigned = false
  const visit = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(node.left) && node.left.name.text === name
      && node.left.expression.kind === ts.SyntaxKind.ThisKeyword) assigned = true
    ts.forEachChild(node, visit)
  }
  visit(property.parent)
  return assigned
}

/** A value assigned once: a `const`, an object-literal property, or a `readonly` field its class never replaces. */
function constantValue(declaration: ts.Declaration): ts.Expression | undefined {
  if (ts.isPropertyAssignment(declaration)) return declaration.initializer
  if (ts.isPropertyDeclaration(declaration)) {
    const readonly = (ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Readonly) !== 0
    return readonly && !reassigned(declaration) ? declaration.initializer : undefined
  }
  if (!ts.isVariableDeclaration(declaration) || !declaration.initializer) return undefined
  return (declaration.parent.flags & ts.NodeFlags.Const) !== 0 ? declaration.initializer : undefined
}

function referenceRoot(node: ts.Node): ts.Node {
  let current = node
  while (ts.isPropertyAccessExpression(current)) current = current.expression
  return current
}

/** A value the scanner cannot see is configuration when its root is not local code. */
function unseenValue(node: ts.Node, checker: ts.TypeChecker): UrlPart {
  const root = referenceRoot(node)
  const declaration = ts.isIdentifier(root) ? declarationOf(root, checker) : undefined
  return declaration === undefined ? { kind: 'hole', configured: true } : computed
}

function referenceParts(node: ts.Node, checker: ts.TypeChecker, depth: number): UrlPart[] {
  const declaration = declarationOf(node, checker)
  if (declaration === undefined) return [unseenValue(node, checker)]
  if (ts.isParameter(declaration)) return [computed]
  const constant = constantValue(declaration)
  return constant === undefined ? [computed] : urlParts(constant, checker, depth + 1)
}

/** Resolve a URL expression into literal text and the holes the source computes. */
function urlParts(node: ts.Expression, checker: ts.TypeChecker, depth = 0): UrlPart[] {
  if (depth > MAX_DEPTH) return [computed]
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [{ kind: 'text', text: node.text }]
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) {
    return urlParts(node.expression, checker, depth + 1)
  }
  if (ts.isTemplateExpression(node)) {
    const parts: UrlPart[] = [{ kind: 'text', text: node.head.text }]
    for (const span of node.templateSpans) {
      parts.push(...urlParts(span.expression, checker, depth + 1), { kind: 'text', text: span.literal.text })
    }
    return parts
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return [...urlParts(node.left, checker, depth + 1), ...urlParts(node.right, checker, depth + 1)]
  }
  if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) return referenceParts(node, checker, depth)
  return [computed]
}

/** An uppercase method token the shared contract accepts. */
function methodName(node: ts.Expression | undefined, checker: ts.TypeChecker): string | undefined {
  if (node === undefined) return undefined
  const parts = urlParts(node, checker)
  const [first] = parts
  const method = parts.length === 1 && first?.kind === 'text' ? first.text.toUpperCase() : undefined
  return method !== undefined && methodToken.test(method) ? method : undefined
}

function injectsClient(initializer: ts.Expression | undefined, checker: ts.TypeChecker): boolean {
  if (initializer === undefined || !ts.isCallExpression(initializer)) return false
  if (!angularImport(initializer.expression, checker, 'inject')) return false
  const token = initializer.arguments[0]
  return token !== undefined && angularImport(token, checker, 'HttpClient', CLIENT)
}

function declaredClient(type: ts.TypeNode | undefined, checker: ts.TypeChecker): boolean {
  return type !== undefined && ts.isTypeReferenceNode(type)
    && angularImport(type.typeName, checker, 'HttpClient', CLIENT)
}

/**
 * The receiver must hold the injected client: a constructor parameter property, a field, or a local
 * whose type is `HttpClient`, or one that `inject(HttpClient)` supplies. A method name alone proves
 * nothing, since any object can have a `get`.
 */
function isHttpClient(node: ts.Expression, checker: ts.TypeChecker): boolean {
  const declaration = declarationOf(node, checker)
  if (declaration === undefined) return false
  if (ts.isParameter(declaration)) return declaredClient(declaration.type, checker)
  if (ts.isPropertyDeclaration(declaration) || ts.isVariableDeclaration(declaration)) {
    return declaredClient(declaration.type, checker) || injectsClient(declaration.initializer, checker)
  }
  return false
}

/** The method and URL of one client call; `request` names its method first. */
function clientCall(
  call: ts.CallExpression, checker: ts.TypeChecker,
): { method?: string; url: ts.Expression } | undefined {
  const callee = call.expression
  if (!ts.isPropertyAccessExpression(callee) || !isHttpClient(callee.expression, checker)) return undefined
  const method = METHODS.get(callee.name.text)
  if (method !== undefined) {
    const url = call.arguments[0]
    return url === undefined ? undefined : { method, url }
  }
  if (callee.name.text !== 'request') return undefined
  // `request(method, url)`; the single `HttpRequest` form states no separate URL.
  const url = call.arguments[1]
  if (url === undefined) return undefined
  const named = methodName(call.arguments[0], checker)
  return { ...(named === undefined ? {} : { method: named }), url }
}

/**
 * The requests Angular's HttpClient sends. Angular serves no endpoint: its router routes,
 * interceptors and guards answer no HTTP request.
 */
export function angularHttpRequests(
  sources: readonly ts.SourceFile[],
  checker: ts.TypeChecker,
  callerOperation: (call: ts.Node) => string | undefined,
): ScanHttpRequest[] {
  const requests: ScanHttpRequest[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const client = clientCall(node, checker)
      const operation = client === undefined ? undefined : callerOperation(node)
      if (client !== undefined && operation !== undefined) {
        requests.push({
          operation,
          ...(client.method === undefined ? {} : { method: client.method }),
          ...requestUrl(urlParts(client.url, checker)),
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  for (const source of sources) visit(source)
  return requests
}
