import {
  isArrayBindingPattern, isBindingElement, isClassDeclaration, isEnumDeclaration, isFunctionDeclaration, isIdentifier,
  isInterfaceDeclaration, isObjectBindingPattern, isTypeAliasDeclaration, isVariableStatement,
  NodeFlags, SyntaxKind, type Node, type SourceFile, type VariableDeclarationList,
} from 'typescript/unstable/ast'
import type { ScanSymbol } from '@groma/scanner'

import { listedExportNames } from '../../typescript-outline.ts'

const declarationKinds: Partial<Record<SyntaxKind, string>> = {
  [SyntaxKind.FunctionDeclaration]: 'function',
  [SyntaxKind.ClassDeclaration]: 'class',
  [SyntaxKind.InterfaceDeclaration]: 'interface',
  [SyntaxKind.TypeAliasDeclaration]: 'type',
  [SyntaxKind.EnumDeclaration]: 'enum',
}

/** The names a declaration binds, through any destructuring pattern. */
function boundNames(name: Node): string[] {
  if (isIdentifier(name)) return [name.text]
  if (!isObjectBindingPattern(name) && !isArrayBindingPattern(name)) return []
  return name.elements.flatMap(element => isBindingElement(element) && element.name !== undefined ? boundNames(element.name) : [])
}

function variableSymbols(file: string, list: VariableDeclarationList, exported: (name: string) => boolean): ScanSymbol[] {
  const kind = list.flags & NodeFlags.Const ? 'const' : list.flags & NodeFlags.Let ? 'let' : 'var'
  return list.declarations.flatMap(declaration => boundNames(declaration.name)
    .filter(exported).map(name => ({ id: `${file}#${name}`, name, kind })))
}

/** Declarations the file exports, by their own `export` keyword or by the file's export lists. */
export function exportSymbols(file: string, source: SourceFile): ScanSymbol[] {
  const listed = listedExportNames({ SyntaxKind }, source)
  return source.statements.flatMap(statement => {
    if (!isFunctionDeclaration(statement) && !isClassDeclaration(statement)
      && !isInterfaceDeclaration(statement) && !isTypeAliasDeclaration(statement)
      && !isEnumDeclaration(statement) && !isVariableStatement(statement)) return []
    const keyword = statement.modifiers?.some(modifier => modifier.kind === SyntaxKind.ExportKeyword) === true
    const exported = (name: string) => keyword || listed.has(name)
    if (isVariableStatement(statement)) return variableSymbols(file, statement.declarationList, exported)
    if (!statement.name || !exported(statement.name.text)) return []
    const name = statement.name.text
    const kind = declarationKinds[statement.kind]!
    return [{ id: `${file}#${name}`, name, kind }]
  })
}
