import type { ScanHttpEndpoint, ScanHttpRequest, ScanOperation, ScanSymbol } from '@groma/scanner'
import { clientNames, clientRequests, curlParts } from './http-clients.ts'
import {
  attributeEndpoints, attributePrefix, builderEndpoints, groupCall, restRouteEndpoints,
  type FileScope, type PendingEndpoint,
} from './http-endpoints.ts'
import { joinPath, literalText, type Constants, type RequestUrl } from './http-url.ts'
import {
  callables, children, field, list, nameOf, operationId, symbolName, typeKinds, type Fields, type Syntax,
} from './syntax.ts'

/** HTTP facts of one file; endpoint handlers are resolved to operations once every file is read. */
export interface PhpHttpFacts {
  endpoints: PendingEndpoint[]
  requests: ScanHttpRequest[]
}

const noConstants: Constants = new Map()

/** `use A\B as C` makes `C` mean `A\B`; without an alias the last name segment stands for it. */
function collectImports(tree: Syntax): Map<string, string> {
  const imports = new Map<string, string>()
  function visit(node: Syntax): void {
    if (node.kind === 'useitem') {
      const name = String((node as Fields).name)
      imports.set(nameOf(field(node, 'alias')) ?? name.split('\\').at(-1)!, name)
    }
    for (const child of children(node)) visit(child)
  }
  visit(tree)
  return imports
}

/**
 * Constants the file declares as literal text: `const NAME = '/api'`, a class constant, and
 * `define('NAME', '/api')`. A name the file declares twice proves no value.
 */
function collectConstants(tree: Syntax): Constants {
  const constants = new Map<string, string | undefined>()
  function declare(name: string | undefined, value: string | undefined): void {
    if (name !== undefined) constants.set(name, constants.has(name) ? undefined : value)
  }
  function visit(node: Syntax): void {
    if (node.kind === 'constant') declare(nameOf(field(node, 'name')), literalText(field(node, 'value'), noConstants))
    if (node.kind === 'call' && nameOf(field(node, 'what'))?.replace(/^\\/, '') === 'define') {
      const [name, value] = list(node, 'arguments')
      declare(literalText(name, noConstants), literalText(value, noConstants))
    }
    for (const child of children(node)) visit(child)
  }
  visit(tree)
  return constants
}

/**
 * One cURL request per operation. The parts of one operation are not tied to their handle, so an
 * operation that states several URLs or several methods proves neither, and reports nothing.
 */
function curlRequests(handles: ReadonlyMap<string, { urls: RequestUrl[]; methods: Set<string> }>): ScanHttpRequest[] {
  return [...handles].flatMap(([operation, { urls, methods }]): ScanHttpRequest[] => {
    const [url] = urls
    const [method] = [...methods]
    if (urls.length !== 1 || methods.size > 1) return []
    return [{ operation, ...(method === undefined ? {} : { method }), ...url! }]
  })
}

/** Endpoints and requests one PHP file states, read from its syntax alone. */
export function phpHttpFacts(file: string, tree: Syntax): PhpHttpFacts {
  const endpoints: PendingEndpoint[] = []
  const requests: ScanHttpRequest[] = []
  const curl = new Map<string, { urls: RequestUrl[]; methods: Set<string> }>()

  function collectCurl(node: Fields, operation: string, constants: Constants): void {
    const parts = curlParts(node, constants)
    if (parts.length === 0) return
    const handle = curl.get(operation) ?? { urls: [], methods: new Set<string>() }
    for (const part of parts) {
      if (part.url !== undefined) handle.urls.push(part.url)
      if (part.method !== undefined) handle.methods.add(part.method)
    }
    curl.set(operation, handle)
  }

  function callFacts(node: Fields, scope: FileScope): void {
    endpoints.push(...builderEndpoints(node, scope), ...restRouteEndpoints(node, scope))
    const operation = scope.operation
    // A request belongs to the operation that supplies its URL; top-level code declares no operation.
    if (operation === undefined) return
    for (const request of clientRequests(node, scope)) requests.push({ operation, ...request })
    collectCurl(node, operation, scope.constants)
  }

  function visitChildren(node: Syntax, scope: FileScope): void {
    for (const child of children(node)) visit(child as Fields, scope)
  }

  /** Client names a declaration binds, added to those the enclosing declarations bound. */
  function withClients(node: Syntax, scope: FileScope): ReadonlySet<string> {
    const names = clientNames(node, scope)
    return names.length === 0 ? scope.clients : new Set([...scope.clients, ...names])
  }

  /** The scope a declaration opens: a namespace, a type with its attribute prefix, or an operation. */
  function declared(node: Fields, scope: FileScope): FileScope | undefined {
    if (node.kind === 'namespace') return { ...scope, namespace: nameOf(node.name) ?? '' }
    if (typeKinds.has(node.kind)) {
      const name = nameOf(node.name)
      const typed = { ...scope, type: name === undefined ? undefined : symbolName(scope.namespace, name) }
      return {
        ...typed,
        clients: withClients(node, typed),
        prefix: joinPath(scope.prefix, attributePrefix(node, scope.constants)),
      }
    }
    if (!callables.has(node.kind)) return undefined
    return { ...scope, operation: operationId(file, node), clients: withClients(node, scope) }
  }

  function visit(node: Fields, scope: FileScope): void {
    if (node.kind === 'method') endpoints.push(...attributeEndpoints(node, scope))
    const opened = declared(node, scope)
    if (opened !== undefined) {
      visitChildren(node, opened)
      return
    }
    const group = node.kind === 'call' ? groupCall(node, scope.constants) : undefined
    // A group's routes are declared in its closure, under the prefix the group states.
    if (group !== undefined) {
      visit(group.routes, { ...scope, prefix: joinPath(scope.prefix, group.prefix) })
      return
    }
    if (node.kind === 'call') callFacts(node, scope)
    visitChildren(node, scope)
  }

  visit(tree as Fields, {
    file,
    namespace: '',
    imports: collectImports(tree),
    constants: collectConstants(tree),
    prefix: '',
    clients: new Set(),
  })
  return { endpoints, requests: [...requests, ...curlRequests(curl)] }
}


/** One file's facts as the scan collects them, before handler symbols name operations. */
export interface FileFacts {
  symbols: ScanSymbol[]
  endpoints: PendingEndpoint[]
}

/**
 * Endpoints whose handler names one declared operation. A handler the scan cannot place, such as a
 * controller method with no body or a function name several files declare, reports no endpoint.
 */
export function resolveEndpoints(files: readonly FileFacts[], operations: readonly ScanOperation[]): ScanHttpEndpoint[] {
  const declared = new Set(operations.map(operation => operation.id))
  const byName = new Map<string, string | undefined>()
  for (const file of files) {
    for (const { id, name } of file.symbols) {
      if (!declared.has(id)) continue
      byName.set(name, byName.has(name) && byName.get(name) !== id ? undefined : id)
    }
  }
  return files.flatMap(file => file.endpoints.flatMap(({ handler, method, path }): ScanHttpEndpoint[] => {
    const operation = 'operation' in handler
      ? (declared.has(handler.operation) ? handler.operation : undefined)
      : byName.get(handler.symbol)
    return operation === undefined ? [] : [{ operation, method, path }]
  }))
}
