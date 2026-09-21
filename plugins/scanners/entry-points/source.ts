import path from 'node:path'
import type { Checker } from '../http-checker.ts'
import type { Node, SourceFile } from '../http-syntax.ts'
import { heldAt, importOrigin, literalText, objectEntries, runtimeGlobal, urlContext, urlParts,
  type UrlCompiler } from '../http-values.ts'
import type { SourceEntry } from './javascript.ts'

interface EntryCompiler extends UrlCompiler {
  SyntaxKind: UrlCompiler['SyntaxKind'] & { TrueKeyword: number }
  isNewExpression(node: Node): node is Node & { expression: Node; arguments?: readonly Node[] }
}
type EntryContext = ReturnType<typeof urlContext<EntryCompiler>>
export interface EntrySources { imports: Map<string, string[]>; entries: SourceEntry[] }

const relative = (root: string, file: string) => path.relative(root, path.resolve(root, file)).split(path.sep).join('/')

async function text(context: EntryContext, node: Node | undefined): Promise<string | undefined> {
  if (!node) return undefined
  const parts = await urlParts(context, node)
  return parts.every(part => part.kind === 'text') ? parts.map(part => part.kind === 'text' ? part.text : '').join('') : undefined
}

/** Literal paths and node:url's fileURLToPath(new URL(path, import.meta.url)). */
async function entryPath(root: string, context: EntryContext, node: Node): Promise<string | undefined> {
  const { ts } = context
  const direct = await text(context, node)
  if (direct !== undefined) return relative(root, direct)
  if (!ts.isCallExpression(node)) return undefined
  const origin = await importOrigin(context, node.expression)
  if (origin?.name !== 'fileURLToPath' || !['node:url', 'url'].includes(origin.module)) return undefined
  const url = node.arguments[0]
  if (!url || !ts.isNewExpression(url) || !ts.isIdentifier(url.expression) || url.expression.text !== 'URL'
    || !await runtimeGlobal(context, url.expression)) return undefined
  const base = url.arguments?.[1]
  if (!base || !ts.isPropertyAccessExpression(base) || base.name.text !== 'url' || !ts.isMetaProperty(base.expression)) return undefined
  const value = await text(context, url.arguments?.[0])
  return value === undefined ? undefined : relative(root, path.resolve(root, path.dirname(node.getSourceFile().fileName), value))
}

async function buildEntries(root: string, context: EntryContext, call: Node & { expression: Node; arguments: readonly Node[] }): Promise<SourceEntry[]> {
  const { ts } = context
  const callee = call.expression
  if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== 'build'
    || !ts.isIdentifier(callee.expression) || callee.expression.text !== 'Bun'
    || !await runtimeGlobal(context, callee.expression)) return []
  const fields = await objectEntries(context, call.arguments[0])
  if (!fields) return []
  const compile = fields.get('compile'), entrypoints = fields.get('entrypoints')
  const executable = compile && await heldAt(context, compile)
  const native = typeof executable === 'object' && (executable.node.kind === ts.SyntaxKind.TrueKeyword || ts.isObjectLiteralExpression(executable.node))
  if (!native && await literalText(context, fields.get('target')) !== 'browser') return []
  const array = entrypoints && await heldAt(context, entrypoints)
  if (typeof array !== 'object' || !ts.isArrayLiteralExpression(array.node)) return []
  const declaration = relative(root, call.getSourceFile().fileName)
  const files = await Promise.all(array.node.elements.map(node => entryPath(root, context, node)))
  return files.flatMap(file => file === undefined ? [] : [{ file, declaration, name: path.posix.basename(file).replace(/\.[^.]+$/, '') }])
}

/** The same build-expression reader runs over the native SDK and each framework's existing compiler. */
export async function sourceBuildEntries(root: string, ts: EntryCompiler, checker: Checker, sources: readonly SourceFile[]): Promise<SourceEntry[]> {
  const context = urlContext(ts, checker, sources)
  const calls: Array<Node & { expression: Node; arguments: readonly Node[] }> = []
  const visit = (node: Node): void => {
    if (ts.isCallExpression(node)) calls.push(node)
    ts.forEachChild(node, visit)
  }
  for (const source of sources) visit(source)
  return (await Promise.all(calls.map(call => buildEntries(root, context, call)))).flat()
}

/** Compiler-resolved local modules, not inferred architecture dependencies. */
export async function entrySourceInputs(root: string, ts: EntryCompiler, checker: Checker, sources: readonly SourceFile[]): Promise<EntrySources> {
  const selected = new Set(sources.map(source => relative(root, source.fileName)))
  const imports = new Map<string, string[]>()
  for (const source of sources) {
    const literals: Node[] = []
    const visit = (node: Node): void => {
      if (ts.isStringLiteral(node)) literals.push(node)
      ts.forEachChild(node, visit)
    }
    visit(source)
    const symbols = await checker.symbolsAt(literals)
    const declarations = await Promise.all(symbols.flatMap(symbol => symbol && checker.module(symbol) ? [checker.declaration(symbol)] : []))
    imports.set(relative(root, source.fileName), [...new Set(declarations.flatMap(declaration => {
      const file = declaration && relative(root, declaration.getSourceFile().fileName)
      return file && selected.has(file) ? [file] : []
    }))])
  }
  return { imports, entries: await sourceBuildEntries(root, ts, checker, sources) }
}
