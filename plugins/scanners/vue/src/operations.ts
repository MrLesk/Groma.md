import ts from 'typescript'
import type { ScanOperation } from '@groma/scanner'
import { relative, type VueProject } from './project.ts'
import { sfcScripts } from './sfc.ts'
import { tokenizeOperation } from './tokens.ts'

// The named-operation rule follows the reference ../../typescript/src/source-operations.ts and
// docs/architecture-findings.md; change both together.

function executable(node: ts.Node): boolean {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node)
    || (ts.isFunctionDeclaration(node) && node.body !== undefined)
    || (ts.isMethodDeclaration(node) && node.body !== undefined)
}

/**
 * A function written as a property of an object literal argument, such as `subscribe({ next: value => ... })`.
 * The argument may belong to a function call, a `new` call, or a decorator, which is a call.
 */
function callArgumentProperty(node: ts.Node): boolean {
  const property = ts.isPropertyAssignment(node.parent) ? node.parent : node
  if (!ts.isPropertyAssignment(property) && !ts.isMethodDeclaration(property)) return false
  const invocation = property.parent.parent
  return ts.isObjectLiteralExpression(property.parent)
    && (ts.isCallExpression(invocation) || ts.isNewExpression(invocation))
}

/** Name of an operation core may compare; undefined for initializer code and anonymous callbacks. */
function comparableName(node: ts.Node): string | undefined {
  if (callArgumentProperty(node)) return undefined
  const named = node as ts.NamedDeclaration
  if (named.name && ts.isIdentifier(named.name)) return named.name.text
  const parent = node.parent
  if (ts.isPropertyAssignment(parent) || ts.isVariableDeclaration(parent)) return parent.name.getText()
  return undefined
}

/**
 * Every named operation in the single-file component's scripts, with the lines it occupies in the `.vue`
 * file and its body tokens. Core applies the minimum body sizes, so no body is filtered out here.
 */
function comparedOperations(file: string, text: string): ScanOperation[] {
  const operations: ScanOperation[] = []
  for (const script of sfcScripts(file, text)) {
    const source = ts.createSourceFile(script.fileName, script.text, ts.ScriptTarget.Latest, true)
    const visit = (node: ts.Node): void => {
      const name = executable(node) ? comparableName(node) : undefined
      if (name !== undefined) {
        const position = node.getStart(source)
        operations.push({
          id: `${file}#${position}`,
          file,
          name,
          position,
          startLine: source.getLineAndCharacterOfPosition(position).line + 1,
          endLine: source.getLineAndCharacterOfPosition(node.end).line + 1,
          tokens: tokenizeOperation(node),
        })
      }
      node.forEachChild(visit)
    }
    source.forEachChild(visit)
  }
  return operations
}

/** Report every compared body of the project's single-file components; one entry per function, shared with its binding evidence. */
export function addComparedOperations(project: VueProject, operations: Map<string, ScanOperation>): void {
  for (const source of project.files) {
    if (!project.sfc(source.fileName)) continue
    const file = relative(project.root, source.fileName)
    // The id is the file and the declaration position, so binding evidence for the same function is this entry.
    for (const operation of comparedOperations(file, project.text(source.fileName))) {
      operations.set(operation.id, operation)
    }
  }
}
