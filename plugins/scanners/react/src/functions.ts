import ts from 'typescript'

/** A function whose body the scanner can read: the shape every operation and handler takes. */
export type Operation = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration
  | ts.ConstructorDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration

export function executable(node: ts.Node): node is Operation {
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return true
  return (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node)
    || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) && node.body !== undefined
}

/** The operation that runs a node: the nearest enclosing function. */
export function caller(node: ts.Node): Operation | undefined {
  for (let parent = node.parent; parent; parent = parent.parent) if (executable(parent)) return parent
  return undefined
}

/** An operation's own name, or the name of the variable that holds it. */
export function operationName(node: Operation): string {
  const name = node.name
  if (name !== undefined && !ts.isComputedPropertyName(name)) return name.text
  return ts.isVariableDeclaration(node.parent) ? node.parent.name.getText() : 'callback'
}
