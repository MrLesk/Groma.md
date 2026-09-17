import path from 'node:path'

import { API } from 'typescript/unstable/async'
import {
  isArrowFunction,
  isClassDeclaration,
  isConstructorDeclaration,
  isEnumDeclaration,
  isExportAssignment,
  isExportDeclaration,
  isFunctionDeclaration,
  isFunctionExpression,
  isIdentifier,
  isInterfaceDeclaration,
  isMethodDeclaration,
  isMethodSignatureDeclaration,
  isModuleBlock,
  isModuleDeclaration,
  isNamedExports,
  isPrivateIdentifier,
  isVariableStatement,
  ModifierFlags,
  type Node,
  type SourceFile,
  type Statement,
} from 'typescript/unstable/ast'

import type { CodeDeclaration, CodeFile, CodeFunction, CodeSymbol, CodeType, CodeVisibility, SourceReference } from '@groma/scanner'

// The framework scanners apply the same outline rules with a classic compiler in ../../typescript-outline.ts; change both together.

interface OutlineScope {
  source: SourceFile
  /** Symbols the Code reference names. */
  symbols: readonly string[]
  /** Local names this scope's export lists make public. */
  exported: ReadonlySet<string>
}

const NO_EXPORTS: ReadonlySet<string> = new Set()

/** Local names a same-file `export { name }` list or `export default name` publishes; re-exports name other files. */
function listedExports(statement: Statement): string[] {
  if (isExportAssignment(statement)) return isIdentifier(statement.expression) ? [statement.expression.text] : []
  if (!isExportDeclaration(statement) || statement.moduleSpecifier !== undefined) return []
  const clause = statement.exportClause
  if (clause === undefined || !isNamedExports(clause)) return []
  return clause.elements.map(element => (element.propertyName ?? element.name).text)
}

function topLevelVisibility(scope: OutlineScope, name: string, modifierFlags: ModifierFlags): CodeVisibility {
  return (modifierFlags & ModifierFlags.Export) !== 0 || scope.exported.has(name) ? 'public' : 'private'
}

function memberVisibility(nameIsPrivate: boolean, modifierFlags: ModifierFlags): CodeVisibility {
  if (nameIsPrivate || (modifierFlags & ModifierFlags.Private) !== 0) return 'private'
  return (modifierFlags & ModifierFlags.Protected) !== 0 ? 'protected' : 'public'
}

function symbolAt(scope: OutlineScope, name: string, node: Node, visibility: CodeVisibility): CodeSymbol {
  const line = scope.source.getLineAndCharacterOfPosition(node.getStart(scope.source)).line + 1
  return { name, line, visibility, entry: scope.symbols.includes(name) }
}

function functionDeclarations(scope: OutlineScope, statement: Statement): CodeFunction[] {
  if (isFunctionDeclaration(statement) && statement.name !== undefined) {
    const name = statement.name.text
    return [{ kind: 'function', ...symbolAt(scope, name, statement.name, topLevelVisibility(scope, name, statement.modifierFlags)) }]
  }
  if (!isVariableStatement(statement)) return []
  // Only a function literal bound directly to the name; wrapped values such as memo(...) are not functions here.
  return statement.declarationList.declarations.flatMap((declaration): CodeFunction[] => {
    const initializer = declaration.initializer
    if (!isIdentifier(declaration.name) || initializer === undefined) return []
    if (!isArrowFunction(initializer) && !isFunctionExpression(initializer)) return []
    const name = declaration.name.text
    return [{ kind: 'function', ...symbolAt(scope, name, declaration.name, topLevelVisibility(scope, name, statement.modifierFlags)) }]
  })
}

/** Constructors, methods and interface method signatures, each overload separately. */
function typeMember(scope: OutlineScope, member: Node): CodeSymbol[] {
  if (isConstructorDeclaration(member)) {
    return [symbolAt(scope, 'constructor', member, memberVisibility(false, member.modifierFlags))]
  }
  if (!isMethodDeclaration(member) && !isMethodSignatureDeclaration(member)) return []
  if (!isIdentifier(member.name) && !isPrivateIdentifier(member.name)) return []
  const visibility = memberVisibility(isPrivateIdentifier(member.name), member.modifierFlags)
  return [symbolAt(scope, member.name.text, member.name, visibility)]
}

/** Classes, interfaces and enums; type aliases are not types in the outline. */
function typeDeclaration(scope: OutlineScope, statement: Statement): CodeType[] {
  if (!isClassDeclaration(statement) && !isInterfaceDeclaration(statement) && !isEnumDeclaration(statement)) return []
  if (statement.name === undefined) return []
  const name = statement.name.text
  const members: readonly Node[] = isEnumDeclaration(statement) ? [] : statement.members
  return [{
    kind: 'type',
    ...symbolAt(scope, name, statement.name, topLevelVisibility(scope, name, statement.modifierFlags)),
    members: members.flatMap(member => typeMember(scope, member)),
  }]
}

/** A namespace or module block is transparent: its declarations are top-level too. */
function moduleStatements(statement: Statement): readonly Statement[] {
  if (!isModuleDeclaration(statement)) return []
  let body = statement.body
  while (body !== undefined && isModuleDeclaration(body)) body = body.body
  return body !== undefined && isModuleBlock(body) ? body.statements : []
}

function declarationsIn(scope: OutlineScope, statements: readonly Statement[]): CodeDeclaration[] {
  return statements.flatMap((statement): CodeDeclaration[] => {
    if (isModuleDeclaration(statement)) {
      return declarationsIn({ ...scope, exported: NO_EXPORTS }, moduleStatements(statement))
    }
    return [...functionDeclarations(scope, statement), ...typeDeclaration(scope, statement)]
  })
}

export async function readCodeStructure(
  repositoryRoot: string,
  references: readonly SourceReference[],
): Promise<CodeFile[]> {
  if (references.length === 0) return []
  const filenames = references.map(reference => path.join(repositoryRoot, reference.file))
  const api = new API({ cwd: repositoryRoot })
  try {
    const snapshot = await api.updateSnapshot({ openFiles: filenames })
    const files: CodeFile[] = []
    for (const [index, filename] of filenames.entries()) {
      const project = await snapshot.getDefaultProjectForFile(filename)
      const source = await project?.program.getSourceFile(filename)
      if (source === undefined) throw new Error(`TypeScript source not found: ${references[index]?.file}`)
      const reference = references[index]!
      const exported = new Set(source.statements.flatMap(listedExports))
      const declarations = declarationsIn({ source, symbols: reference.symbols, exported }, source.statements)
      if (declarations.length > 0) files.push({ file: reference.file, declarations })
    }
    return files
  } finally {
    await api.close()
  }
}

