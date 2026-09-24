import type { Node } from './http-syntax.ts'

/*
 * The questions the shared HTTP readers ask a compiler's checker. The classic compiler answers them at
 * once and the TypeScript scanner's native SDK asynchronously, so every reader awaits them; each
 * compiler answers in one small adapter, the classic one below.
 */

/** A symbol, which only the checker that returned it reads. */
export type CheckerSymbol = object

export interface Checker {
  /** The symbols the names stand for, asked together. */
  symbolsAt(nodes: readonly Node[]): Promise<(CheckerSymbol | undefined)[]>
  /** The variable a shorthand property `{ name }` reads. */
  shorthandValue(property: Node): Promise<CheckerSymbol | undefined>
  /** What an import or export alias stands for; any other symbol stands for itself. */
  aliased(symbol: CheckerSymbol): Promise<CheckerSymbol>
  /** Whether the symbol is a module, as a namespace import or a dynamic import holds one. */
  module(symbol: CheckerSymbol): boolean
  /**
   * The symbol's value declaration, else its first declaration. A declaration file states no value, so an adapter
   * may answer nothing for one; readers treat both answers as a value they cannot see.
   */
  declaration(symbol: CheckerSymbol): Promise<Node | undefined>
  declarationCount(symbol: CheckerSymbol): number
  exportsOf(module: CheckerSymbol): Promise<CheckerSymbol[]>
  /** Whether an expression's value is primitive, so nothing can change what it holds through it. */
  primitiveAt(node: Node): Promise<boolean>
  same(left: CheckerSymbol, right: CheckerSymbol): boolean
}

/**
 * Ask about each item concurrently, in bounded batches, with the answers in the items' order. A compiler behind a
 * process boundary answers many questions at once far faster than one at a time.
 */
export async function inBatches<Item, Answer>(items: readonly Item[], ask: (item: Item) => Promise<Answer>): Promise<Answer[]> {
  const answers: Answer[] = []
  for (let offset = 0; offset < items.length; offset += 256) answers.push(...await Promise.all(items.slice(offset, offset + 256).map(ask)))
  return answers
}

interface ClassicSymbol { flags: number; valueDeclaration?: Node; declarations?: readonly Node[] }
interface ClassicType { flags: number; isUnion(): boolean; types?: readonly ClassicType[] }

/** The part of the classic compiler the adapter reads; each scanner passes the version it bundles. */
export interface ClassicCompiler {
  SymbolFlags: { Alias: number; ValueModule: number }
  TypeFlags: {
    StringLike: number; NumberLike: number; BigIntLike: number; BooleanLike: number; EnumLike: number
    ESSymbolLike: number; VoidLike: number; Null: number
  }
}

export interface ClassicChecker {
  getSymbolAtLocation(node: Node): ClassicSymbol | undefined
  getShorthandAssignmentValueSymbol(node: Node | undefined): ClassicSymbol | undefined
  getAliasedSymbol(symbol: ClassicSymbol): ClassicSymbol
  getExportsOfModule(module: ClassicSymbol): ClassicSymbol[]
  getTypeAtLocation(node: Node): ClassicType
}

function primitive(ts: ClassicCompiler, type: ClassicType): boolean {
  if (type.isUnion()) return (type.types ?? []).every(member => primitive(ts, member))
  const flags = ts.TypeFlags
  const mask = flags.StringLike | flags.NumberLike | flags.BigIntLike | flags.BooleanLike | flags.EnumLike
    | flags.ESSymbolLike | flags.VoidLike | flags.Null
  return (type.flags & mask) !== 0
}

/** The classic compiler's answers, which it has at once. */
export function classicChecker(ts: ClassicCompiler, checker: ClassicChecker): Checker {
  const symbol = (handle: CheckerSymbol) => handle as ClassicSymbol
  return {
    symbolsAt: async nodes => nodes.map(node => checker.getSymbolAtLocation(node)),
    shorthandValue: async property => checker.getShorthandAssignmentValueSymbol(property),
    aliased: async handle => symbol(handle).flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol(handle)) : handle,
    module: handle => (symbol(handle).flags & ts.SymbolFlags.ValueModule) !== 0,
    declaration: async handle => symbol(handle).valueDeclaration ?? symbol(handle).declarations?.[0],
    declarationCount: handle => symbol(handle).declarations?.length ?? 0,
    exportsOf: async handle => checker.getExportsOfModule(symbol(handle)),
    primitiveAt: async node => primitive(ts, checker.getTypeAtLocation(node)),
    same: (left, right) => left === right,
  }
}
