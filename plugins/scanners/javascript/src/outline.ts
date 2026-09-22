import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { CodeFile, SourceReference } from '@groma/scanner'
import ts from 'typescript'
import { outlineClassExpression, outlineSource } from '../../typescript-outline.ts'
import { assignedValue, commonJsExport, topLevelDeclarations } from './declarations.ts'

/** A `.mjs` or `.cjs` file is a module whatever it contains. */
const MODULE_EXTENSION = /\.(?:mjs|cjs)$/

function assignedNames(value: ts.Expression): string[] {
  if (ts.isIdentifier(value)) return [value.text]
  if (ts.isClassExpression(value) && value.name) return [value.name.text]
  if (!ts.isObjectLiteralExpression(value)) return []
  return value.properties.flatMap(property => {
    if (ts.isShorthandPropertyAssignment(property)) return [property.name.text]
    return ts.isPropertyAssignment(property) && ts.isIdentifier(property.initializer) ? [property.initializer.text] : []
  })
}

/** The local names one CommonJS export publishes. An exported literal value publishes no local name. */
function publishedBy(assignment: ts.BinaryExpression): string[] {
  const { left } = assignment
  const right = assignedValue(assignment.right)
  // `exports.label = label` and `module.exports.label = label` publish the assigned local name.
  if (ts.isPropertyAccessExpression(left) && !(ts.isIdentifier(left.expression)
    && left.expression.text === 'module' && left.name.text === 'exports')) {
    return ts.isIdentifier(right) ? [right.text] : []
  }
  return assignedNames(right)
}

function usesRequire(source: ts.SourceFile): boolean {
  let found = false
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') found = true
    else if (!found) ts.forEachChild(node, visit)
  }
  ts.forEachChild(source, visit)
  return found
}

function statesModuleBoundary(source: ts.SourceFile): boolean {
  return usesRequire(source) || source.statements.some(statement => ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)
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
  if (exports.length > 0 || MODULE_EXTENSION.test(file) || statesModuleBoundary(source)) {
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
    const exported = publishedNames(reference.file, source)
    const classes = source.statements.flatMap(statement => {
      const assignment = commonJsExport(statement)
      const value = assignment && assignedValue(assignment.right)
      return value && ts.isClassExpression(value)
        ? outlineClassExpression(ts, source, value, { symbols: reference.symbols, exported }) : []
    })
    const declarations = [...outlineSource(ts, source, { symbols: reference.symbols, exported }), ...classes]
      .sort((left, right) => left.line - right.line)
    if (declarations.length > 0) files.push({ file: reference.file, declarations })
  }
  return files
}
