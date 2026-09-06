import {
  isCallExpression,
  isExportDeclaration,
  isExportSpecifier,
  isIdentifier,
  isImportDeclaration,
  isImportTypeNode,
  isLiteralTypeNode,
  isNamedImports,
  isNamespaceImport,
  isShorthandPropertyAssignment,
  isStringLiteral,
  SyntaxKind,
  type Identifier,
  type ImportClause,
  type Node,
  type SourceFile,
} from 'typescript/unstable/ast'
import type { Checker } from 'typescript/unstable/async'

interface ImportBinding {
  name: Identifier
  specifier: string
}

function bindingNames(clause: ImportClause): Identifier[] {
  const result = clause.name ? [clause.name] : []
  const named = clause.namedBindings
  if (named && isNamespaceImport(named)) result.push(named.name)
  if (named && isNamedImports(named)) result.push(...named.elements.map(binding => binding.name))
  return result
}

function importBindings(source: SourceFile, dependencies: Set<string>): ImportBinding[] {
  const bindings: ImportBinding[] = []
  for (const statement of source.statements) {
    if (isExportDeclaration(statement) && statement.moduleSpecifier && isStringLiteral(statement.moduleSpecifier)) {
      dependencies.add(statement.moduleSpecifier.text)
    }
    if (!isImportDeclaration(statement) || !isStringLiteral(statement.moduleSpecifier)) continue
    const specifier = statement.moduleSpecifier.text
    if (!specifier.startsWith('.')) continue
    const clause = statement.importClause
    const names = clause ? bindingNames(clause) : []
    if (names.length === 0 && clause?.phaseModifier !== SyntaxKind.TypeKeyword) dependencies.add(specifier)
    bindings.push(...names.map(name => ({ name, specifier })))
  }
  return bindings
}

function references(source: SourceFile, names: Set<string>, dependencies: Set<string>): Identifier[] {
  const result: Identifier[] = []
  function visit(node: Node): void {
    if (isImportDeclaration(node)) return
    if (isCallExpression(node) && node.expression.kind === SyntaxKind.ImportKeyword) {
      const argument = node.arguments[0]
      if (argument && isStringLiteral(argument)) dependencies.add(argument.text)
    }
    if (isImportTypeNode(node) && isLiteralTypeNode(node.argument) && isStringLiteral(node.argument.literal)) {
      dependencies.add(node.argument.literal.text)
    }
    if (isIdentifier(node) && names.has(node.text)) result.push(node)
    node.forEachChild(visit)
  }
  visit(source)
  return result
}

/** Resolve uses to their import binding; spelling alone is not a dependency. */
export async function usedImportSpecifiers(source: SourceFile, checker: Checker): Promise<string[]> {
  const dependencies = new Set<string>()
  const bindings = importBindings(source, dependencies)
  const uses = references(source, new Set(bindings.map(binding => binding.name.text)), dependencies)
  if (uses.length === 0) return [...dependencies]
  const symbols = await checker.getSymbolAtLocation([...bindings.map(binding => binding.name), ...uses])
  const imported = new Map(bindings.flatMap((binding, index) => {
    const symbol = symbols[index]
    return symbol ? [[symbol.id, binding.specifier] as const] : []
  }))
  await Promise.all(uses.map(async (use, index) => {
    let symbol = symbols[bindings.length + index]
    if (isShorthandPropertyAssignment(use.parent)) {
      symbol = await checker.getShorthandAssignmentValueSymbol(use.parent)
    } else if (isExportSpecifier(use.parent)) {
      symbol = await checker.getExportSpecifierLocalTargetSymbol(use.parent)
    }
    const specifier = symbol && imported.get(symbol.id)
    if (specifier) dependencies.add(specifier)
  }))
  return [...dependencies]
}
