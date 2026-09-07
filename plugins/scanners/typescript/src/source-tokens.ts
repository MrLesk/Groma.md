import {
  isArrayTypeNode,
  isBinaryExpression,
  isBindingElement,
  isBlock,
  isCallExpression,
  isConditionalExpression,
  isConditionalTypeNode,
  isFunctionLikeDeclaration,
  isFunctionTypeNode,
  isHeritageClauseElement,
  isIdentifier,
  isLiteralTypeNode,
  isNewExpression,
  isNoSubstitutionTemplateLiteral,
  isNumericLiteral,
  isParameterDeclaration,
  isPrefixUnaryExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isReturnStatement,
  isShorthandPropertyAssignment,
  isStringLiteral,
  isTypeLiteralNode,
  isTypeParameterDeclaration,
  isVariableDeclaration,
  SyntaxKind,
  type Node,
} from 'typescript/unstable/ast'

interface Scope {
  parent?: Scope
  slots: Map<string, number>
}

function lookup(scope: Scope, name: string): number | undefined {
  return scope.slots.get(name) ?? (scope.parent === undefined ? undefined : lookup(scope.parent, name))
}

function skipType(node: Node): boolean {
  return isTypeParameterDeclaration(node)
    || isArrayTypeNode(node)
    || isFunctionTypeNode(node)
    || isLiteralTypeNode(node)
    || isTypeLiteralNode(node)
    || isHeritageClauseElement(node)
    || isConditionalTypeNode(node)
}

function parametersOf(node: Node): readonly Node[] {
  const parameters = 'parameters' in node ? node.parameters : undefined
  return Array.isArray(parameters) ? parameters : []
}

function bodyOf(node: Node): Node | undefined {
  return 'body' in node ? node.body as Node | undefined : undefined
}

/** Binding-normalized tokens of one operation body. Local names become slots. */
export function tokenizeOperation(node: Node): string[] {
  const tokens: string[] = []
  let next = 0
  let scope: Scope = { slots: new Map() }

  function bindPattern(part: Node | undefined): void {
    if (!part) return
    if (isIdentifier(part)) {
      scope.slots.set(part.text, next++)
      return
    }
    if (isBindingElement(part) && part.name && isIdentifier(part.name)) {
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

  function declare(node: Node): void {
    if (isParameterDeclaration(node) || isVariableDeclaration(node)) {
      bindPattern(node.name)
      walk(node.initializer)
    }
  }

  function identifierToken(node: Node & { text: string }): string {
    if (node.parent && isPropertyAccessExpression(node.parent) && node.parent.name === node) {
      return `.${node.text}`
    }
    if (node.parent && isPropertyAssignment(node.parent) && node.parent.name === node) {
      return `k.${node.text}`
    }
    if (node.parent && isShorthandPropertyAssignment(node.parent) && node.parent.name === node) {
      return `k.${node.text}`
    }
    const slot = lookup(scope, node.text)
    return slot === undefined ? node.text : `$${slot}`
  }

  function nested(node: Node): void {
    tokens.push('fn')
    inScope(() => {
      for (const param of parametersOf(node)) {
        if (param && isParameterDeclaration(param)) declare(param)
      }
      walk(bodyOf(node))
    })
  }

  function emitLiteral(node: Node): boolean {
    if (isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node)) {
      tokens.push(JSON.stringify(node.text))
      return true
    }
    if (isNumericLiteral(node)) {
      tokens.push(node.text)
      return true
    }
    if (node.kind === SyntaxKind.TrueKeyword || node.kind === SyntaxKind.FalseKeyword) {
      tokens.push(node.kind === SyntaxKind.TrueKeyword ? 'true' : 'false')
      return true
    }
    if (node.kind === SyntaxKind.NullKeyword) {
      tokens.push('null')
      return true
    }
    return false
  }

  function emitCall(node: Node): boolean {
    if (!isCallExpression(node) && !isNewExpression(node)) return false
    if (isNewExpression(node)) tokens.push('new')
    walk(node.expression)
    tokens.push('call')
    for (const argument of node.arguments ?? []) walk(argument)
    return true
  }

  function emitOperator(node: Node): boolean {
    if (isBinaryExpression(node)) {
      walk(node.left)
      tokens.push(node.operatorToken.getText())
      walk(node.right)
      return true
    }
    if (isPrefixUnaryExpression(node)) {
      tokens.push(unaryOperator(node.operator))
      walk(node.operand)
      return true
    }
    if (isConditionalExpression(node)) {
      walk(node.condition)
      tokens.push('?')
      walk(node.whenTrue)
      tokens.push(':')
      walk(node.whenFalse)
      return true
    }
    return false
  }

  function emitStructure(node: Node): boolean {
    if (isBlock(node)) {
      inScope(() => node.forEachChild(child => walk(child)))
      return true
    }
    if (isVariableDeclaration(node) || isParameterDeclaration(node)) {
      declare(node)
      return true
    }
    if (isFunctionLikeDeclaration(node) && node !== root) {
      nested(node)
      return true
    }
    if (isReturnStatement(node)) {
      tokens.push('return')
      walk(node.expression)
      return true
    }
    return false
  }

  function walk(node: Node | undefined): void {
    if (!node || skipType(node) || emitStructure(node)) return
    if (isIdentifier(node)) {
      tokens.push(identifierToken(node))
      return
    }
    if (emitLiteral(node) || emitCall(node) || emitOperator(node)) return
    const keyword = controlKeyword(node.kind)
    if (keyword) tokens.push(keyword)
    node.forEachChild(child => walk(child))
  }

  const root = node
  for (const param of parametersOf(node)) {
    if (param && isParameterDeclaration(param)) declare(param)
  }
  walk(bodyOf(node))
  return tokens
}

function unaryOperator(kind: SyntaxKind): string {
  if (kind === SyntaxKind.ExclamationToken) return '!'
  if (kind === SyntaxKind.MinusToken) return '-'
  if (kind === SyntaxKind.PlusToken) return '+'
  if (kind === SyntaxKind.TildeToken) return '~'
  if (kind === SyntaxKind.PlusPlusToken) return '++'
  if (kind === SyntaxKind.MinusMinusToken) return '--'
  return SyntaxKind[kind]?.replace(/Token$|Keyword$/, '').toLowerCase() ?? 'op'
}

function controlKeyword(kind: SyntaxKind): string | undefined {
  if (kind === SyntaxKind.IfKeyword || kind === SyntaxKind.IfStatement) return 'if'
  if (kind === SyntaxKind.ElseKeyword) return 'else'
  if (kind === SyntaxKind.ForStatement || kind === SyntaxKind.ForInStatement || kind === SyntaxKind.ForOfStatement) {
    return 'for'
  }
  if (kind === SyntaxKind.WhileStatement) return 'while'
  if (kind === SyntaxKind.ThrowStatement) return 'throw'
  if (kind === SyntaxKind.TryStatement) return 'try'
  if (kind === SyntaxKind.AwaitKeyword || kind === SyntaxKind.AwaitExpression) return 'await'
  if (kind === SyntaxKind.YieldExpression) return 'yield'
  return undefined
}
