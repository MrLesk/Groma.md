import ts from 'typescript'

export interface SourceComponent {
  declaration: ts.ClassDeclaration
  metadata: ts.ObjectLiteralExpression
  selector: string
  template?: string
  styles: string[]
}

/** Recognize the imported Angular API even when its package is not installed. */
export function angularImport(node: ts.Node, checker: ts.TypeChecker, name: string, module = '@angular/core'): boolean {
  const declaration = checker.getSymbolAtLocation(node)?.declarations?.[0]
  if (!declaration || !ts.isImportSpecifier(declaration)) return false
  const imported = declaration.parent.parent.parent
  return ts.isImportDeclaration(imported) && ts.isStringLiteral(imported.moduleSpecifier)
    && imported.moduleSpecifier.text === module && (declaration.propertyName ?? declaration.name).text === name
}

export function property(object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  const properties = object.properties.filter(item => item.name &&
    (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) && item.name.text === name)
  const found = properties.length === 1 ? properties[0] : undefined
  return found && ts.isPropertyAssignment(found) ? found.initializer : undefined
}

function literal(expression: ts.Expression | undefined): string | undefined {
  return expression && ts.isStringLiteralLike(expression) ? expression.text : undefined
}

function componentStyles(metadata: ts.ObjectLiteralExpression): string[] {
  const single = literal(property(metadata, 'styleUrl'))
  const multiple = property(metadata, 'styleUrls')
  return [...(single === undefined ? [] : [single]),
    ...(multiple && ts.isArrayLiteralExpression(multiple) ? multiple.elements.flatMap(item => literal(item) ?? []) : [])]
}

export function sourceComponent(declaration: ts.ClassDeclaration, checker: ts.TypeChecker): SourceComponent | undefined {
  for (const decorator of ts.getDecorators(declaration) ?? []) {
    const call = decorator.expression
    if (!ts.isCallExpression(call) || !angularImport(call.expression, checker, 'Component')) continue
    const metadata = call.arguments[0]
    if (!metadata || !ts.isObjectLiteralExpression(metadata)) continue
    const selector = literal(property(metadata, 'selector'))
    const template = literal(property(metadata, 'templateUrl'))
    if (selector) return { declaration, metadata, selector, template, styles: componentStyles(metadata) }
  }
  return undefined
}

export function componentImports(component: SourceComponent, checker: ts.TypeChecker): Set<ts.Declaration> {
  const imports = property(component.metadata, 'imports')
  const declarations = new Set<ts.Declaration>()
  if (!imports || !ts.isArrayLiteralExpression(imports)) return declarations
  for (const item of imports.elements) {
    let symbol = checker.getSymbolAtLocation(item)
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol)
    if (symbol?.valueDeclaration) declarations.add(symbol.valueDeclaration)
  }
  return declarations
}

function outputAlias(declaration: ts.PropertyDeclaration, checker: ts.TypeChecker): string | undefined {
  const initial = declaration.initializer
  if (initial && ts.isCallExpression(initial) && angularImport(initial.expression, checker, 'output')) {
    const options = initial.arguments[0]
    return options && ts.isObjectLiteralExpression(options) ? literal(property(options, 'alias')) : undefined
  }
  for (const decorator of ts.getDecorators(declaration) ?? []) {
    const call = decorator.expression
    if (ts.isCallExpression(call) && angularImport(call.expression, checker, 'Output')) return literal(call.arguments[0])
  }
  return undefined
}

function isOutput(declaration: ts.PropertyDeclaration, checker: ts.TypeChecker): boolean {
  const initial = declaration.initializer
  if (initial && ts.isCallExpression(initial) && angularImport(initial.expression, checker, 'output')) return true
  return (ts.getDecorators(declaration) ?? []).some(decorator => ts.isCallExpression(decorator.expression)
    && angularImport(decorator.expression.expression, checker, 'Output'))
}

export function sourceOutput(component: SourceComponent, name: string, checker: ts.TypeChecker): ts.PropertyDeclaration | undefined {
  const declarations = checker.getTypeAtLocation(component.declaration).getProperties()
    .map(symbol => symbol.valueDeclaration).filter((node): node is ts.PropertyDeclaration => !!node && ts.isPropertyDeclaration(node))
    .filter(node => isOutput(node, checker) && (outputAlias(node, checker) ?? node.name.getText()) === name)
  return declarations.length === 1 ? declarations[0] : undefined
}
