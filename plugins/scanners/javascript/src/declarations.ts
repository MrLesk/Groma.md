import ts from 'typescript'

export interface TopLevelDeclaration {
  name: string
  kind: 'function' | 'class'
}

function isFunctionValue(node: ts.Node | undefined): boolean {
  return node !== undefined && (ts.isArrowFunction(node) || ts.isFunctionExpression(node))
}

function isExportsReference(node: ts.Node): boolean {
  if (ts.isIdentifier(node)) return node.text === 'exports'
  return ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)
    && node.expression.text === 'module' && node.name.text === 'exports'
}

/** The assignment in a top-level chain that actually publishes a CommonJS value. */
export function commonJsExport(statement: ts.Statement): ts.BinaryExpression | undefined {
  if (!ts.isExpressionStatement(statement)) return undefined
  let expression: ts.Expression = statement.expression
  while (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    const { left } = expression
    if (ts.isPropertyAccessExpression(left) && (isExportsReference(left) || isExportsReference(left.expression))) return expression
    expression = expression.right
  }
  return undefined
}

export function assignedValue(expression: ts.Expression): ts.Expression {
  return ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ? assignedValue(expression.right) : expression
}

function exportedClass(statement: ts.Statement): TopLevelDeclaration[] {
  const assignment = commonJsExport(statement)
  const value = assignment && assignedValue(assignment.right)
  return value && ts.isClassExpression(value) && value.name ? [{ name: value.name.text, kind: 'class' }] : []
}

/** The declarations the source outline lists: functions, function literals bound to a name, and classes. */
export function topLevelDeclarations(source: ts.SourceFile): TopLevelDeclaration[] {
  return source.statements.flatMap((statement): TopLevelDeclaration[] => {
    if (ts.isFunctionDeclaration(statement)) return statement.name ? [{ name: statement.name.text, kind: 'function' }] : []
    if (ts.isClassDeclaration(statement)) return statement.name ? [{ name: statement.name.text, kind: 'class' }] : []
    const published = exportedClass(statement)
    if (published.length) return published
    if (!ts.isVariableStatement(statement)) return []
    return statement.declarationList.declarations.flatMap(declaration =>
      ts.isIdentifier(declaration.name) && isFunctionValue(declaration.initializer)
        ? [{ name: declaration.name.text, kind: 'function' as const }] : [])
  })
}
