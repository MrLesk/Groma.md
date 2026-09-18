import ts from 'typescript'

// The token spellings match the reference ../../typescript/src/source-tokens.ts, so the same body in a
// JavaScript file and in a TypeScript file compares equal; change both together. The reference also skips
// type nodes, which JavaScript bodies never contain.

interface Scope {
  parent?: Scope
  slots: Map<string, number>
}

function lookup(scope: Scope, name: string): number | undefined {
  return scope.slots.get(name) ?? (scope.parent === undefined ? undefined : lookup(scope.parent, name))
}

/** The declarations the reference treats as nested functions; signatures in types carry no body. */
function functionDeclaration(node: ts.Node): boolean {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)
    || ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node)
    || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)
}

function parametersOf(node: ts.Node): readonly ts.Node[] {
  return ts.isFunctionLike(node) ? node.parameters : []
}

function bodyOf(node: ts.Node): ts.Node | undefined {
  return 'body' in node ? node.body as ts.Node | undefined : undefined
}

function unaryOperator(kind: ts.SyntaxKind): string {
  if (kind === ts.SyntaxKind.ExclamationToken) return '!'
  if (kind === ts.SyntaxKind.MinusToken) return '-'
  if (kind === ts.SyntaxKind.PlusToken) return '+'
  if (kind === ts.SyntaxKind.TildeToken) return '~'
  if (kind === ts.SyntaxKind.PlusPlusToken) return '++'
  if (kind === ts.SyntaxKind.MinusMinusToken) return '--'
  return ts.SyntaxKind[kind]?.replace(/Token$|Keyword$/, '').toLowerCase() ?? 'op'
}

function controlKeyword(kind: ts.SyntaxKind): string | undefined {
  if (kind === ts.SyntaxKind.IfKeyword || kind === ts.SyntaxKind.IfStatement) return 'if'
  if (kind === ts.SyntaxKind.ElseKeyword) return 'else'
  if (kind === ts.SyntaxKind.ForStatement || kind === ts.SyntaxKind.ForInStatement
    || kind === ts.SyntaxKind.ForOfStatement) return 'for'
  if (kind === ts.SyntaxKind.WhileStatement) return 'while'
  if (kind === ts.SyntaxKind.ThrowStatement) return 'throw'
  if (kind === ts.SyntaxKind.TryStatement) return 'try'
  if (kind === ts.SyntaxKind.AwaitKeyword || kind === ts.SyntaxKind.AwaitExpression) return 'await'
  if (kind === ts.SyntaxKind.YieldExpression) return 'yield'
  return undefined
}

/** Binding-normalized tokens of one operation body. Local names become slots; the operation's own name stays text. */
export function tokenizeOperation(node: ts.Node): string[] {
  const tokens: string[] = []
  let next = 0
  let scope: Scope = { slots: new Map() }

  function bindPattern(part: ts.Node | undefined): void {
    if (!part) return
    if (ts.isIdentifier(part)) {
      scope.slots.set(part.text, next++)
      return
    }
    if (ts.isBindingElement(part) && ts.isIdentifier(part.name)) {
      scope.slots.set(part.name.text, next++)
      if (part.initializer) walk(part.initializer)
      return
    }
    part.forEachChild(child => bindPattern(child))
  }

  function inScope(run: () => void): void {
    const previous = scope
    scope = { parent: previous, slots: new Map() }
    run()
    scope = previous
  }

  function declare(node: ts.ParameterDeclaration | ts.VariableDeclaration): void {
    bindPattern(node.name)
    walk(node.initializer)
  }

  function identifierToken(node: ts.Identifier): string {
    const parent = node.parent
    if (parent && ts.isPropertyAccessExpression(parent) && parent.name === node) return `.${node.text}`
    if (parent && ts.isPropertyAssignment(parent) && parent.name === node) return `k.${node.text}`
    if (parent && ts.isShorthandPropertyAssignment(parent) && parent.name === node) return `k.${node.text}`
    const slot = lookup(scope, node.text)
    return slot === undefined ? node.text : `$${slot}`
  }

  function nested(node: ts.Node): void {
    tokens.push('fn')
    inScope(() => {
      for (const parameter of parametersOf(node)) {
        if (ts.isParameter(parameter)) declare(parameter)
      }
      walk(bodyOf(node))
    })
  }

  function emitLiteral(node: ts.Node): boolean {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      tokens.push(JSON.stringify(node.text))
      return true
    }
    if (ts.isNumericLiteral(node)) {
      tokens.push(node.text)
      return true
    }
    if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
      tokens.push(node.kind === ts.SyntaxKind.TrueKeyword ? 'true' : 'false')
      return true
    }
    if (node.kind === ts.SyntaxKind.NullKeyword) {
      tokens.push('null')
      return true
    }
    return false
  }

  function emitCall(node: ts.Node): boolean {
    if (!ts.isCallExpression(node) && !ts.isNewExpression(node)) return false
    if (ts.isNewExpression(node)) tokens.push('new')
    walk(node.expression)
    tokens.push('call')
    for (const argument of node.arguments ?? []) walk(argument)
    return true
  }

  function emitOperator(node: ts.Node): boolean {
    if (ts.isBinaryExpression(node)) {
      walk(node.left)
      tokens.push(node.operatorToken.getText())
      walk(node.right)
      return true
    }
    if (ts.isPrefixUnaryExpression(node)) {
      tokens.push(unaryOperator(node.operator))
      walk(node.operand)
      return true
    }
    if (ts.isConditionalExpression(node)) {
      walk(node.condition)
      tokens.push('?')
      walk(node.whenTrue)
      tokens.push(':')
      walk(node.whenFalse)
      return true
    }
    return false
  }

  function emitStructure(node: ts.Node): boolean {
    if (ts.isBlock(node)) {
      inScope(() => node.forEachChild(child => walk(child)))
      return true
    }
    if (ts.isParameter(node) || ts.isVariableDeclaration(node)) {
      declare(node)
      return true
    }
    if (functionDeclaration(node) && node !== root) {
      nested(node)
      return true
    }
    if (ts.isReturnStatement(node)) {
      tokens.push('return')
      walk(node.expression)
      return true
    }
    return false
  }

  function walk(node: ts.Node | undefined): void {
    if (!node || emitStructure(node)) return
    if (ts.isIdentifier(node)) {
      tokens.push(identifierToken(node))
      return
    }
    if (emitLiteral(node) || emitCall(node) || emitOperator(node)) return
    const keyword = controlKeyword(node.kind)
    if (keyword) tokens.push(keyword)
    node.forEachChild(child => walk(child))
  }

  const root = node
  for (const parameter of parametersOf(node)) {
    if (ts.isParameter(parameter)) declare(parameter)
  }
  walk(bodyOf(node))
  return tokens
}
