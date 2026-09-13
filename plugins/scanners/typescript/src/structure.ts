import path from 'node:path'

import { API } from 'typescript/unstable/async'
import {
  isArrowFunction,
  isClassDeclaration,
  isFunctionDeclaration,
  isFunctionExpression,
  isIdentifier,
  isMethodDeclaration,
  isPrivateIdentifier,
  isVariableStatement,
  ModifierFlags,
  type ClassElement,
  type SourceFile,
} from 'typescript/unstable/ast'

import type { CodeCallable, CodeClass, CodeMember, CodeDeclaration, CodeFile, SourceReference } from '@groma/scanner'

type MemberScope = CodeMember['scope']

function isExported(modifierFlags: ModifierFlags): boolean {
  return (modifierFlags & ModifierFlags.Export) !== 0
}

function lineAt(source: SourceFile, position: number): number {
  return source.getLineAndCharacterOfPosition(position).line + 1
}

function callableAt(
  source: SourceFile,
  name: string,
  position: number,
  modifierFlags: ModifierFlags,
  symbols: readonly string[],
): CodeCallable {
  return {
    kind: 'function',
    name,
    line: lineAt(source, position),
    scope: isExported(modifierFlags) ? 'export' : 'internal',
    entry: symbols.includes(name),
  }
}

function functionDeclaration(
  source: SourceFile,
  statement: SourceFile['statements'][number],
  symbols: readonly string[],
): CodeCallable | undefined {
  if (!isFunctionDeclaration(statement) || statement.name === undefined) return undefined
  return callableAt(source, statement.name.text, statement.name.getStart(source), statement.modifierFlags, symbols)
}

function variableDeclarations(
  source: SourceFile,
  statement: SourceFile['statements'][number],
  symbols: readonly string[],
): CodeCallable[] {
  if (!isVariableStatement(statement)) return []
  return statement.declarationList.declarations.flatMap(declaration => {
    const initializer = declaration.initializer
    if (!isIdentifier(declaration.name) || initializer === undefined) return []
    if (!isArrowFunction(initializer) && !isFunctionExpression(initializer)) return []
    return [callableAt(
      source,
      declaration.name.text,
      declaration.name.getStart(source),
      statement.modifierFlags,
      symbols,
    )]
  })
}

function memberScope(nameIsPrivate: boolean, modifierFlags: ModifierFlags): MemberScope {
  if (nameIsPrivate || (modifierFlags & ModifierFlags.Private) !== 0) return 'private'
  return (modifierFlags & ModifierFlags.Protected) !== 0 ? 'protected' : 'public'
}

function classMember(
  source: SourceFile,
  member: ClassElement,
  symbols: readonly string[],
): CodeMember | undefined {
  if (!isMethodDeclaration(member)) return undefined
  if (!isIdentifier(member.name) && !isPrivateIdentifier(member.name)) return undefined
  const name = member.name.text
  return {
    name,
    line: lineAt(source, member.name.getStart(source)),
    scope: memberScope(isPrivateIdentifier(member.name), member.modifierFlags),
    entry: symbols.includes(name),
  }
}

function classDeclaration(
  source: SourceFile,
  statement: SourceFile['statements'][number],
  symbols: readonly string[],
): CodeClass | undefined {
  if (!isClassDeclaration(statement) || statement.name === undefined) return undefined
  return {
    kind: 'class',
    name: statement.name.text,
    line: lineAt(source, statement.name.getStart(source)),
    scope: isExported(statement.modifierFlags) ? 'export' : 'internal',
    entry: symbols.includes(statement.name.text),
    members: statement.members.flatMap(member => {
      const found = classMember(source, member, symbols)
      return found === undefined ? [] : [found]
    }),
  }
}

function declarationsIn(source: SourceFile, symbols: readonly string[]): CodeDeclaration[] {
  return source.statements.flatMap((statement): CodeDeclaration[] => {
    const callable = functionDeclaration(source, statement, symbols)
    if (callable !== undefined) return [callable]
    const variables = variableDeclarations(source, statement, symbols)
    if (variables.length > 0) return variables
    const declaration = classDeclaration(source, statement, symbols)
    return declaration === undefined ? [] : [declaration]
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
      const declarations = declarationsIn(source, reference.symbols)
      if (declarations.length > 0) files.push({ file: reference.file, declarations })
    }
    return files
  } finally {
    await api.close()
  }
}

