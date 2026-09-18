import * as ast from 'typescript/unstable/ast'
import type { Node, SourceFile } from 'typescript/unstable/ast'
import { SymbolFlags, TypeFlags, type Checker, type Symbol as CompilerSymbol, type Type } from 'typescript/unstable/async'

import {
  importedName, indexSources, objectUse, settingEffect, startsWith, typePosition, useAt,
  type DynamicImport, type Index, type IndexCompiler, type Use,
} from '../../http-uses.ts'
import type { RouterCompiler } from '../../http-routers.ts'
import type { SyntaxCompiler } from '../../http-syntax.ts'

/*
 * How the program's sources use each variable, so an HTTP value is folded only while nothing can change
 * it. The rules are those of ../../http-bindings.ts, which the framework scanners run over the classic
 * compiler; this copy asks the native SDK's asynchronous checker. Change both together. The syntax they
 * read is shared in ../../http-uses.ts.
 */

/** The native SDK's syntax, which has the classic compiler's node shapes. */
export const syntax: IndexCompiler & SyntaxCompiler & RouterCompiler = {
  ...ast,
  isTypeAssertionExpression: ast.isTypeAssertion,
  isParameter: ast.isParameterDeclaration,
  isFunctionLike: ast.isFunctionLikeDeclaration,
  isClassLike: ast.isClassLikeDeclaration,
  // A program scan never asks whether a file is a script.
  isExternalModule: () => true,
  forEachChild: (node, visit) => { (node as Node).forEachChild(child => { visit(child) }) },
}

/** What the sources write below a path: plain assignments by property, and whether anything else changes it. */
export interface Settings {
  assigned: Map<string, Node[]>
  changed: boolean
}

export interface Bindings {
  /** True when nothing in the sources can change what this property path of the declared variable holds. */
  unchanged(declaration: Node, path: readonly string[], reference: Node): Promise<boolean>
  /** True when the sources assign the variable itself again. */
  reassigned(declaration: Node): Promise<boolean>
  /** What the sources set on the properties `keys` below `path`, such as a client's `defaults`. */
  settings(declaration: Node, path: readonly string[], keys: readonly string[]): Promise<Settings>
  /** The declarations that import a module's default export in the sources. */
  defaultImports(module: string): Node[]
  /** The names that stand for the variable, directly or through an import, outside types. */
  references(declaration: Node): Promise<Node[]>
}

async function primitive(type: Type): Promise<boolean> {
  if (type.flags & TypeFlags.Union) {
    const members = await (type as Type & { getTypes(): Promise<readonly Type[]> }).getTypes()
    return (await Promise.all(members.map(primitive))).every(Boolean)
  }
  const mask = TypeFlags.StringLike | TypeFlags.NumberLike | TypeFlags.BigIntLike | TypeFlags.BooleanLike
    | TypeFlags.EnumLike | TypeFlags.ESSymbolLike | TypeFlags.VoidLike | TypeFlags.Null
  return (type.flags & mask) !== 0
}

/** The shared index describes these nodes by less of their shape. */
function nodes(found: readonly unknown[] | undefined): Node[] {
  return (found ?? []) as Node[]
}

async function declared(symbol: CompilerSymbol): Promise<Node | undefined> {
  return (symbol.valueDeclaration ?? symbol.declarations[0])?.resolve()
}

/** Resolve the variable uses of the sources once, on the first question about each variable. */
export function bindingUses(checker: Checker, sources: readonly SourceFile[]): Bindings {
  let index: Index | undefined
  const indexed = (): Index => { index ??= indexSources(syntax, sources); return index }
  const uses = new Map<Node, Promise<Use[]>>()
  const symbols = new Map<Node, Promise<CompilerSymbol | undefined>>()
  const shorthand = (node: Node): boolean => ast.isShorthandPropertyAssignment(node.parent) && node.parent.name === node
  /** Resolve names in one request to the checker, and a shorthand property's value one by one. */
  const resolveAll = (names: readonly Node[]): void => {
    const pending = names.filter(node => !symbols.has(node) && !shorthand(node))
    const batch = pending.length === 0 ? Promise.resolve([]) : checker.getSymbolAtLocation(pending)
    for (const [position, node] of pending.entries()) symbols.set(node, batch.then(found => found[position]))
  }
  const symbolOf = (node: Node): Promise<CompilerSymbol | undefined> => {
    let found = symbols.get(node)
    if (found === undefined) {
      found = shorthand(node) ? checker.getShorthandAssignmentValueSymbol(node.parent) : checker.getSymbolAtLocation(node)
      symbols.set(node, found)
    }
    return found
  }
  const target = async (symbol: CompilerSymbol): Promise<CompilerSymbol> => symbol.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
  const refersTo = async (node: Node, declaration: Node): Promise<boolean> => {
    const symbol = await symbolOf(node)
    if (symbol === undefined) return false
    if (await declared(symbol) === declaration && node.parent !== declaration) return true
    if (!(symbol.flags & SymbolFlags.Alias) || importedName(syntax, node)) return false
    return await declared(await target(symbol)) === declaration
  }
  const usesOf = (declaration: Node): Promise<Use[]> => {
    let found = uses.get(declaration)
    if (found !== undefined) return found
    found = (async () => {
      const { names, imported } = indexed()
      const name = 'name' in declaration && declaration.name !== undefined && ast.isIdentifier(declaration.name as Node)
        ? (declaration.name as ast.Identifier).text : undefined
      const texts = name === undefined ? [] : [name, 'default', ...imported]
      const candidates = [...new Set(texts.flatMap(text => nodes(names.get(text))))]
      resolveAll(candidates)
      const referring = await Promise.all(candidates.map(node => typePosition(syntax, node) ? false : refersTo(node, declaration)))
      return candidates.filter((_, position) => referring[position]).map(node => useAt(syntax, node as ast.Identifier))
    })()
    uses.set(declaration, found)
    return found
  }
  const dynamicEscapes = async ({ binding }: DynamicImport): Promise<boolean> => {
    if (binding === undefined) return true
    const [name] = nodes([binding])
    const bound = await symbolOf(name!)
    const references = nodes(indexed().names.get(binding.text))
    resolveAll(references)
    for (const node of references) {
      if (bound !== undefined && (await symbolOf(node))?.id === bound.id && objectUse(syntax, node as ast.Identifier)) return true
    }
    return false
  }
  /** The module an imported name holds as an object: a namespace import, or a re-exported namespace. */
  const moduleOf = async (node: Node): Promise<CompilerSymbol | undefined> => {
    const symbol = await symbolOf(node)
    const module = symbol === undefined ? undefined : await target(symbol)
    return module !== undefined && module.flags & SymbolFlags.ValueModule ? module : undefined
  }
  const loadedModule = async (entry: DynamicImport): Promise<CompilerSymbol | undefined> => {
    const [argument] = nodes(entry.call.arguments.slice(0, 1))
    const module = argument === undefined ? undefined : await checker.getSymbolAtLocation(argument)
    return module !== undefined && await dynamicEscapes(entry) ? module : undefined
  }
  /** The modules the sources use as a whole: through an imported module object, or a dynamic import. */
  const escapedModules = async (): Promise<CompilerSymbol[]> => {
    const { names, imported, dynamic } = indexed()
    const importedNames = [...imported].flatMap(text => nodes(names.get(text))).filter(node => objectUse(syntax, node as ast.Identifier))
    resolveAll(importedNames)
    const found = await Promise.all([...importedNames.map(moduleOf), ...dynamic.map(loadedModule)])
    return [...new Map(found.flatMap(module => module === undefined ? [] : [[module.id, module] as const])).values()]
  }
  let reachable: Promise<Set<Node>> | undefined
  /** The declarations a module object used as a whole holds, which code the scan cannot follow can change. */
  const escapedExports = (): Promise<Set<Node>> => {
    reachable ??= (async () => {
      const modules = await escapedModules()
      const exports = (await Promise.all(modules.map(module => checker.getExportsOfModule(module)))).flat()
      const declarations = await Promise.all(exports.map(async symbol => declared(await target(symbol))))
      return new Set(declarations.filter(declaration => declaration !== undefined))
    })()
    return reachable
  }
  const readChanges = async (use: Use): Promise<boolean> => {
    return use.kind !== 'read' || !await primitive(await checker.getTypeAtLocation(nodes([use.value])[0]!))
  }
  const settingAt = async (settings: Settings, use: Use, path: readonly string[], keys: readonly string[]): Promise<void> => {
    const effect = settingEffect(use, path, keys)
    if (effect.kind === 'assigns') settings.assigned.set(effect.key, [...settings.assigned.get(effect.key) ?? [], ...nodes([effect.value])])
    else if (effect.kind === 'changes') settings.changed ||= await readChanges(use)
  }
  return {
    async unchanged(declaration, path, reference) {
      if ((await escapedExports()).has(declaration)) return false
      for (const use of await usesOf(declaration)) {
        if (use.reference === reference || use.kind === 'export' || !startsWith(path, use.path)) continue
        if (await readChanges(use)) return false
      }
      return true
    },
    async reassigned(declaration) {
      return (await usesOf(declaration)).some(use => use.kind === 'write' && use.path.length === 0)
    },
    async settings(declaration, path, keys) {
      const settings: Settings = { assigned: new Map(), changed: (await escapedExports()).has(declaration) }
      for (const use of await usesOf(declaration)) await settingAt(settings, use, path, keys)
      return settings
    },
    defaultImports: module => nodes(indexed().defaults.get(module)),
    references: async declaration => nodes((await usesOf(declaration)).map(use => use.reference)),
  }
}
