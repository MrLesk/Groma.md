import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { CodeDeclaration, CodeFile, CodeFunction, CodeSymbol, CodeType, CodeVisibility, SourceReference } from '@groma/scanner'

/*
 * The TypeScript scanner applies the same outline rules with the native SDK in ./typescript/src/structure.ts;
 * change both together.
 *
 * The classic compiler API this outline calls, named as the compiler names it. The repository's own
 * `typescript` package is the 7.x SDK, which has no classic API to import types from, so each framework
 * scanner passes the `typescript` module it pins and bundles, and its call checks that compiler against these types.
 */
interface Node { getStart(): number }
interface Identifier extends Node { text: string }
interface NamedDeclaration extends Node { name?: Node }
/** A class or interface. */
interface ClassLikeDeclaration extends NamedDeclaration { members: readonly Node[] }
interface MethodDeclaration extends Node { name: Node }
interface VariableDeclaration extends NamedDeclaration { initializer?: Node }
interface VariableStatement extends Node { declarationList: { declarations: readonly VariableDeclaration[] } }
interface ModuleDeclaration extends Node { body?: Node }
interface ModuleBlock extends Node { statements: readonly Node[] }
interface ExportAssignment extends Node { expression: Node }
interface ExportDeclaration extends Node { moduleSpecifier?: Node; exportClause?: Node }
interface NamedExports extends Node { elements: readonly { name: { text: string }; propertyName?: { text: string } }[] }
interface SourceFile extends ModuleBlock { getLineAndCharacterOfPosition(position: number): { line: number } }

export interface OutlineCompiler {
  ScriptTarget: { Latest: number }
  ModifierFlags: { Export: number; Private: number; Protected: number }
  createSourceFile(fileName: string, text: string, target: number, setParentNodes: boolean): SourceFile
  getCombinedModifierFlags(node: Node): number
  isIdentifier(node: Node): node is Identifier
  isPrivateIdentifier(node: Node): node is Identifier
  isFunctionDeclaration(node: Node): node is NamedDeclaration
  isArrowFunction(node: Node): boolean
  isFunctionExpression(node: Node): boolean
  isVariableStatement(node: Node): node is VariableStatement
  isClassDeclaration(node: Node): node is ClassLikeDeclaration
  isInterfaceDeclaration(node: Node): node is ClassLikeDeclaration
  isEnumDeclaration(node: Node): node is NamedDeclaration
  isConstructorDeclaration(node: Node): boolean
  isMethodDeclaration(node: Node): node is MethodDeclaration
  isMethodSignature(node: Node): node is MethodDeclaration
  isModuleDeclaration(node: Node): node is ModuleDeclaration
  isModuleBlock(node: Node): node is ModuleBlock
  isExportAssignment(node: Node): node is ExportAssignment
  isExportDeclaration(node: Node): node is ExportDeclaration
  isNamedExports(node: Node): node is NamedExports
}

interface OutlineScope {
  ts: OutlineCompiler
  source: SourceFile
  /** Symbols the Code reference names. */
  symbols: readonly string[]
  /** Local names this scope's export lists make public. */
  exported: ReadonlySet<string>
  /** The block exports nothing, so no top-level declaration is public. */
  topLevelPrivate: boolean
}

export interface OutlineBlock {
  /** Name whose extension selects the dialect, such as `.ts` or `.tsx`. */
  fileName: string
  text: string
  symbols: readonly string[]
  /** Nothing in the block can be imported, as in a Vue `<script setup>` block. */
  topLevelPrivate?: boolean
}

const NO_EXPORTS: ReadonlySet<string> = new Set()

/** Local names a same-file `export { name }` list, `export default name` or `export = name` publishes; re-exports name other files. */
function listedExports(ts: OutlineCompiler, statement: Node): string[] {
  if (ts.isExportAssignment(statement)) return ts.isIdentifier(statement.expression) ? [statement.expression.text] : []
  if (!ts.isExportDeclaration(statement) || statement.moduleSpecifier !== undefined) return []
  const clause = statement.exportClause
  if (clause === undefined || !ts.isNamedExports(clause)) return []
  return clause.elements.map(element => (element.propertyName ?? element.name).text)
}

function topLevelVisibility(scope: OutlineScope, name: string, statement: Node): CodeVisibility {
  if (scope.topLevelPrivate) return 'private'
  const exported = (scope.ts.getCombinedModifierFlags(statement) & scope.ts.ModifierFlags.Export) !== 0
  return exported || scope.exported.has(name) ? 'public' : 'private'
}

function memberVisibility(scope: OutlineScope, member: Node, nameIsPrivate: boolean): CodeVisibility {
  const flags = scope.ts.getCombinedModifierFlags(member)
  if (nameIsPrivate || (flags & scope.ts.ModifierFlags.Private) !== 0) return 'private'
  return (flags & scope.ts.ModifierFlags.Protected) !== 0 ? 'protected' : 'public'
}

function symbolAt(scope: OutlineScope, name: string, node: Node, visibility: CodeVisibility): CodeSymbol {
  const line = scope.source.getLineAndCharacterOfPosition(node.getStart()).line + 1
  return { name, line, visibility, entry: scope.symbols.includes(name) }
}

function functionDeclarations(scope: OutlineScope, statement: Node): CodeFunction[] {
  const { ts } = scope
  if (ts.isFunctionDeclaration(statement) && statement.name !== undefined && ts.isIdentifier(statement.name)) {
    const name = statement.name.text
    return [{ kind: 'function', ...symbolAt(scope, name, statement.name, topLevelVisibility(scope, name, statement)) }]
  }
  if (!ts.isVariableStatement(statement)) return []
  // Only a function literal bound directly to the name; wrapped values such as memo(...) are not functions here.
  return statement.declarationList.declarations.flatMap((declaration): CodeFunction[] => {
    const { name, initializer } = declaration
    if (name === undefined || !ts.isIdentifier(name) || initializer === undefined) return []
    if (!ts.isArrowFunction(initializer) && !ts.isFunctionExpression(initializer)) return []
    return [{ kind: 'function', ...symbolAt(scope, name.text, name, topLevelVisibility(scope, name.text, statement)) }]
  })
}

/** Constructors, methods and interface method signatures, each overload separately. */
function typeMember(scope: OutlineScope, member: Node): CodeSymbol[] {
  const { ts } = scope
  if (ts.isConstructorDeclaration(member)) {
    return [symbolAt(scope, 'constructor', member, memberVisibility(scope, member, false))]
  }
  if (!ts.isMethodDeclaration(member) && !ts.isMethodSignature(member)) return []
  const name = member.name
  if (!ts.isIdentifier(name) && !ts.isPrivateIdentifier(name)) return []
  return [symbolAt(scope, name.text, name, memberVisibility(scope, member, ts.isPrivateIdentifier(name)))]
}

/** Classes, interfaces and enums; type aliases are not types in the outline. */
function typeDeclaration(scope: OutlineScope, statement: Node): CodeType[] {
  const { ts } = scope
  const withMembers = ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement)
  if (!withMembers && !ts.isEnumDeclaration(statement)) return []
  if (statement.name === undefined || !ts.isIdentifier(statement.name)) return []
  const members = withMembers ? statement.members : []
  const name = statement.name.text
  return [{
    kind: 'type',
    ...symbolAt(scope, name, statement.name, topLevelVisibility(scope, name, statement)),
    members: members.flatMap(member => typeMember(scope, member)),
  }]
}

/** A namespace or module block is transparent: its declarations are top-level too. */
function moduleStatements(ts: OutlineCompiler, statement: ModuleDeclaration): readonly Node[] {
  let body = statement.body
  while (body !== undefined && ts.isModuleDeclaration(body)) body = body.body
  return body !== undefined && ts.isModuleBlock(body) ? body.statements : []
}

function declarationsIn(scope: OutlineScope, statements: readonly Node[]): CodeDeclaration[] {
  return statements.flatMap((statement): CodeDeclaration[] => {
    if (scope.ts.isModuleDeclaration(statement)) {
      return declarationsIn({ ...scope, exported: NO_EXPORTS }, moduleStatements(scope.ts, statement))
    }
    return [...functionDeclarations(scope, statement), ...typeDeclaration(scope, statement)]
  })
}

/** Outline one block of source text by parsing it alone. */
export function outlineDeclarations(ts: OutlineCompiler, block: OutlineBlock): CodeDeclaration[] {
  const source = ts.createSourceFile(block.fileName, block.text, ts.ScriptTarget.Latest, true)
  const exported = new Set(source.statements.flatMap(statement => listedExports(ts, statement)))
  const scope = { ts, source, symbols: block.symbols, exported, topLevelPrivate: block.topLevelPrivate ?? false }
  return declarationsIn(scope, source.statements)
}

/** Outline each referenced TypeScript file by parsing its source alone. */
export async function readTypeScriptOutline(
  ts: OutlineCompiler,
  repositoryRoot: string,
  references: readonly SourceReference[],
): Promise<CodeFile[]> {
  const files: CodeFile[] = []
  for (const reference of references) {
    const fileName = path.join(repositoryRoot, reference.file)
    const text = await readFile(fileName, 'utf8')
    const declarations = outlineDeclarations(ts, { fileName, text, symbols: reference.symbols })
    if (declarations.length > 0) files.push({ file: reference.file, declarations })
  }
  return files
}
