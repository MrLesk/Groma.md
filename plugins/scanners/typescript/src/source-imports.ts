import path from 'node:path'
import { isStringLiteral, type SourceFile, type Node } from 'typescript/unstable/ast'
import type { Checker } from 'typescript/unstable/async'

export async function resolvedImports(root: string, source: SourceFile, specifiers: string[], checker: Checker): Promise<string[]> {
  const used = new Set(specifiers)
  const nodes: Node[] = []
  function visit(node: Node): void {
    if (isStringLiteral(node) && used.has(node.text)) nodes.push(node)
    node.forEachChild(visit)
  }
  visit(source)
  const symbols = await checker.getSymbolAtLocation(nodes)
  const declarations = await Promise.all(symbols.flatMap(symbol => symbol?.declarations ?? []).map(handle => handle.resolve()))
  const own = path.relative(root, source.fileName).split(path.sep).join('/')
  // `declare module 'x'` beside an import of 'x' augments that module here; a file never imports itself.
  return [...new Set(declarations.flatMap(declaration => declaration
    ? [path.relative(root, declaration.getSourceFile().fileName).split(path.sep).join('/')] : []))]
    .filter(file => file !== own).sort()
}
