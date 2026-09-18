import ts from 'typescript'

export interface TopLevelDeclaration {
  name: string
  kind: 'function' | 'class'
}

function isFunctionValue(node: ts.Node | undefined): boolean {
  return node !== undefined && (ts.isArrowFunction(node) || ts.isFunctionExpression(node))
}

/** The declarations the source outline lists: functions, function literals bound to a name, and classes. */
export function topLevelDeclarations(source: ts.SourceFile): TopLevelDeclaration[] {
  return source.statements.flatMap((statement): TopLevelDeclaration[] => {
    if (ts.isFunctionDeclaration(statement)) return statement.name ? [{ name: statement.name.text, kind: 'function' }] : []
    if (ts.isClassDeclaration(statement)) return statement.name ? [{ name: statement.name.text, kind: 'class' }] : []
    if (!ts.isVariableStatement(statement)) return []
    return statement.declarationList.declarations.flatMap(declaration =>
      ts.isIdentifier(declaration.name) && isFunctionValue(declaration.initializer)
        ? [{ name: declaration.name.text, kind: 'function' as const }] : [])
  })
}
