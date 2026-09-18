import {
  exported, importedName, indexSources, objectUse, scriptFile, settingEffect, startsWith, topLevel, typePosition, useAt,
  type DynamicImport, type Index, type IndexCompiler, type SourceFile, type Use,
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

export interface BindingCompiler extends IndexCompiler {
  SymbolFlags: { Alias: number; ValueModule: number }
  TypeFlags: {
    StringLike: number; NumberLike: number; BigIntLike: number; BooleanLike: number; EnumLike: number
    ESSymbolLike: number; VoidLike: number; Null: number
  }
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
  /** The names that stand for the variable, directly or through an import, outside types. */
  references(declaration: Node): Node[]
}

interface BindingContext { ts: BindingCompiler; checker: BindingChecker }

function primitive(ts: BindingCompiler, type: CompilerType): boolean {
  if (type.isUnion()) return (type.types ?? []).every(member => primitive(ts, member))
  const flags = ts.TypeFlags
  const mask = flags.StringLike | flags.NumberLike | flags.BigIntLike | flags.BooleanLike | flags.EnumLike
    | flags.ESSymbolLike | flags.VoidLike | flags.Null
  return (type.flags & mask) !== 0
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
  const usesOf = (declaration: Node & { name?: Node }): Use[] => {
    let found = uses.get(declaration)
    if (found !== undefined) return found
    const { names, imported } = indexed()
    const name = declaration.name !== undefined && ts.isIdentifier(declaration.name) ? declaration.name.text : undefined
    const texts = name === undefined ? [] : [name, 'default', ...imported]
    const candidates = new Set(texts.flatMap(text => names.get(text) ?? []))
    found = [...candidates].flatMap(node => typePosition(ts, node) || !refersTo(node, declaration) ? [] : [useAt(ts, node)])
    uses.set(declaration, found)
    return found
  }
  /** The module an imported name holds as an object: a namespace import, or a re-exported namespace. */
  const moduleOf = (node: Identifier): CompilerSymbol | undefined => {
    const symbol = symbolOf(node)
    const resolved = symbol === undefined ? undefined : target(symbol)
    return resolved !== undefined && resolved.flags & ts.SymbolFlags.ValueModule ? resolved : undefined
  }
  /** Whether a dynamic import's module object is used as a whole, through its binding or by being handed on. */
  const dynamicEscapes = ({ binding }: DynamicImport): boolean => {
    if (binding === undefined) return true
    const bound = symbolOf(binding)
    return (indexed().names.get(binding.text) ?? []).some(node => symbolOf(node) === bound && objectUse(ts, node))
  }
  /** The modules whose object the sources use as a whole. */
  const escapedModules = (): CompilerSymbol[] => {
    const { names, imported, dynamic } = indexed()
    const imports = [...imported].flatMap(text => names.get(text) ?? []).flatMap(node => {
      const module = objectUse(ts, node) ? moduleOf(node) : undefined
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
    const effect = settingEffect(use, path, keys)
    if (effect.kind === 'assigns') settings.assigned.set(effect.key, [...settings.assigned.get(effect.key) ?? [], effect.value])
    else if (effect.kind === 'changes') settings.changed ||= readChanges(use)
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
    references: declaration => usesOf(declaration).map(use => use.reference),
  }
}
