import { children, isSyntax, nameOf, type Fields, type Syntax } from './syntax.ts'

interface Scope {
  parent?: Scope
  names: Map<string, string>
}

/** Variables that never name a local of the operation. */
const nonlocal = new Set(['this', 'GLOBALS', '_SERVER', '_GET', '_POST', '_FILES', '_COOKIE', '_SESSION', '_REQUEST', '_ENV'])
/** Wrappers whose children carry the meaning. */
const wrappers = new Set(['block', 'expressionstatement', 'staticvariable', 'encapsedpart'])
const memberOperators: Record<string, string> = { propertylookup: '->', nullsafepropertylookup: '?->', staticlookup: '::' }

function find(scope: Scope | undefined, name: string): string | undefined {
  return scope && (scope.names.get(name) ?? find(scope.parent, name))
}

/**
 * Binding-normalized tokens of one function or method. Parameters and local variables become slots;
 * operators, literals, member names and unresolved names remain.
 */
export function operationTokens(operation: Syntax): string[] {
  const tokens: string[] = []
  let next = 0
  let scope: Scope = { names: new Map() }

  function bind(name: string): string {
    const slot = `$${next++}`
    scope.names.set(name, slot)
    return slot
  }

  // PHP has function scope and no declarations: a local variable exists from its first use.
  function variable(name: string): string {
    if (nonlocal.has(name)) return `$${name}`
    return find(scope, name) ?? bind(name)
  }

  function signatureAndBody(node: Fields): void {
    for (const parameter of node.arguments as Fields[]) {
      bind(nameOf(parameter.name)!)
      walk(parameter.value)
    }
    walk(node.body)
  }

  // A nested named function, anonymous-class method or closure starts with an empty scope; a closure adds the
  // variables it imports with `use`, which are emitted in the enclosing scope with their `&` and can allocate
  // their slots there. An arrow function sees the enclosing scope.
  function nested(node: Fields): void {
    tokens.push('fn')
    const outer = scope
    const uses = (node.uses ?? []) as Fields[]
    walk(uses)
    // PHP rejects `$this` and superglobals as imports, so every imported name has a slot in the enclosing scope.
    const imports = uses.map(used => [String(used.name), find(outer, String(used.name))!] as const)
    scope = { parent: node.kind === 'arrowfunc' ? outer : undefined, names: new Map(imports) }
    signatureAndBody(node)
    scope = outer
  }

  function infix(node: Fields, operator: string): void {
    walk(node.left)
    tokens.push(operator)
    walk(node.right)
  }

  function call(node: Fields): void {
    if (node.kind === 'new') tokens.push('new')
    walk(node.what)
    tokens.push('call')
    walk(node.arguments)
  }

  // A static property such as `self::$count` is a member, not a local variable.
  function member(node: Fields): void {
    walk(node.what)
    const offset = node.offset as Fields
    const name = offset.kind === 'identifier' ? String(offset.name)
      : node.kind === 'staticlookup' && offset.kind === 'variable' && typeof offset.name === 'string' ? `$${offset.name}` : undefined
    tokens.push(memberOperators[node.kind] + (name ?? ''))
    if (name === undefined) walk(offset)
  }

  function entry(node: Fields): void {
    walk(node.key)
    if (node.key) tokens.push('=>')
    if (node.byRef) tokens.push('&')
    if (node.unpack) tokens.push('...')
    walk(node.value)
  }

  function globalStatement(node: Fields): void {
    tokens.push('global')
    for (const item of node.items as Fields[]) {
      const name = `$${String(item.name)}`
      scope.names.set(String(item.name), name)
      tokens.push(name)
    }
  }

  const emitters: Record<string, (node: Fields) => void> = {
    variable: node => {
      // A variable bound by reference, such as `foreach ($items as &$item)` or `use (&$total)`, changes what it writes to.
      if (node.byref) tokens.push('&')
      if (typeof node.name === 'string') tokens.push(variable(node.name))
      else { tokens.push('$$'); walk(node.name) }
    },
    string: node => tokens.push(JSON.stringify(node.value)),
    nowdoc: node => tokens.push(JSON.stringify(node.value)),
    inline: node => tokens.push(JSON.stringify(node.value)),
    boolean: node => tokens.push(String(node.value)),
    number: node => tokens.push(String(node.value)),
    magic: node => tokens.push(String(node.value)),
    name: node => tokens.push(String(node.name)),
    identifier: node => tokens.push(String(node.name)),
    bin: node => infix(node, String(node.type)),
    assign: node => infix(node, String(node.operator)),
    assignref: node => infix(node, '=&'),
    unary: node => { tokens.push(String(node.type)); walk(node.what) },
    pre: node => { tokens.push(`${node.type}${node.type}`); walk(node.what) },
    post: node => { walk(node.what); tokens.push(`${node.type}${node.type}`) },
    cast: node => { tokens.push(`(${node.type})`); walk(node.expr) },
    namedargument: node => { tokens.push(`${node.name}:`); walk(node.value) },
    call,
    new: call,
    propertylookup: member,
    nullsafepropertylookup: member,
    staticlookup: member,
    entry,
    global: globalStatement,
    function: nested,
    method: nested,
    closure: nested,
    arrowfunc: nested,
  }

  function emit(node: Fields): void {
    const emitter = emitters[node.kind]
    if (emitter) emitter(node)
    else {
      if (!wrappers.has(node.kind)) tokens.push(node.kind)
      walk(children(node))
    }
  }

  // Source grouping parentheses stay, so `($a + $b) * $c` differs from `$a + $b * $c`.
  function walk(value: unknown): void {
    if (Array.isArray(value)) {
      for (const item of value) walk(item)
      return
    }
    if (!isSyntax(value)) return
    const node = value as Fields
    const grouped = node.parenthesizedExpression === true
    if (grouped) tokens.push('(')
    emit(node)
    if (grouped) tokens.push(')')
  }

  signatureAndBody(operation as Fields)
  return tokens
}
