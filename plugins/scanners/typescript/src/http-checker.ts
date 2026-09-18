import * as ast from 'typescript/unstable/ast'
import { SymbolFlags, TypeFlags, type Checker as NativeChecker, type Symbol as NativeSymbol, type Type } from 'typescript/unstable/async'

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
  return {
    symbolsAt: nodes => checker.getSymbolAtLocation(nodes.map(native)),
    shorthandValue: property => checker.getShorthandAssignmentValueSymbol(native(property)),
    aliased: async handle => symbol(handle).flags & SymbolFlags.Alias ? checker.getAliasedSymbol(symbol(handle)) : handle,
    module: handle => (symbol(handle).flags & SymbolFlags.ValueModule) !== 0,
    declaration: async handle => (symbol(handle).valueDeclaration ?? symbol(handle).declarations[0])?.resolve(),
    declarationCount: handle => symbol(handle).declarations.length,
    exportsOf: async handle => [...await checker.getExportsOfModule(symbol(handle))],
    primitiveAt: async node => primitive(await checker.getTypeAtLocation(native(node))),
    same: (left, right) => symbol(left).id === symbol(right).id,
  }
}
