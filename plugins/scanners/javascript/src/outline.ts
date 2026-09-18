import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { CodeFile, SourceReference } from '@groma/scanner'
import ts from 'typescript'
import { outlineSource } from '../../typescript-outline.ts'
import { topLevelDeclarations } from './declarations.ts'

/** A `.mjs` or `.cjs` file is a module whatever it contains. */
const MODULE_EXTENSION = /\.(?:mjs|cjs)$/

function isExportsReference(node: ts.Expression): boolean {
  if (ts.isIdentifier(node)) return node.text === 'exports'
  return ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)
    && node.expression.text === 'module' && node.name.text === 'exports'
}

function assignedNames(value: ts.Expression): string[] {
  if (ts.isIdentifier(value)) return [value.text]
  if (!ts.isObjectLiteralExpression(value)) return []
  return value.properties.flatMap(property => {
    if (ts.isShorthandPropertyAssignment(property)) return [property.name.text]
    return ts.isPropertyAssignment(property) && ts.isIdentifier(property.initializer) ? [property.initializer.text] : []
  })
}

/** The CommonJS export a statement makes, such as `module.exports = { subtotal }` or `exports.run = ...`. */
function commonJsExport(statement: ts.Statement): ts.BinaryExpression | undefined {
  if (!ts.isExpressionStatement(statement)) return undefined
  const assignment = statement.expression
  if (!ts.isBinaryExpression(assignment) || assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return undefined
  const { left } = assignment
  const target = ts.isPropertyAccessExpression(left) && isExportsReference(left.expression) ? left.expression : left
  return isExportsReference(target) ? assignment : undefined
}

/** The local names one CommonJS export publishes. An exported literal value publishes no local name. */
function publishedBy(assignment: ts.BinaryExpression): string[] {
  const { left, right } = assignment
  // `exports.label = label` and `module.exports.label = label` publish the assigned local name.
  if (ts.isPropertyAccessExpression(left) && isExportsReference(left.expression)) {
    return ts.isIdentifier(right) ? [right.text] : []
  }
  return assignedNames(right)
}

function statesEcmaScriptModule(source: ts.SourceFile): boolean {
  return source.statements.some(statement => ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)
    || ts.isExportAssignment(statement)
    || (ts.canHaveModifiers(statement)
      && (ts.getModifiers(statement) ?? []).some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)))
}

/**
 * The names a file publishes. A module publishes what it exports, whether or not that names a local
 * declaration; a browser script publishes nothing through a module system, so its top-level declarations
 * are globals that any other script may use.
 */
function publishedNames(file: string, source: ts.SourceFile): string[] {
  const exports = source.statements.flatMap(statement => commonJsExport(statement) ?? [])
  if (exports.length > 0 || MODULE_EXTENSION.test(file) || statesEcmaScriptModule(source)) {
    return exports.flatMap(publishedBy)
  }
  return topLevelDeclarations(source).map(declaration => declaration.name)
}

/** Outline each referenced file by parsing its source alone, under the shared TypeScript outline rules. */
export async function readJavaScriptOutline(
  repositoryRoot: string,
  references: readonly SourceReference[],
): Promise<CodeFile[]> {
  const files: CodeFile[] = []
  for (const reference of references) {
    const fileName = path.join(repositoryRoot, reference.file)
    const text = await readFile(fileName, 'utf8')
    const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true)
    const declarations = outlineSource(ts, source, { symbols: reference.symbols, exported: publishedNames(reference.file, source) })
    if (declarations.length > 0) files.push({ file: reference.file, declarations })
  }
  return files
}
