import type { ScanDiagnostic, ScanInvocation, ScanOperation } from '@groma/scanner'
import ts from 'typescript'
import { relative } from './project.ts'

function isOperation(node: ts.Node): boolean {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)
    || ts.isConstructorDeclaration(node)
}

/** The class construction that runs an instance field initializer: its constructor, or the class's implicit one. */
function construction(field: ts.PropertyDeclaration): ts.Node | undefined {
  if (!ts.isClassLike(field.parent) || ts.getModifiers(field)?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword)) return undefined
  return field.parent.members.find(member => ts.isConstructorDeclaration(member) && member.body) ?? field.parent
}

/** The operation that runs a node: the nearest function, method or constructor, or the construction that runs a field initializer. */
export function enclosingOperation(node: ts.Node): ts.Node | undefined {
  for (let current = node.parent; current; current = current.parent) {
    if (isOperation(current)) return current
    if (ts.isPropertyDeclaration(current) && current.initializer !== undefined && node.pos >= current.initializer.pos) return construction(current)
  }
  return undefined
}

function operationName(node: ts.Node): string {
  if (ts.isConstructorDeclaration(node) || ts.isClassLike(node)) return 'constructor'
  if ((ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name) return node.name.getText()
  return `callback at ${node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1}`
}

/** The operations, bindings and diagnostics one Angular project reports. */
export class Evidence {
  readonly operations = new Map<string, ScanOperation>()
  readonly invocations: ScanInvocation[] = []
  readonly diagnostics: ScanDiagnostic[] = []
  private readonly root: string

  constructor(root: string) { this.root = root }

  /** One operation per function, shared by binding and HTTP facts. */
  operationId(node: ts.Node): string {
    return this.operation(relative(this.root, node.getSourceFile().fileName), node.getStart(), operationName(node))
  }

  /** Template code runs as an operation of its own: an event handler in the file that holds the template. */
  operation(file: string, position: number, name: string): string {
    const id = `${file}#${position}`
    this.operations.set(id, { id, file, name, position })
    return id
  }
}
