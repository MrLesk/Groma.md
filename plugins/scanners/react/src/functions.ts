import ts from 'typescript'

/** A function whose body the scanner can read: the shape every operation and handler takes. */
export type Operation = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction

export function executable(node: ts.Node): node is Operation {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node) || (ts.isFunctionDeclaration(node) && !!node.body)
}
