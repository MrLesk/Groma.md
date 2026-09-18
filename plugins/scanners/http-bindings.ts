import {
  exported, exportStatement, importedName, scriptFile, topLevel, typePosition, useOf,
  type SourceFile, type Use, type UseCompiler,
} from './http-uses.ts'

/*
 * How the analyzed sources use each variable, so an HTTP value is folded only while nothing can change
 * it. `const` fixes a binding, not the object it holds: a property path keeps the value its object
 * literal states only when no use of the variable in the sources can replace it. Shared by the
 * TypeScript-family scanners that bundle the classic compiler: Angular, React, Vue and JavaScript.
 */
interface Node {
  kind: number
  parent: Node
}
interface Identifier extends Node { text: string }
interface Wrapped extends Node { expression: Node }
interface Named extends Node { name: Node }
interface FunctionLike extends Node { parameters: readonly Named[] }
interface Call extends Node { expression: Node; arguments: readonly Node[] }
interface ImportDeclaration extends Node { moduleSpecifier: Node }
interface ImportSpecifier extends Named { propertyName?: Identifier }
interface CompilerSymbol { flags: number; valueDeclaration?: Node; declarations?: readonly Node[] }
interface CompilerType { flags: number; symbol?: CompilerSymbol; isUnion(): boolean; types?: readonly CompilerType[] }

export interface BindingChecker {
  getSymbolAtLocation(node: Node): CompilerSymbol | undefined
  getAliasedSymbol(symbol: CompilerSymbol): CompilerSymbol
  getShorthandAssignmentValueSymbol(node: Node | undefined): CompilerSymbol | undefined
  getExportSpecifierLocalTargetSymbol(node: Node): CompilerSymbol | undefined
  getExportsOfModule(module: CompilerSymbol): CompilerSymbol[]
  getTypeAtLocation(node: Node): CompilerType
}

export interface BindingCompiler extends UseCompiler {
  SyntaxKind: UseCompiler['SyntaxKind'] & { ImportKeyword: number }
  SymbolFlags: { Alias: number; ValueModule: number }
  forEachChild(node: Node, visit: (child: Node) => void): void
  TypeFlags: {
    StringLike: number; NumberLike: number; BigIntLike: number; BooleanLike: number; EnumLike: number
    ESSymbolLike: number; VoidLike: number; Null: number
  }
  isVariableDeclaration(node: Node): node is Named
  isParameter(node: Node): node is Named
  isCallExpression(node: Node): node is Call
  isAwaitExpression(node: Node): node is Wrapped
  isArrowFunction(node: Node): node is FunctionLike
  isFunctionExpression(node: Node): node is FunctionLike
  isImportDeclaration(node: Node): node is ImportDeclaration
  isImportSpecifier(node: Node): node is ImportSpecifier
}

/** What the sources write below a path: plain assignments by property, and whether anything else changes it. */
export interface Settings {
  assigned: Map<string, Node[]>
  changed: boolean
}

export interface Bindings {
  /**
   * True when nothing in the sources can change what this property path of the declared variable
   * holds. `reference` is the use being read, which is not a change itself.
   */
  unchanged(declaration: Node, path: readonly string[], reference: Node): boolean
  /** True when the sources assign the variable itself again. */
  reassigned(declaration: Node): boolean
  /**
   * What the sources set on the properties `keys` below `path`, such as a client's `defaults`. Handing
   * the variable itself on is not counted.
   */
  settings(declaration: Node, path: readonly string[], keys: readonly string[]): Settings
  /** The declarations that import a module's default export in the sources. */
  defaultImports(module: string): Node[]
}

interface BindingContext { ts: BindingCompiler; checker: BindingChecker }

function primitive(ts: BindingCompiler, type: CompilerType): boolean {
  if (type.isUnion()) return (type.types ?? []).every(member => primitive(ts, member))
  const flags = ts.TypeFlags
  const mask = flags.StringLike | flags.NumberLike | flags.BigIntLike | flags.BooleanLike | flags.EnumLike
    | flags.ESSymbolLike | flags.VoidLike | flags.Null
  return (type.flags & mask) !== 0
}

function startsWith(path: readonly string[], prefix: readonly string[]): boolean {
  return prefix.length <= path.length && prefix.every((name, index) => path[index] === name)
}

/**
 * The name a dynamic `import()` binds its module object to: `const m = await import(...)` or
 * `.then(m => ...)`. Any other use, a promise held in a variable included, hands the module on.
 */
function dynamicBinding(ts: BindingCompiler, call: Call): Identifier | undefined {
  let holder: Node = call
  let awaited = false
  while (ts.isAwaitExpression(holder.parent) || ts.isParenthesizedExpression(holder.parent)) {
    awaited ||= ts.isAwaitExpression(holder.parent)
    holder = holder.parent
  }
  const parent = holder.parent
  if (ts.isVariableDeclaration(parent)) return awaited && ts.isIdentifier(parent.name) ? parent.name : undefined
  const then = ts.isPropertyAccessExpression(parent) && parent.expression === holder && !awaited ? parent.parent : undefined
  const callback = then !== undefined && ts.isCallExpression(then) ? then.arguments[0] : undefined
  if (callback === undefined || (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))) return undefined
  const [first] = callback.parameters
  return first !== undefined && ts.isIdentifier(first.name) ? first.name : undefined
}

interface DynamicImport {
  call: Call
  /** The name its module object is bound to, or undefined when the module is handed on otherwise. */
  binding?: Identifier
}

interface Index {
  names: Map<string, Identifier[]>
  /** Local names imports bind. */
  imported: Set<string>
  dynamic: DynamicImport[]
  /** Default imports by module. */
  defaults: Map<string, Node[]>
}

/** The module a default import names: `import http from 'm'` or `import { default as http } from 'm'`. */
function defaultImport(ts: BindingCompiler, name: Identifier): { declaration: Node; module: string } | undefined {
  const parent = name.parent
  let statement: Node | undefined
  if (ts.isImportClause(parent) && parent.name === name) statement = parent.parent
  else if (ts.isImportSpecifier(parent) && parent.name === name && parent.propertyName?.text === 'default') {
    statement = parent.parent.parent.parent
  }
  if (statement === undefined || !ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) return undefined
  return { declaration: parent, module: statement.moduleSpecifier.text }
}

function indexName(ts: BindingCompiler, index: Index, node: Identifier): void {
  const same = index.names.get(node.text)
  if (same === undefined) index.names.set(node.text, [node])
  else same.push(node)
  if (importedName(ts, node)) index.imported.add(node.text)
  const imported = defaultImport(ts, node)
  if (imported !== undefined) index.defaults.set(imported.module, [...index.defaults.get(imported.module) ?? [], imported.declaration])
}

function indexSources(ts: BindingCompiler, sources: readonly SourceFile[]): Index {
  const index: Index = { names: new Map(), imported: new Set(), dynamic: [], defaults: new Map() }
  const visit = (node: Node): void => {
    if (ts.isIdentifier(node)) indexName(ts, index, node)
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const binding = dynamicBinding(ts, node)
      index.dynamic.push({ call: node, ...(binding === undefined ? {} : { binding }) })
    }
    ts.forEachChild(node, visit)
  }
  for (const source of sources) visit(source)
  return index
}

/**
 * Index the sources' names once, then resolve the uses of a variable when a fold first asks about it.
 * A program scan sees every importer of an export, but a module object used other than to read one
 * export by name can reach and change every export it holds. `fileAlone` marks a scan that reads each
 * file by itself: other files can change what a file exports, and a script's top-level names, which are
 * globals.
 */
export function bindingUses(
  context: BindingContext, sources: readonly SourceFile[], options: { fileAlone: boolean },
): Bindings {
  const { ts, checker } = context
  let index: Index | undefined
  const indexed = (): Index => { index ??= indexSources(ts, sources); return index }
  const uses = new Map<Node, Use[]>()
  const symbols = new Map<Node, CompilerSymbol | undefined>()
  const resolve = (node: Identifier): CompilerSymbol | undefined => {
    const parent = node.parent
    if (ts.isShorthandPropertyAssignment(parent) && parent.name === node) return checker.getShorthandAssignmentValueSymbol(parent)
    if (ts.isExportSpecifier(parent)) return checker.getExportSpecifierLocalTargetSymbol(parent)
    return checker.getSymbolAtLocation(node)
  }
  const symbolOf = (node: Identifier): CompilerSymbol | undefined => {
    if (!symbols.has(node)) symbols.set(node, resolve(node))
    return symbols.get(node)
  }
  const target = (symbol: CompilerSymbol): CompilerSymbol => symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
  const declared = (symbol: CompilerSymbol): Node | undefined => symbol.valueDeclaration ?? symbol.declarations?.[0]
  /** Whether a name stands for the variable: directly, or through an import of it. */
  const refersTo = (node: Identifier, declaration: Node): boolean => {
    const symbol = symbolOf(node)
    if (symbol === undefined) return false
    if (declared(symbol) === declaration && node.parent !== declaration) return true
    if (!(symbol.flags & ts.SymbolFlags.Alias) || importedName(ts, node)) return false
    return declared(target(symbol)) === declaration
  }
  const useAt = (node: Identifier): Use => {
    const parent = node.parent
    // `var` may declare the same variable again, which assigns it.
    if (ts.isVariableDeclaration(parent) && parent.name === node) return { kind: 'write', path: [], reference: node, value: node }
    if (exportStatement(ts, node)) return { kind: 'export', path: [], reference: node, value: node }
    // A module object reaches the variable as a property name, `ns.name`.
    const accessed = ts.isPropertyAccessExpression(parent) && parent.name === node
    return useOf(ts, accessed ? parent : node)
  }
  const usesOf = (declaration: Node & { name?: Node }): Use[] => {
    let found = uses.get(declaration)
    if (found !== undefined) return found
    const { names, imported } = indexed()
    const name = declaration.name !== undefined && ts.isIdentifier(declaration.name) ? declaration.name.text : undefined
    const texts = name === undefined ? [] : [name, 'default', ...imported]
    const candidates = new Set(texts.flatMap(text => names.get(text) ?? []))
    found = [...candidates].flatMap(node => typePosition(ts, node) || !refersTo(node, declaration) ? [] : [useAt(node)])
    uses.set(declaration, found)
    return found
  }
  /** The module an imported name holds as an object: a namespace import, or a re-exported namespace. */
  const moduleOf = (node: Identifier): CompilerSymbol | undefined => {
    const symbol = symbolOf(node)
    const resolved = symbol === undefined ? undefined : target(symbol)
    return resolved !== undefined && resolved.flags & ts.SymbolFlags.ValueModule ? resolved : undefined
  }
  /** A use other than reading one export by name, `ns.name`, or declaring the name. */
  const objectUse = (node: Identifier): boolean => {
    const parent = node.parent
    const named = ts.isPropertyAccessExpression(parent) && parent.expression === node && ts.isIdentifier(parent.name)
    const declaring = (ts.isVariableDeclaration(parent) || ts.isParameter(parent)) && parent.name === node
    return !named && !declaring && !importedName(ts, node) && !typePosition(ts, node)
  }
  /** Whether a dynamic import's module object is used as a whole, through its binding or by being handed on. */
  const dynamicEscapes = ({ binding }: DynamicImport): boolean => {
    if (binding === undefined) return true
    const bound = symbolOf(binding)
    return (indexed().names.get(binding.text) ?? []).some(node => symbolOf(node) === bound && objectUse(node))
  }
  /** The modules whose object the sources use as a whole. */
  const escapedModules = (): CompilerSymbol[] => {
    const { names, imported, dynamic } = indexed()
    const imports = [...imported].flatMap(text => names.get(text) ?? []).flatMap(node => {
      const module = objectUse(node) ? moduleOf(node) : undefined
      return module === undefined ? [] : [module]
    })
    const loads = dynamic.flatMap(entry => {
      const [specifier] = entry.call.arguments
      const module = specifier === undefined ? undefined : checker.getSymbolAtLocation(specifier)
      return module !== undefined && dynamicEscapes(entry) ? [module] : []
    })
    return [...new Set([...imports, ...loads])]
  }
  let reachable: Set<Node> | undefined
  /** The declarations a module object used as a whole holds, which code the scan cannot follow can change. */
  const escapedExports = (): Set<Node> => {
    reachable ??= new Set(escapedModules().flatMap(module => checker.getExportsOfModule(module)
      .flatMap(symbol => declared(target(symbol)) ?? [])))
    return reachable
  }
  const script = (): boolean => options.fileAlone && sources.some(source => scriptFile(ts, source, indexed().names))
  /** Whether code the scan does not see can reach the variable. */
  const leaves = (declaration: Node): boolean => {
    if (!options.fileAlone) return escapedExports().has(declaration)
    return exported(ts, declaration) || (topLevel(ts, declaration) && script())
  }
  const readChanges = (use: Use): boolean => use.kind !== 'read' || !primitive(ts, checker.getTypeAtLocation(use.value))
  const changes = (use: Use, path: readonly string[], reference: Node): boolean => {
    if (use.reference === reference || !startsWith(path, use.path)) return false
    return use.kind === 'export' ? options.fileAlone : readChanges(use)
  }
  const settingAt = (settings: Settings, use: Use, path: readonly string[], keys: readonly string[]): void => {
    if (use.path.length === 0 || use.kind === 'export') return
    if (startsWith(path, use.path)) { settings.changed ||= readChanges(use); return }
    const key = startsWith(use.path, path) ? use.path[path.length] : undefined
    if (key === undefined || !keys.includes(key)) return
    if (use.assigned !== undefined && use.path.length === path.length + 1) {
      settings.assigned.set(key, [...settings.assigned.get(key) ?? [], use.assigned])
    } else settings.changed ||= readChanges(use)
  }
  return {
    unchanged(declaration, path, reference) {
      return !leaves(declaration) && !usesOf(declaration).some(use => changes(use, path, reference))
    },
    reassigned(declaration) {
      if (options.fileAlone && topLevel(ts, declaration) && script()) return true
      return usesOf(declaration).some(use => use.kind === 'write' && use.path.length === 0)
    },
    settings(declaration, path, keys) {
      const settings: Settings = { assigned: new Map(), changed: leaves(declaration) }
      for (const use of usesOf(declaration)) settingAt(settings, use, path, keys)
      return settings
    },
    defaultImports: module => indexed().defaults.get(module) ?? [],
  }
}
