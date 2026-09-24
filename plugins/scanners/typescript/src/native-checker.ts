import * as ast from 'typescript/unstable/ast'
import {
  SymbolFlags, TypeFlags, type Checker as NativeChecker, type NodeHandle, type Symbol as NativeSymbol, type Type,
} from 'typescript/unstable/async'

import type { Checker } from '../../http-checker.ts'
import type { RouterCompiler } from '../../http-routers.ts'
import type { Node } from '../../http-syntax.ts'
import type { UrlCompiler } from '../../http-values.ts'

/*
 * The native SDK's answers to the shared HTTP readers: its syntax, which has the classic compiler's node
 * shapes under a few other names, and its asynchronous checker.
 */

export const syntax: UrlCompiler & RouterCompiler = {
  ...ast,
  isTypeAssertionExpression: ast.isTypeAssertion,
  isParameter: ast.isParameterDeclaration,
  isFunctionLike: ast.isFunctionLikeDeclaration,
  isClassLike: ast.isClassLikeDeclaration,
  // A program scan never asks whether a file is a script.
  isExternalModule: () => true,
  forEachChild: (node, visit) => { native(node).forEachChild(child => { visit(child) }) },
}

function native(node: Node): ast.Node {
  return node as unknown as ast.Node
}

/**
 * A declaration in source. A declaration file states types, never a value the scanner follows, and
 * resolving a handle transfers its whole file from the compiler process: a standard library file is megabytes.
 */
export function sourceDeclaration(handle: NodeHandle | undefined): Promise<ast.Node | undefined> {
  return handle === undefined || /\.d\.[cm]?ts$/.test(handle.path) ? Promise.resolve(undefined) : handle.resolve()
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

export function nativeChecker(checker: NativeChecker): Checker {
  const symbol = (handle: object) => handle as NativeSymbol
  // The readers ask about the same symbols many times; each answer crosses the process boundary once.
  const aliases = new Map<number, Promise<object>>()
  const declarations = new Map<number, Promise<ast.Node | undefined>>()
  function once<T>(answers: Map<number, Promise<T>>, handle: object, answer: () => Promise<T>): Promise<T> {
    let found = answers.get(symbol(handle).id)
    if (found === undefined) {
      found = answer()
      answers.set(symbol(handle).id, found)
    }
    return found
  }
  return {
    symbolsAt: nodes => checker.getSymbolAtLocation(nodes.map(native)),
    shorthandValue: property => checker.getShorthandAssignmentValueSymbol(native(property)),
    aliased: handle => once(aliases, handle, async () =>
      symbol(handle).flags & SymbolFlags.Alias ? checker.getAliasedSymbol(symbol(handle)) : handle),
    module: handle => (symbol(handle).flags & SymbolFlags.ValueModule) !== 0,
    declaration: handle => once(declarations, handle, () =>
      sourceDeclaration(symbol(handle).valueDeclaration ?? symbol(handle).declarations[0])),
    declarationCount: handle => symbol(handle).declarations.length,
    exportsOf: async handle => [...await checker.getExportsOfModule(symbol(handle))],
    primitiveAt: async node => primitive(await checker.getTypeAtLocation(native(node))),
    same: (left, right) => symbol(left).id === symbol(right).id,
  }
}
