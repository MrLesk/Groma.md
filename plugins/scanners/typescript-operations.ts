import type { ScanOperation } from '@groma/scanner'

/*
 * The operations the TypeScript-family scanners let core compare as possible duplicate logic, and their
 * binding-normalized body tokens, as docs/architecture-findings.md#compared-operations states. The TypeScript
 * scanner passes its native SDK's syntax kinds; the JavaScript and Vue scanners pass the classic `typescript`
 * module they pin and bundle. Kind numbers differ between the compilers, so every kind is looked up by name in
 * the SyntaxKind the caller passes; a scanner must pass the compiler that parsed its nodes.
 */

type KindName =
  | 'Identifier' | 'PrivateIdentifier' | 'Parameter' | 'VariableDeclaration' | 'BindingElement' | 'ObjectBindingPattern'
  | 'Block' | 'ReturnStatement'
  | 'CallExpression' | 'NewExpression' | 'PropertyAccessExpression' | 'ElementAccessExpression' | 'PropertyAssignment'
  | 'ShorthandPropertyAssignment' | 'ObjectLiteralExpression'
  | 'ArrowFunction' | 'FunctionExpression' | 'FunctionDeclaration' | 'MethodDeclaration' | 'Constructor'
  | 'GetAccessor' | 'SetAccessor'
  | 'ParenthesizedExpression' | 'AsExpression' | 'SatisfiesExpression' | 'NonNullExpression'
  | 'StringLiteral' | 'NoSubstitutionTemplateLiteral' | 'TemplateHead' | 'TemplateMiddle' | 'TemplateTail'
  | 'NumericLiteral' | 'BigIntLiteral' | 'RegularExpressionLiteral'
  | 'TrueKeyword' | 'FalseKeyword' | 'NullKeyword' | 'ThisKeyword' | 'SuperKeyword' | 'AwaitKeyword'
  | 'QuestionDotToken' | 'SpreadElement' | 'SpreadAssignment'
  | 'ExclamationToken' | 'MinusToken' | 'PlusToken' | 'TildeToken' | 'PlusPlusToken' | 'MinusMinusToken'
  | 'BinaryExpression' | 'ConditionalExpression' | 'PrefixUnaryExpression' | 'PostfixUnaryExpression'
  | 'TypeOfExpression' | 'VoidExpression' | 'DeleteExpression' | 'AwaitExpression' | 'YieldExpression'
  | 'IfStatement' | 'ForStatement' | 'ForInStatement' | 'ForOfStatement' | 'WhileStatement' | 'DoStatement'
  | 'SwitchStatement' | 'CaseClause' | 'DefaultClause' | 'BreakStatement' | 'ContinueStatement'
  | 'ThrowStatement' | 'TryStatement' | 'CatchClause'
  | 'TypeParameter' | 'ArrayType' | 'FunctionType' | 'LiteralType' | 'TypeLiteral'
  | 'ExpressionWithTypeArguments' | 'TypeReference' | 'ConditionalType'

/** The syntax kinds of the compiler a scanner parses with. */
interface OperationSyntax {
  SyntaxKind: Readonly<Record<KindName, number>>
}
type Kinds = OperationSyntax['SyntaxKind']

interface Node {
  readonly kind: number
  readonly parent?: Node
  readonly end: number
  getStart(): number
  getText(): string
  getSourceFile(): { getLineAndCharacterOfPosition(position: number): { line: number } }
  forEachChild(visit: (child: Node) => void): void
}
interface Text extends Node { readonly text: string }
interface Named extends Node { readonly name?: Node }
interface Declaration extends Node { readonly name: Node; readonly initializer?: Node }
interface BindingElement extends Declaration { readonly propertyName?: Node }
interface FunctionLike extends Node { readonly parameters: readonly Node[]; readonly body?: Node }
interface Wrapper extends Node { readonly expression: Node }
interface Call extends Node { readonly expression: Node; readonly questionDotToken?: Node; readonly arguments?: readonly Node[] }
interface Binary extends Node { readonly left: Node; readonly operatorToken: Node; readonly right: Node }
interface Unary extends Node { readonly operator: number; readonly operand: Node }
interface Conditional extends Node { readonly condition: Node; readonly whenTrue: Node; readonly whenFalse: Node }
interface If extends Node { readonly expression: Node; readonly thenStatement: Node; readonly elseStatement?: Node }
interface Try extends Node { readonly tryBlock: Node; readonly catchClause?: Node; readonly finallyBlock?: Node }

function is<T extends Node>(node: Node | undefined, kind: number): node is T {
  return node !== undefined && node.kind === kind
}

/** How each syntax kind of one compiler reaches the tokens. */
interface Vocabulary {
  /** The token a syntax kind writes before its children: keywords, `?.`, `...` and `index` for an element access. */
  leading: ReadonlyMap<number, string>
  /** String values, quoted, including the text between a template's substitutions. */
  quoted: ReadonlySet<number>
  /** Literals written as their source text. */
  verbatim: ReadonlySet<number>
  unary: ReadonlyMap<number, string>
  /** Operator expressions, whose parentheses change the meaning. */
  operators: ReadonlySet<number>
  /** Type positions, skipped so annotations do not change a body. */
  types: ReadonlySet<number>
  /** Type-only `as`, `satisfies` and `!` around a value. */
  assertions: ReadonlySet<number>
  functions: ReadonlySet<number>
}

function vocabularyOf(k: Kinds): Vocabulary {
  return {
    leading: new Map([
      [k.TrueKeyword, 'true'], [k.FalseKeyword, 'false'], [k.NullKeyword, 'null'],
      [k.ThisKeyword, 'this'], [k.SuperKeyword, 'super'],
      [k.QuestionDotToken, '?.'], [k.SpreadElement, '...'], [k.SpreadAssignment, '...'],
      [k.ElementAccessExpression, 'index'], [k.ReturnStatement, 'return'],
      [k.ForStatement, 'for'], [k.ForInStatement, 'for'], [k.ForOfStatement, 'for'],
      [k.WhileStatement, 'while'], [k.DoStatement, 'do'],
      [k.SwitchStatement, 'switch'], [k.CaseClause, 'case'], [k.DefaultClause, 'default'],
      [k.BreakStatement, 'break'], [k.ContinueStatement, 'continue'],
      [k.ThrowStatement, 'throw'], [k.CatchClause, 'catch'],
      [k.AwaitKeyword, 'await'], [k.AwaitExpression, 'await'], [k.YieldExpression, 'yield'],
      [k.TypeOfExpression, 'typeof'], [k.VoidExpression, 'void'], [k.DeleteExpression, 'delete'],
    ]),
    quoted: new Set([k.StringLiteral, k.NoSubstitutionTemplateLiteral, k.TemplateHead, k.TemplateMiddle, k.TemplateTail]),
    verbatim: new Set([k.NumericLiteral, k.BigIntLiteral, k.RegularExpressionLiteral]),
    unary: new Map([
      [k.ExclamationToken, '!'], [k.MinusToken, '-'], [k.PlusToken, '+'], [k.TildeToken, '~'],
      [k.PlusPlusToken, '++'], [k.MinusMinusToken, '--'],
    ]),
    operators: new Set([
      k.BinaryExpression, k.ConditionalExpression, k.PrefixUnaryExpression, k.PostfixUnaryExpression,
      k.TypeOfExpression, k.VoidExpression, k.DeleteExpression, k.AwaitExpression, k.YieldExpression,
    ]),
    types: new Set([
      k.TypeParameter, k.ArrayType, k.FunctionType, k.LiteralType, k.TypeLiteral,
      k.ExpressionWithTypeArguments, k.TypeReference, k.ConditionalType,
    ]),
    assertions: new Set([k.AsExpression, k.SatisfiesExpression, k.NonNullExpression]),
    functions: new Set([
      k.ArrowFunction, k.FunctionExpression, k.FunctionDeclaration, k.MethodDeclaration, k.Constructor,
      k.GetAccessor, k.SetAccessor,
    ]),
  }
}

type OperationFields = Pick<ScanOperation, 'name' | 'startLine' | 'endLine' | 'tokens'>

/** The operation rules of one compiler. */
interface TypeScriptOperations {
  /** A function whose body runs as its own operation: function literals, and declarations, methods and constructors with a body. */
  executable(node: Node): boolean
  /**
   * The name of an operation, with the inclusive source range and body tokens core compares; only `(anonymous)`
   * for module code, anonymous callbacks and any other node.
   */
  operationFields(node: Node): OperationFields
}

export function typeScriptOperations(ts: OperationSyntax): TypeScriptOperations {
  const k = ts.SyntaxKind
  const words = vocabularyOf(k)

  function executable(node: Node): boolean {
    if (node.kind === k.ArrowFunction || node.kind === k.FunctionExpression) return true
    const declared = node.kind === k.FunctionDeclaration || node.kind === k.MethodDeclaration || node.kind === k.Constructor
    return declared && (node as FunctionLike).body !== undefined
  }

  /**
   * A function written as a property of an object literal argument, such as `subscribe({ next: value => ... })`.
   * The argument may belong to a function call, a `new` call, or a decorator, which is a call, and the object may
   * sit inside parentheses or a type-only `as`, `satisfies` or `!`.
   */
  function callArgumentProperty(node: Node): boolean {
    const property = is(node.parent, k.PropertyAssignment) ? node.parent : node
    if (property.kind !== k.PropertyAssignment && property.kind !== k.MethodDeclaration) return false
    if (!is(property.parent, k.ObjectLiteralExpression)) return false
    let holder = property.parent.parent
    while (holder !== undefined && (holder.kind === k.ParenthesizedExpression || words.assertions.has(holder.kind))) {
      holder = holder.parent
    }
    return is(holder, k.CallExpression) || is(holder, k.NewExpression)
  }

  /** Name of an operation core may compare; undefined for module code and anonymous callbacks. */
  function comparableName(node: Node): string | undefined {
    if (!executable(node) || callArgumentProperty(node)) return undefined
    if (node.kind === k.Constructor) return 'constructor'
    const name = (node as Named).name
    if (is<Text>(name, k.Identifier)) return name.text
    const parent = node.parent
    if (is<Declaration>(parent, k.PropertyAssignment) || is<Declaration>(parent, k.VariableDeclaration)) return parent.name.getText()
    return undefined
  }

  function operationFields(node: Node): OperationFields {
    const name = comparableName(node)
    if (name === undefined) return { name: '(anonymous)' }
    const source = node.getSourceFile()
    const line = (position: number) => source.getLineAndCharacterOfPosition(position).line + 1
    return { name, startLine: line(node.getStart()), endLine: line(node.end), tokens: tokenize(k, words, node as FunctionLike) }
  }

  return { executable, operationFields }
}

interface Scope {
  parent?: Scope
  slots: Map<string, number>
}

function lookup(scope: Scope, name: string): number | undefined {
  return scope.slots.get(name) ?? (scope.parent === undefined ? undefined : lookup(scope.parent, name))
}

/**
 * Binding-normalized tokens of one operation body. Parameters and local names become slots in declaration order;
 * the operation's own name, property names, other identifiers, operators, keywords and literals stay as written.
 */
function tokenize(k: Kinds, words: Vocabulary, operation: FunctionLike): string[] {
  const tokens: string[] = []
  let next = 0
  let scope: Scope = { slots: new Map() }

  function bindPattern(part: Node | undefined): void {
    if (part === undefined) return
    if (is<Text>(part, k.Identifier)) {
      scope.slots.set(part.text, next++)
      return
    }
    if (is<BindingElement>(part, k.BindingElement)) bindElement(part)
    else part.forEachChild(child => bindPattern(child))
  }

  /** An object pattern element keeps its property name, as an object literal key does; only the bound name is a slot. */
  function bindElement(element: BindingElement): void {
    const key = element.propertyName ?? (is(element.parent, k.ObjectBindingPattern) ? element.name : undefined)
    if (is<Text>(key, k.Identifier) || is<Text>(key, k.StringLiteral) || is<Text>(key, k.NumericLiteral)) tokens.push(`k.${key.text}`)
    else walk(key)
    bindPattern(element.name)
    walk(element.initializer)
  }

  function inScope(run: () => void): void {
    const previous = scope
    scope = { parent: previous, slots: new Map() }
    run()
    scope = previous
  }

  function declare(node: Declaration): void {
    bindPattern(node.name)
    walk(node.initializer)
  }

  function declareParameters(node: FunctionLike): void {
    for (const parameter of node.parameters) if (is<Declaration>(parameter, k.Parameter)) declare(parameter)
  }

  function identifierToken(node: Text): string {
    const parent = node.parent
    if (is<Named>(parent, k.PropertyAccessExpression) && parent.name === node) return `.${node.text}`
    const key = is<Named>(parent, k.PropertyAssignment) || is<Named>(parent, k.ShorthandPropertyAssignment)
    if (key && parent.name === node) return `k.${node.text}`
    const slot = lookup(scope, node.text)
    return slot === undefined ? node.text : `$${slot}`
  }

  /** Parentheses change the meaning only around an operator expression, also inside a type assertion such as `(a + b as T)`. */
  function groupsOperator(expression: Node): boolean {
    let node = expression
    while (words.assertions.has(node.kind)) node = (node as Wrapper).expression
    return words.operators.has(node.kind)
  }

  function emitText(node: Node): boolean {
    if (words.quoted.has(node.kind)) tokens.push(JSON.stringify((node as Text).text))
    else if (words.verbatim.has(node.kind)) tokens.push((node as Text).text)
    else return false
    return true
  }

  function emitCall(node: Node): boolean {
    if (!is<Call>(node, k.CallExpression) && !is<Call>(node, k.NewExpression)) return false
    if (node.kind === k.NewExpression) tokens.push('new')
    walk(node.expression)
    walk(node.questionDotToken)
    tokens.push('call')
    for (const argument of node.arguments ?? []) walk(argument)
    return true
  }

  function emitOperator(node: Node): boolean {
    if (is<Binary>(node, k.BinaryExpression)) {
      walk(node.left)
      tokens.push(node.operatorToken.getText())
      walk(node.right)
    } else if (is<Unary>(node, k.PrefixUnaryExpression)) {
      tokens.push(words.unary.get(node.operator)!)
      walk(node.operand)
    } else if (is<Unary>(node, k.PostfixUnaryExpression)) {
      walk(node.operand)
      tokens.push(words.unary.get(node.operator)!)
    } else if (is<Conditional>(node, k.ConditionalExpression)) {
      walk(node.condition)
      tokens.push('?')
      walk(node.whenTrue)
      tokens.push(':')
      walk(node.whenFalse)
    } else if (is<Wrapper>(node, k.ParenthesizedExpression) && groupsOperator(node.expression)) {
      tokens.push('(')
      walk(node.expression)
      tokens.push(')')
    } else return false
    return true
  }

  /** The children of an `if` or a `try` carry no `else` or `finally` keyword, so it is written before that branch. */
  function emitBranches(node: Node): boolean {
    if (is<If>(node, k.IfStatement)) {
      tokens.push('if')
      walk(node.expression)
      walk(node.thenStatement)
      branch('else', node.elseStatement)
    } else if (is<Try>(node, k.TryStatement)) {
      tokens.push('try')
      walk(node.tryBlock)
      walk(node.catchClause)
      branch('finally', node.finallyBlock)
    } else return false
    return true
  }

  function branch(keyword: string, statement: Node | undefined): void {
    if (statement === undefined) return
    tokens.push(keyword)
    walk(statement)
  }

  function emitStructure(node: Node): boolean {
    if (node.kind === k.Block) inScope(() => node.forEachChild(child => walk(child)))
    else if (is<Declaration>(node, k.VariableDeclaration) || is<Declaration>(node, k.Parameter)) declare(node)
    else if (words.functions.has(node.kind)) {
      tokens.push('fn')
      inScope(() => {
        declareParameters(node as FunctionLike)
        walk((node as FunctionLike).body)
      })
    } else return false
    return true
  }

  function walk(node: Node | undefined): void {
    if (node === undefined || words.types.has(node.kind) || emitStructure(node)) return
    if (is<Text>(node, k.Identifier) || is<Text>(node, k.PrivateIdentifier)) {
      tokens.push(identifierToken(node))
      return
    }
    if (emitText(node) || emitCall(node) || emitOperator(node) || emitBranches(node)) return
    const leading = words.leading.get(node.kind)
    if (leading !== undefined) tokens.push(leading)
    node.forEachChild(child => walk(child))
  }

  declareParameters(operation)
  walk(operation.body)
  return tokens
}
