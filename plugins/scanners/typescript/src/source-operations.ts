import path from 'node:path'
import {
  isArrowFunction, isAsExpression, isBinaryExpression, isCallExpression, isConditionalExpression,
  isFunctionDeclaration, isFunctionExpression, isIdentifier, isMethodDeclaration, isNewExpression,
  isNonNullExpression, isObjectLiteralExpression, isParameterDeclaration, isParenthesizedExpression,
  isPropertyAccessExpression, isPropertyAssignment, isShorthandPropertyAssignment,
  isVariableDeclaration, isSpreadAssignment, NodeFlags, SyntaxKind,
  type CallExpression, type Node, type SourceFile,
} from 'typescript/unstable/ast'
import { SymbolFlags, type Checker, type Symbol as CompilerSymbol } from 'typescript/unstable/async'
import type { ScanHttpEndpoint, ScanHttpRequest, ScanInvocation, ScanOperation } from '@groma/scanner'

import { httpEndpoints } from './http-endpoints.ts'
import { httpRequests } from './http-requests.ts'
import type { HttpContext } from './http-values.ts'
import { tokenizeOperation } from './source-tokens.ts'

interface Values {
  nodes: Node[]
  unresolved: boolean
  binding?: { file: string; line: number; position: number }
}

const unknown = (): Values[] => [{ nodes: [], unresolved: true }]
const MAX_DEPTH = 8
const MAX_ALTERNATIVES = 32

/** Only these identifier positions can be followed by the value resolver. */
function valueReference(node: Node): boolean {
  const parent = node.parent
  if (!parent) return false
  if (isPropertyAccessExpression(parent)) return parent.expression === node
  if (isCallExpression(parent) || isConditionalExpression(parent)) return true
  if (isVariableDeclaration(parent) || isPropertyAssignment(parent)) return parent.initializer === node
  return isShorthandPropertyAssignment(parent) || isParenthesizedExpression(parent)
    || isAsExpression(parent) || isNonNullExpression(parent)
}

function executable(node: Node): boolean {
  return isArrowFunction(node) || isFunctionExpression(node)
    || (isFunctionDeclaration(node) && node.body !== undefined)
    || (isMethodDeclaration(node) && node.body !== undefined)
}

function location(root: string, node: Node): { file: string; line: number; position: number } {
  const source = node.getSourceFile()
  return {
    file: path.relative(root, source.fileName).split(path.sep).join('/'),
    line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
    position: node.getStart(),
  }
}

/**
 * A function written as a property of an object literal argument, such as `subscribe({ next: value => ... })`.
 * The argument may belong to a function call, a `new` call, or a decorator, which is a call.
 */
function callArgumentProperty(node: Node): boolean {
  const property = isPropertyAssignment(node.parent) ? node.parent : node
  if (!isPropertyAssignment(property) && !isMethodDeclaration(property)) return false
  const invocation = property.parent.parent
  return isObjectLiteralExpression(property.parent) && (isCallExpression(invocation) || isNewExpression(invocation))
}

/** Name of an operation core may compare; undefined for module code and anonymous callbacks. */
function comparableName(node: Node): string | undefined {
  if (!node.parent || callArgumentProperty(node)) return undefined
  if ('name' in node && node.name && isIdentifier(node.name as Node)) return (node.name as { text: string }).text
  if (isPropertyAssignment(node.parent) || isVariableDeclaration(node.parent)) return node.parent.name.getText()
  return undefined
}

/** Binding-normalized body tokens with their inclusive source range. */
function comparableBody(node: Node): Pick<ScanOperation, 'startLine' | 'endLine' | 'tokens'> {
  const source = node.getSourceFile()
  return {
    startLine: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
    endLine: source.getLineAndCharacterOfPosition(node.end).line + 1,
    tokens: tokenizeOperation(node),
  }
}

function caller(node: Node): Node {
  let parent = node.parent
  while (parent.parent && !executable(parent)) parent = parent.parent
  return parent
}

/** Resolve only source values: signatures on interfaces are not implementations. */
class OperationResolver {
  readonly calls: CallExpression[] = []
  readonly callers = new Map<Node, CallExpression[]>()
  private readonly parameters = new Map<Node, Map<number, Promise<Values[]>>>()
  private readonly writtenReceivers = new Set<number>()
  private readonly symbols = new Map<Node, CompilerSymbol | undefined>()
  private readonly declarations = new Map<number, Promise<Node | undefined>>()

  private readonly root: string
  private readonly checker: Checker

  constructor(root: string, checker: Checker) { this.root = root; this.checker = checker }

  async prepare(sources: SourceFile[]): Promise<void> {
    const names: Node[] = []
    const writes: Node[] = []
    function visit(node: Node, calls: CallExpression[]): void {
      if (isIdentifier(node) && valueReference(node)) names.push(node)
      if (isBinaryExpression(node) && node.operatorToken.kind >= SyntaxKind.FirstAssignment
        && node.operatorToken.kind <= SyntaxKind.LastAssignment && isPropertyAccessExpression(node.left)) writes.push(node.left.expression)
      if (isCallExpression(node)) calls.push(node)
      node.forEachChild(child => visit(child, calls))
    }
    for (const source of sources) visit(source, this.calls)
    const symbols = await this.checker.getSymbolAtLocation(names)
    for (let index = 0; index < names.length; index++) this.symbols.set(names[index]!, symbols[index])
    for (const write of writes) {
      const symbol = this.symbols.get(write)
      if (symbol) this.writtenReceivers.add(symbol.id)
    }
    await Promise.all(this.calls.map(async call => {
      const values = await this.resolve(call.expression, 0, false)
      for (const value of values) {
        if (value.unresolved) continue
        for (const node of value.nodes.filter(executable)) {
          const calls = this.callers.get(node) ?? []
          calls.push(call)
          this.callers.set(node, calls)
        }
      }
    }))
    for (const calls of this.callers.values()) calls.sort((left, right) => {
      return left.getSourceFile().fileName.localeCompare(right.getSourceFile().fileName) || left.getStart() - right.getStart()
    })
  }

  private declaration(name: Node): Promise<Node | undefined> {
    const symbol = this.symbols.get(name)
    if (!symbol) return Promise.resolve(undefined)
    let result = this.declarations.get(symbol.id)
    if (!result) {
      result = (async () => {
        const canonical = symbol.flags & SymbolFlags.Alias ? await this.checker.getAliasedSymbol(symbol) : symbol
        return canonical.valueDeclaration?.resolve()
      })()
      this.declarations.set(symbol.id, result)
    }
    return result
  }

  private parameter(node: Node, depth: number): Promise<Values[]> {
    let depths = this.parameters.get(node)
    if (!depths) {
      depths = new Map()
      this.parameters.set(node, depths)
    }
    let result = depths.get(depth)
    if (!result) {
      result = this.parameterValues(node, depth)
      depths.set(depth, result)
    }
    return result
  }

  private async parameterValues(node: Node, depth: number): Promise<Values[]> {
    if (!isParameterDeclaration(node)) return unknown()
    const owner = node.parent
    if (!('parameters' in owner)) return unknown()
    const index = (owner.parameters as readonly Node[]).indexOf(node)
    const calls = this.callers.get(owner) ?? []
    if (!calls.length || calls.length > MAX_ALTERNATIVES) return unknown()
    const results = await Promise.all(calls.map(async call => {
      const argument = call.arguments[index]
      if (!argument) return unknown()
      const values = await this.resolve(argument, depth + 1, true)
      return values.map(value => ({ ...value, binding: value.binding ?? location(this.root, call) }))
    }))
    // Forwarding the same binding through several paths does not create new values.
    const unique = new Map<string, Values>()
    for (const result of results.flat()) {
      const key = JSON.stringify([result.binding, result.unresolved, result.nodes.map(node => `${node.getSourceFile().fileName}:${node.getStart()}`)])
      unique.set(key, result)
    }
    return [...unique.values()]
  }

  private async property(node: Node, depth: number, parameters: boolean): Promise<Values[]> {
    if (!isPropertyAccessExpression(node)) return unknown()
    const receiver = this.symbols.get(node.expression)
    if (receiver && this.writtenReceivers.has(receiver.id)) return unknown()
    const bases = await this.resolve(node.expression, depth + 1, parameters)
    const result: Values[] = []
    for (const base of bases) {
      const values: Values = { ...base, nodes: [] }
      for (const object of base.nodes) {
        if (!isObjectLiteralExpression(object) || object.properties.some(isSpreadAssignment)) { values.unresolved = true; continue }
        const property = object.properties.find(property => 'name' in property && property.name?.getText() === node.name.text)
        const expression = property && propertyValue(property)
        if (!expression) { values.unresolved = true; continue }
        const resolved = await this.resolve(expression, depth + 1, parameters)
        values.nodes.push(...resolved.flatMap(value => value.nodes))
        values.unresolved ||= resolved.some(value => value.unresolved)
      }
      result.push(values)
    }
    return result
  }

  async resolve(node: Node, depth: number, parameters: boolean): Promise<Values[]> {
    if (depth > MAX_DEPTH) return unknown()
    if (executable(node) || isObjectLiteralExpression(node)) return [{ nodes: [node], unresolved: false }]
    if (isParenthesizedExpression(node) || isAsExpression(node) || isNonNullExpression(node)) {
      return this.resolve(node.expression, depth + 1, parameters)
    }
    if (isConditionalExpression(node)) {
      const branches = await Promise.all([node.whenTrue, node.whenFalse].map(branch => this.resolve(branch, depth + 1, parameters)))
      return [{ nodes: branches.flat(1).flatMap(value => value.nodes), unresolved: branches.flat().some(value => value.unresolved) }]
    }
    if (isPropertyAccessExpression(node)) return this.property(node, depth, parameters)
    return this.identifier(node, depth, parameters)
  }

  private async identifier(node: Node, depth: number, parameters: boolean): Promise<Values[]> {
    if (!isIdentifier(node)) return unknown()
    const symbol = this.symbols.get(node)
    if (symbol && this.writtenReceivers.has(symbol.id)) return unknown()
    const declaration = await this.declaration(node)
    if (!declaration) return unknown()
    if (isParameterDeclaration(declaration)) return parameters ? this.parameter(declaration, depth) : unknown()
    if (isVariableDeclaration(declaration)) {
      if (!(declaration.parent.flags & NodeFlags.Const) || !declaration.initializer) return unknown()
      return this.resolve(declaration.initializer, depth + 1, parameters)
    }
    return executable(declaration) ? [{ nodes: [declaration], unresolved: false }] : unknown()
  }
}

function propertyValue(node: Node): Node | undefined {
  if (isPropertyAssignment(node)) return node.initializer
  if (isShorthandPropertyAssignment(node)) return node.name
  if (isMethodDeclaration(node)) return node
  return undefined
}

/** A supplied callback is tied to a concrete argument path, not a merged global target set. */
export async function sourceOperations(root: string, sources: SourceFile[], checker: Checker): Promise<{
  operations: ScanOperation[]
  invocations: ScanInvocation[]
  httpEndpoints: ScanHttpEndpoint[]
  httpRequests: ScanHttpRequest[]
}> {
  const resolver = new OperationResolver(root, checker)
  await resolver.prepare(sources)
  const owned = new Set(sources.map(source => location(root, source).file))
  const operations = new Map<string, ScanOperation>()
  function operation(node: Node): string {
    const { file } = location(root, node)
    const id = `${file}#${node.parent ? node.getStart() : 'module'}`
    if (!operations.has(id)) {
      const name = comparableName(node)
      operations.set(id, {
        id,
        file,
        name: name ?? '(anonymous)',
        position: node.getStart(),
        // Only named operations are compared as possible duplicate logic.
        ...(name === undefined ? {} : comparableBody(node)),
      })
    }
    return id
  }
  function visit(node: Node | undefined): void {
    if (!node) return
    if (executable(node)) operation(node)
    node.forEachChild(child => visit(child))
  }
  for (const source of sources) visit(source)
  const invocations: ScanInvocation[] = []
  for (let offset = 0; offset < resolver.calls.length; offset += 256) {
    invocations.push(...(await Promise.all(resolver.calls.slice(offset, offset + 256).map(async call => {
      const values = await resolver.resolve(call.expression, 0, true)
      return values.map(value => {
        const targets = value.nodes.filter(node => executable(node) && owned.has(location(root, node).file))
        return {
          source: operation(caller(call)),
          targets: [...new Set(targets.map(operation))],
          unresolved: value.unresolved || targets.length !== value.nodes.length,
          line: location(root, call).line,
          position: call.getStart(),
          ...(isPropertyAccessExpression(call.expression) ? { member: call.expression.name.text } : {}),
          ...(value.binding ? { binding: value.binding } : {}),
        }
      })
    }))).flat())
  }
  const facts = await sourceHttpFacts(root, sources, checker, resolver, owned, operation)
  return { operations: [...operations.values()], invocations, ...facts }
}

/** HTTP facts name the operations already collected, so they are extracted before the map closes. */
async function sourceHttpFacts(
  root: string,
  sources: SourceFile[],
  checker: Checker,
  resolver: OperationResolver,
  owned: Set<string>,
  operation: (node: Node) => string,
): Promise<{ httpEndpoints: ScanHttpEndpoint[]; httpRequests: ScanHttpRequest[] }> {
  const certainValues = async (node: Node): Promise<Node[] | undefined> => {
    const values = await resolver.resolve(node, 0, false)
    return values.some(value => value.unresolved) ? undefined : values.flatMap(value => value.nodes)
  }
  const context: HttpContext = {
    checker,
    values: certainValues,
    callerOperation: node => operation(caller(node)),
    async handlerOperation(handler, registration) {
      const values = handler === undefined ? undefined : await certainValues(handler)
      const handlers = (values ?? []).filter(node => executable(node) && owned.has(location(root, node).file))
      return handlers.length === 1 ? operation(handlers[0]!) : operation(caller(registration))
    },
  }
  return {
    httpEndpoints: await httpEndpoints(sources, resolver.calls, context),
    httpRequests: await httpRequests(resolver.calls, context),
  }
}
