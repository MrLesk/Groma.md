import ts from 'typescript'
import { unwrapped } from '../../http-syntax.ts'

/** A component's view: its external template, its inline template, and its stylesheets. */
export interface SourceView {
  templateUrl: string | undefined
  template: ts.StringLiteralLike | undefined
  styles: string[]
}

/** A source @Component or @Directive, a class a template places on an element. */
export interface SourceDirective {
  declaration: ts.ClassDeclaration
  metadata: ts.ObjectLiteralExpression
  /** Absent on routed and dynamically created classes, which no template names. */
  selector: string | undefined
  /** Components only. */
  view: SourceView | undefined
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

function sourceView(metadata: ts.ObjectLiteralExpression): SourceView {
  const inline = property(metadata, 'template')
  const single = literal(property(metadata, 'styleUrl'))
  const multiple = property(metadata, 'styleUrls')
  return { templateUrl: literal(property(metadata, 'templateUrl')),
    template: inline && ts.isStringLiteralLike(inline) ? inline : undefined,
    styles: [...(single === undefined ? [] : [single]),
      ...(multiple && ts.isArrayLiteralExpression(multiple) ? multiple.elements.flatMap(item => literal(item) ?? []) : [])] }
}

export function sourceDirective(declaration: ts.ClassDeclaration, checker: ts.TypeChecker): SourceDirective | undefined {
  for (const decorator of ts.getDecorators(declaration) ?? []) {
    const call = decorator.expression
    if (!ts.isCallExpression(call)) continue
    const component = angularImport(call.expression, checker, 'Component')
    if (!component && !angularImport(call.expression, checker, 'Directive')) continue
    const metadata = call.arguments[0]
    if (!metadata || !ts.isObjectLiteralExpression(metadata)) continue
    return { declaration, metadata, selector: literal(property(metadata, 'selector')), view: component ? sourceView(metadata) : undefined }
  }
  return undefined
}

/** What one imports entry names: the elements of an array, a constant array's elements, or a class. */
function importEntry(expression: ts.Expression, checker: ts.TypeChecker): ts.Expression[] | ts.Declaration | undefined {
  if (ts.isArrayLiteralExpression(expression)) return expression.elements.map(element => ts.isSpreadElement(element) ? element.expression : element)
  let symbol = checker.getSymbolAtLocation(expression)
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol)
  const value = symbol?.valueDeclaration
  return value && ts.isVariableDeclaration(value) && value.initializer ? [value.initializer] : value
}

/** The classes a standalone declaration imports: named directly, spread, or gathered in a constant array. */
export function directiveImports(directive: SourceDirective, checker: ts.TypeChecker): Set<ts.Declaration> {
  const declarations = new Set<ts.Declaration>()
  const visited = new Set<ts.Node>()
  const pending = [property(directive.metadata, 'imports')].flatMap(imports => imports ?? [])
  while (pending.length) {
    const expression = unwrapped(ts, pending.pop()!) as ts.Expression
    if (visited.has(expression)) continue
    visited.add(expression)
    const entry = importEntry(expression, checker)
    if (Array.isArray(entry)) pending.push(...entry)
    else if (entry) declarations.add(entry)
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

export function sourceOutput(directive: SourceDirective, name: string, checker: ts.TypeChecker): ts.PropertyDeclaration | undefined {
  const declarations = checker.getTypeAtLocation(directive.declaration).getProperties()
    .map(symbol => symbol.valueDeclaration).filter((node): node is ts.PropertyDeclaration => !!node && ts.isPropertyDeclaration(node))
    .filter(node => isOutput(node, checker) && (outputAlias(node, checker) ?? node.name.getText()) === name)
  return declarations.length === 1 ? declarations[0] : undefined
}

/** `emit` sends an output's event; an `EventEmitter` is also a Subject, so `next` sends one too. */
export const EMITS = new Set(['emit', 'next'])

/**
 * The calls that send this output's events, in the class that declares it or the matched directive that inherits it.
 * TypeScript binds local property access without Angular's declarations.
 */
export function outputEmissions(declaration: ts.PropertyDeclaration, directive: SourceDirective, checker: ts.TypeChecker): ts.CallExpression[] {
  const calls: ts.CallExpression[] = []
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && EMITS.has(node.expression.name.text)) {
      const receiver = checker.getSymbolAtLocation(node.expression.expression)
      if (receiver?.declarations?.includes(declaration)) calls.push(node)
    }
    ts.forEachChild(node, visit)
  }
  for (const owner of new Set([declaration.parent, directive.declaration])) visit(owner)
  return calls
}
