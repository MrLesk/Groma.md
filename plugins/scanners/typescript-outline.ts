import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { CodeDeclaration, CodeFile, CodeFunction, CodeSymbol, CodeType, CodeVisibility, SourceReference } from '@groma/scanner'

/*
 * The source outline of the TypeScript-family scanners. The TypeScript scanner outlines the source files of its
 * native SDK's project snapshot; the framework and JavaScript scanners parse each file alone with the classic
 * `typescript` module they pin and bundle. Kind numbers differ between the compilers, so every kind is looked up by
 * name in the SyntaxKind the caller passes; a scanner must pass the compiler that parsed its nodes. Visibility comes
 * from the modifiers written in the source; documentation tags such as JSDoc `@private` do not change it.
 */

type KindName =
  | 'Identifier' | 'PrivateIdentifier' | 'StringLiteral' | 'NumericLiteral'
  | 'FunctionDeclaration' | 'ArrowFunction' | 'FunctionExpression' | 'VariableStatement'
  | 'ClassDeclaration' | 'ClassExpression' | 'InterfaceDeclaration' | 'EnumDeclaration' | 'Constructor' | 'MethodDeclaration' | 'MethodSignature'
  | 'ModuleDeclaration' | 'ModuleBlock' | 'ExportAssignment' | 'ExportDeclaration' | 'NamedExports'
  | 'ExportKeyword' | 'PrivateKeyword' | 'ProtectedKeyword'

/** The syntax kinds of the compiler that parsed the source. */
interface OutlineSyntax {
  SyntaxKind: Readonly<Record<KindName, number>>
}

type Kinds = OutlineSyntax['SyntaxKind']

/** A classic compiler, which parses each file's text alone. */
interface OutlineCompiler extends OutlineSyntax {
  ScriptTarget: { Latest: number }
  createSourceFile(fileName: string, text: string, target: number, setParentNodes: boolean): SourceFile
}

interface Node {
  readonly kind: number
  readonly modifiers?: readonly Node[]
  getStart(): number
}
interface Text extends Node { readonly text: string }
interface Named extends Node { readonly name?: Node }
interface ClassLike extends Named { readonly members: readonly Node[] }
interface VariableStatement extends Node {
  readonly declarationList: { readonly declarations: readonly (Named & { readonly initializer?: Node })[] }
}
interface ModuleDeclaration extends Node { readonly body?: Node }
interface Statements extends Node { readonly statements: readonly Node[] }
interface ExportAssignment extends Node { readonly expression: Node }
interface ExportDeclaration extends Node { readonly moduleSpecifier?: Node; readonly exportClause?: Node }
interface NamedExports extends Node { readonly elements: readonly { readonly name: Text; readonly propertyName?: Text }[] }
interface SourceFile extends Statements { getLineAndCharacterOfPosition(position: number): { line: number } }

function is<T extends Node>(node: Node | undefined, kind: number): node is T {
  return node !== undefined && node.kind === kind
}

/** What the caller knows about a source beyond its syntax. */
interface OutlineContext {
  /** Symbols the Code reference names. */
  symbols: readonly string[]
  /** Local names the source publishes outside an export list, such as a CommonJS `module.exports`. */
  exported?: readonly string[]
  /** Nothing in the source can be imported, as in a Vue `<script setup>` block. */
  topLevelPrivate?: boolean
}

interface OutlineBlock extends OutlineContext {
  /** Name whose extension selects the dialect, such as `.ts` or `.tsx`. */
  fileName: string
  text: string
}

interface OutlineScope {
  k: Kinds
  source: SourceFile
  symbols: readonly string[]
  /** Local names this scope's export lists make public. */
  exported: ReadonlySet<string>
  topLevelPrivate: boolean
}

const NO_EXPORTS: ReadonlySet<string> = new Set()

function hasModifier(node: Node, kind: number): boolean {
  return node.modifiers?.some(modifier => modifier.kind === kind) ?? false
}

/** Local names a same-file `export { name }` list, `export default name` or `export = name` publishes; re-exports name other files. */
function listedExports(k: Kinds, statement: Node): string[] {
  if (is<ExportAssignment>(statement, k.ExportAssignment)) {
    return is<Text>(statement.expression, k.Identifier) ? [statement.expression.text] : []
  }
  if (!is<ExportDeclaration>(statement, k.ExportDeclaration) || statement.moduleSpecifier !== undefined) return []
  const clause = statement.exportClause
  if (!is<NamedExports>(clause, k.NamedExports)) return []
  return clause.elements.map(element => (element.propertyName ?? element.name).text)
}

function topLevelVisibility(scope: OutlineScope, name: string, statement: Node): CodeVisibility {
  if (scope.topLevelPrivate) return 'private'
  return hasModifier(statement, scope.k.ExportKeyword) || scope.exported.has(name) ? 'public' : 'private'
}

function memberVisibility(scope: OutlineScope, member: Named): CodeVisibility {
  const { k } = scope
  if (is(member.name, k.PrivateIdentifier) || hasModifier(member, k.PrivateKeyword)) return 'private'
  return hasModifier(member, k.ProtectedKeyword) ? 'protected' : 'public'
}

function symbolAt(scope: OutlineScope, name: string, node: Node, visibility: CodeVisibility): CodeSymbol {
  const line = scope.source.getLineAndCharacterOfPosition(node.getStart()).line + 1
  return { name, line, visibility, entry: scope.symbols.includes(name) }
}

function functionDeclarations(scope: OutlineScope, statement: Node): CodeFunction[] {
  const { k } = scope
  if (is<Named>(statement, k.FunctionDeclaration) && is<Text>(statement.name, k.Identifier)) {
    const name = statement.name.text
    return [{ kind: 'function', ...symbolAt(scope, name, statement.name, topLevelVisibility(scope, name, statement)) }]
  }
  if (!is<VariableStatement>(statement, k.VariableStatement)) return []
  // Only a function literal bound directly to the name; wrapped values such as memo(...) are not functions here.
  return statement.declarationList.declarations.flatMap((declaration): CodeFunction[] => {
    const { name, initializer } = declaration
    if (!is<Text>(name, k.Identifier)) return []
    if (!is(initializer, k.ArrowFunction) && !is(initializer, k.FunctionExpression)) return []
    return [{ kind: 'function', ...symbolAt(scope, name.text, name, topLevelVisibility(scope, name.text, statement)) }]
  })
}

/** The name a method is declared with: an identifier, a `#name`, or a string or number literal such as `"save"`. */
function memberName(scope: OutlineScope, name: Node | undefined): Text | undefined {
  const { k } = scope
  if (is<Text>(name, k.Identifier) || is<Text>(name, k.PrivateIdentifier)) return name
  return is<Text>(name, k.StringLiteral) || is<Text>(name, k.NumericLiteral) ? name : undefined
}

/** Constructors, methods and interface method signatures, each overload separately. */
function typeMember(scope: OutlineScope, member: Node): CodeSymbol[] {
  const { k } = scope
  if (member.kind === k.Constructor) return [symbolAt(scope, 'constructor', member, memberVisibility(scope, member))]
  if (!is<Named>(member, k.MethodDeclaration) && !is<Named>(member, k.MethodSignature)) return []
  const name = memberName(scope, member.name)
  return name === undefined ? [] : [symbolAt(scope, name.text, name, memberVisibility(scope, member))]
}

/** The members of a class or interface, none for an enum, and undefined for a statement that is not a type. */
function typeMembers(k: Kinds, statement: Node): readonly Node[] | undefined {
  if (is<ClassLike>(statement, k.ClassDeclaration) || is<ClassLike>(statement, k.ClassExpression)
    || is<ClassLike>(statement, k.InterfaceDeclaration)) return statement.members
  return statement.kind === k.EnumDeclaration ? [] : undefined
}

/** Classes, interfaces and enums; type aliases are not types in the outline. */
function typeDeclaration(scope: OutlineScope, statement: Named): CodeType[] {
  const members = typeMembers(scope.k, statement)
  const { name } = statement
  if (members === undefined || !is<Text>(name, scope.k.Identifier)) return []
  return [{
    kind: 'type',
    ...symbolAt(scope, name.text, name, topLevelVisibility(scope, name.text, statement)),
    members: members.flatMap(member => typeMember(scope, member)),
  }]
}

/** A namespace or module block is transparent: its declarations are top-level too. */
function moduleStatements(k: Kinds, statement: ModuleDeclaration): readonly Node[] {
  let body = statement.body
  while (is<ModuleDeclaration>(body, k.ModuleDeclaration)) body = body.body
  return is<Statements>(body, k.ModuleBlock) ? body.statements : []
}

function declarationsIn(scope: OutlineScope, statements: readonly Node[]): CodeDeclaration[] {
  return statements.flatMap((statement): CodeDeclaration[] => {
    if (is<ModuleDeclaration>(statement, scope.k.ModuleDeclaration)) {
      return declarationsIn({ ...scope, exported: NO_EXPORTS }, moduleStatements(scope.k, statement))
    }
    return [...functionDeclarations(scope, statement), ...typeDeclaration(scope, statement)]
  })
}

/** The local names a source publishes through its own export lists, `export default name` or `export = name`. */
export function listedExportNames(ts: OutlineSyntax, source: Statements): Set<string> {
  return new Set(source.statements.flatMap(statement => listedExports(ts.SyntaxKind, statement)))
}

/** Outline one parsed source in source order. */
export function outlineSource(ts: OutlineSyntax, source: SourceFile, context: OutlineContext): CodeDeclaration[] {
  const k = ts.SyntaxKind
  const exported = new Set([...listedExportNames(ts, source), ...context.exported ?? []])
  const scope = { k, source, symbols: context.symbols, exported, topLevelPrivate: context.topLevelPrivate ?? false }
  return declarationsIn(scope, source.statements)
}

/** A JavaScript module may publish a named class expression directly through CommonJS. */
export function outlineClassExpression(ts: OutlineSyntax, source: SourceFile, value: Node, context: OutlineContext): CodeType[] {
  if (value.kind !== ts.SyntaxKind.ClassExpression) return []
  const scope = { k: ts.SyntaxKind, source, symbols: context.symbols,
    exported: new Set(context.exported ?? []), topLevelPrivate: context.topLevelPrivate ?? false }
  return typeDeclaration(scope, value)
}

/** Outline one block of source text by parsing it alone. */
export function outlineDeclarations(ts: OutlineCompiler, block: OutlineBlock): CodeDeclaration[] {
  return outlineSource(ts, ts.createSourceFile(block.fileName, block.text, ts.ScriptTarget.Latest, true), block)
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
