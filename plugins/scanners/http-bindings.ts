import type { Checker, CheckerSymbol } from './http-checker.ts'
import type { Node, SourceFile, TextNode as Identifier } from './http-syntax.ts'
import {
  exported, importedName, indexSources, objectUse, scriptFile, settingEffect, startsWith, topLevel, typePosition, useAt,
  type DynamicImport, type Index, type IndexCompiler, type Use,
} from './http-uses.ts'

/*
 * How the analyzed sources use each variable, so an HTTP value is folded only while nothing can change
 * it. `const` fixes a binding, not the object it holds: a property path keeps the value its object
 * literal states only when no use of the variable in the sources can replace it. The syntax is read in
 * ./http-uses.ts; the checker answers which variable each name stands for.
 */

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
  unchanged(declaration: Node, path: readonly string[], reference: Node): Promise<boolean>
  /** True when the sources assign the variable itself again. */
  reassigned(declaration: Node): Promise<boolean>
  /**
   * What the sources set on the properties `keys` below `path`, such as a client's `defaults`. Handing
   * the variable itself on is not counted.
   */
  settings(declaration: Node, path: readonly string[], keys: readonly string[]): Promise<Settings>
  /** The declarations that import a module's default export in the sources. */
  defaultImports(module: string): Node[]
  /** The names that stand for the variable, directly or through an import, outside types. */
  references(declaration: Node): Promise<Node[]>
  /** Every name in the sources spelled `text`. */
  named(text: string): readonly Node[]
  /** Whether the scan reads each file by itself, so other files can change what any of it holds. */
  fileAlone: boolean
}

/**
 * Index the sources' names once, then resolve the uses of a variable when a fold first asks about it.
 * A program scan sees every importer of an export, but a module object used other than to read one
 * export by name can reach and change every export it holds. `fileAlone` marks a scan that reads each
 * file by itself: other files can change what a file exports, and a script's top-level names, which are
 * globals.
 */
export function bindingUses(
  ts: IndexCompiler, checker: Checker, sources: readonly SourceFile[], options: { fileAlone: boolean },
): Bindings {
  let index: Index | undefined
  const indexed = (): Index => { index ??= indexSources(ts, sources); return index }
  const uses = new Map<Node, Promise<Use[]>>()
  const symbols = new Map<Node, Promise<CheckerSymbol | undefined>>()
  const shorthand = (node: Node): boolean => ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node
  /** Resolve names in one request to the checker, and a shorthand property's value one by one. */
  const resolveAll = (names: readonly Node[]): void => {
    const pending = names.filter(node => !symbols.has(node) && !shorthand(node))
    const batch = pending.length === 0 ? Promise.resolve([]) : checker.symbolsAt(pending)
    for (const [position, node] of pending.entries()) symbols.set(node, batch.then(found => found[position]))
  }
  const symbolOf = (node: Node): Promise<CheckerSymbol | undefined> => {
    let found = symbols.get(node)
    if (found === undefined) {
      found = shorthand(node) ? checker.shorthandValue(node.parent) : checker.symbolsAt([node]).then(([symbol]) => symbol)
      symbols.set(node, found)
    }
    return found
  }
  /** Whether a name stands for the variable: directly, or through an import or export of it. */
  const refersTo = async (node: Node, declaration: Node): Promise<boolean> => {
    const symbol = await symbolOf(node)
    if (symbol === undefined || node.parent === declaration) return false
    if (await checker.declaration(symbol) === declaration) return true
    if (importedName(ts, node)) return false
    return await checker.declaration(await checker.aliased(symbol)) === declaration
  }
  const usesOf = (declaration: Node & { name?: Node }): Promise<Use[]> => {
    let found = uses.get(declaration)
    if (found !== undefined) return found
    found = (async () => {
      const { names, imported } = indexed()
      const name = declaration.name !== undefined && ts.isIdentifier(declaration.name) ? declaration.name.text : undefined
      const texts = name === undefined ? [] : [name, 'default', ...imported]
      const candidates = [...new Set(texts.flatMap(text => names.get(text) ?? []))].filter(node => !typePosition(ts, node))
      resolveAll(candidates)
      const referring = await Promise.all(candidates.map(node => refersTo(node, declaration)))
      return candidates.filter((_, position) => referring[position]).map(node => useAt(ts, node))
    })()
    uses.set(declaration, found)
    return found
  }
  /** Whether a dynamic import's module object is used as a whole, through its binding or by being handed on. */
  const dynamicEscapes = async ({ binding }: DynamicImport): Promise<boolean> => {
    if (binding === undefined) return true
    const bound = await symbolOf(binding)
    const references = indexed().names.get(binding.text) ?? []
    resolveAll(references)
    for (const node of references) {
      const symbol = await symbolOf(node)
      if (bound !== undefined && symbol !== undefined && checker.same(symbol, bound) && objectUse(ts, node)) return true
    }
    return false
  }
  /** The module an imported name holds as an object: a namespace import, or a re-exported namespace. */
  const moduleOf = async (node: Identifier): Promise<CheckerSymbol | undefined> => {
    const symbol = await symbolOf(node)
    const module = symbol === undefined ? undefined : await checker.aliased(symbol)
    return module !== undefined && checker.module(module) ? module : undefined
  }
  const loadedModule = async (entry: DynamicImport): Promise<CheckerSymbol | undefined> => {
    const [argument] = entry.call.arguments
    const [module] = argument === undefined ? [] : await checker.symbolsAt([argument])
    return module !== undefined && await dynamicEscapes(entry) ? module : undefined
  }
  /** The modules the sources use as a whole: through an imported module object, or a dynamic import. */
  const escapedModules = async (): Promise<CheckerSymbol[]> => {
    const { names, imported, dynamic } = indexed()
    const importedNames = [...imported].flatMap(text => names.get(text) ?? []).filter(node => objectUse(ts, node))
    resolveAll(importedNames)
    const found = await Promise.all([...importedNames.map(moduleOf), ...dynamic.map(loadedModule)])
    const modules: CheckerSymbol[] = []
    for (const module of found) {
      if (module !== undefined && !modules.some(known => checker.same(known, module))) modules.push(module)
    }
    return modules
  }
  let reachable: Promise<Set<Node>> | undefined
  /** The declarations a module object used as a whole holds, which code the scan cannot follow can change. */
  const escapedExports = (): Promise<Set<Node>> => {
    reachable ??= (async () => {
      const exports = (await Promise.all((await escapedModules()).map(module => checker.exportsOf(module)))).flat()
      const declarations = await Promise.all(exports.map(async symbol => checker.declaration(await checker.aliased(symbol))))
      return new Set(declarations.filter(declaration => declaration !== undefined))
    })()
    return reachable
  }
  const script = (): boolean => options.fileAlone && sources.some(source => scriptFile(ts, source, indexed().names))
  /** Whether code the scan does not see can reach the variable. */
  const leaves = async (declaration: Node): Promise<boolean> => {
    if (!options.fileAlone) return (await escapedExports()).has(declaration)
    return exported(ts, declaration) || (topLevel(ts, declaration) && script())
  }
  const readChanges = async (use: Use): Promise<boolean> => use.kind !== 'read' || !await checker.primitiveAt(use.value)
  const changes = async (use: Use, path: readonly string[], reference: Node): Promise<boolean> => {
    if (use.reference === reference || !startsWith(path, use.path)) return false
    return use.kind === 'export' ? options.fileAlone : readChanges(use)
  }
  const settingAt = async (settings: Settings, use: Use, path: readonly string[], keys: readonly string[]): Promise<void> => {
    const effect = settingEffect(use, path, keys)
    if (effect.kind === 'assigns') settings.assigned.set(effect.key, [...settings.assigned.get(effect.key) ?? [], effect.value])
    else if (effect.kind === 'changes') settings.changed ||= await readChanges(use)
  }
  return {
    async unchanged(declaration, path, reference) {
      if (await leaves(declaration)) return false
      for (const use of await usesOf(declaration)) if (await changes(use, path, reference)) return false
      return true
    },
    async reassigned(declaration) {
      if (options.fileAlone && topLevel(ts, declaration) && script()) return true
      return (await usesOf(declaration)).some(use => use.kind === 'write' && use.path.length === 0)
    },
    async settings(declaration, path, keys) {
      const settings: Settings = { assigned: new Map(), changed: await leaves(declaration) }
      for (const use of await usesOf(declaration)) await settingAt(settings, use, path, keys)
      return settings
    },
    defaultImports: module => indexed().defaults.get(module) ?? [],
    references: async declaration => (await usesOf(declaration)).map(use => use.reference),
    named: text => indexed().names.get(text) ?? [],
    fileAlone: options.fileAlone,
  }
}
