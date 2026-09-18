import ts from 'typescript'

/*
 * What a name means inside one parsed file. The scanner reads a file alone, so a name it cannot
 * resolve here comes from somewhere it cannot see, which the shared value reader treats as a
 * configuration value. A name this file declares but does not bind to a constant stays computed.
 */

/** Where a name comes from, so a client is recognized by its import and never by a member name. */
export interface ModuleOrigin {
  module: string
  /** The imported name: `default` or the exported name. */
  name: string
}

/** A fabricated symbol: the shared value reader needs only the declaration behind a name. */
interface NameSymbol {
  flags: number
  valueDeclaration: ts.Node
}

export interface FileScope {
  /** The checker the shared URL reader expects, resolving names inside this file only. */
  checker: {
    getSymbolAtLocation(node: ts.Node): NameSymbol | undefined
    getAliasedSymbol(symbol: NameSymbol): NameSymbol
  }
  /** The declaration a name refers to at this position, or undefined when the file does not declare it. */
  declarationOf(node: ts.Node): ts.Node | undefined
  /** True when the file assigns this name again, so its value is not the one its declaration states. */
  reassigns(name: string): boolean
  originOf(node: ts.Node): ModuleOrigin | undefined
}

/** The module a `require('name')` call reads. */
export function requiredModule(node: ts.Node): string | undefined {
  if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || node.expression.text !== 'require') return undefined
  const [specifier] = node.arguments
  return specifier !== undefined && ts.isStringLiteral(specifier) ? specifier.text : undefined
}

function bindsName(name: ts.BindingName, wanted: string): ts.Identifier | undefined {
  if (ts.isIdentifier(name)) return name.text === wanted ? name : undefined
  let found: ts.Identifier | undefined
  const visit = (node: ts.Node): void => {
    if (ts.isBindingElement(node) && ts.isIdentifier(node.name) && node.name.text === wanted) found = node.name
    else ts.forEachChild(node, visit)
  }
  visit(name)
  return found
}

/**
 * The declaration to report for a name a declaration binds. A destructured name is reported as its
 * own identifier, because the declaration's initializer is the whole object, not that name's value.
 */
function declarationFor(
  declaration: ts.VariableDeclaration | ts.ParameterDeclaration, wanted: string,
): ts.Node | undefined {
  const bound = bindsName(declaration.name, wanted)
  if (bound === undefined) return undefined
  return ts.isIdentifier(declaration.name) ? declaration : bound
}

function statementDeclaration(statement: ts.Statement, wanted: string): ts.Node | undefined {
  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      const found = declarationFor(declaration, wanted)
      if (found !== undefined) return found
    }
    return undefined
  }
  if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
    return statement.name?.text === wanted ? statement : undefined
  }
  return undefined
}

function scopeDeclaration(scope: ts.Node, wanted: string): ts.Node | undefined {
  if (ts.isFunctionLike(scope)) {
    for (const parameter of scope.parameters) {
      const found = declarationFor(parameter, wanted)
      if (found !== undefined) return found
    }
  }
  if (ts.isSourceFile(scope) || ts.isBlock(scope) || ts.isModuleBlock(scope)) {
    for (const statement of scope.statements) {
      const found = statementDeclaration(statement, wanted)
      if (found !== undefined) return found
    }
  }
  return undefined
}

/** The name one import clause binds: a default and a namespace both stand for the module itself. */
function clauseBinding(clause: ts.ImportClause, wanted: string): string | undefined {
  if (clause.name?.text === wanted) return 'default'
  const bindings = clause.namedBindings
  if (bindings === undefined) return undefined
  if (ts.isNamespaceImport(bindings)) return bindings.name.text === wanted ? 'default' : undefined
  const element = bindings.elements.find(entry => entry.name.text === wanted)
  return element === undefined ? undefined : (element.propertyName ?? element.name).text
}

/** ESM bindings this file introduces; an imported value lives in another file the scanner cannot read. */
function importOrigin(source: ts.SourceFile, wanted: string): ModuleOrigin | undefined {
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue
    const name = clauseBinding(statement.importClause, wanted)
    if (name !== undefined) return { module: statement.moduleSpecifier.text, name }
  }
  return undefined
}

/** `const { Export } = require('m')`, where the destructured name is reported as its own binding. */
function destructuredRequire(element: ts.BindingElement, wanted: string): ModuleOrigin | undefined {
  const variable = element.parent.parent
  const module = ts.isVariableDeclaration(variable) && variable.initializer
    ? requiredModule(variable.initializer) : undefined
  if (module === undefined) return undefined
  const name = element.propertyName && ts.isIdentifier(element.propertyName) ? element.propertyName.text : wanted
  return { module, name }
}

/** `const name = require('m')`, `const name = require('m').Export` and `const { Export } = require('m')`. */
function requireOrigin(declaration: ts.Node, wanted: string): ModuleOrigin | undefined {
  if (ts.isIdentifier(declaration) && ts.isBindingElement(declaration.parent)) {
    return destructuredRequire(declaration.parent, wanted)
  }
  if (!ts.isVariableDeclaration(declaration) || declaration.initializer === undefined) return undefined
  const initializer = declaration.initializer
  const direct = requiredModule(initializer)
  if (direct !== undefined) return { module: direct, name: 'default' }
  if (!ts.isPropertyAccessExpression(initializer)) return undefined
  const module = requiredModule(initializer.expression)
  return module === undefined ? undefined : { module, name: initializer.name.text }
}

function assignedNames(source: ts.SourceFile): Set<string> {
  const names = new Set<string>()
  const record = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) names.add(node.text)
  }
  const counts = (operator: ts.SyntaxKind) =>
    operator === ts.SyntaxKind.PlusPlusToken || operator === ts.SyntaxKind.MinusMinusToken
  const visit = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
      && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) record(node.left)
    if ((ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node)) && counts(node.operator)) record(node.operand)
    if (ts.isForOfStatement(node) || ts.isForInStatement(node)) record(node.initializer)
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(source, visit)
  return names
}

/**
 * Every name this file binds, whatever scope form declares it, each held by its own identifier. A
 * declaration the lexical lookup does not read is reported through this map, so a name the file
 * declares is never mistaken for a value that comes from outside the file.
 */
function boundNames(source: ts.SourceFile): Map<string, ts.Identifier> {
  const names = new Map<string, ts.Identifier>()
  const bind = (name: ts.Node | undefined): void => {
    if (name === undefined) return
    if (ts.isIdentifier(name)) names.set(name.text, name)
    else ts.forEachChild(name, child => bind(child))
  }
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) bind(node.name)
    if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) bind(node.name)
    if (ts.isCatchClause(node)) bind(node.variableDeclaration?.name)
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(source, visit)
  return names
}

/** Read one file's names: what each one declares, which ones it reassigns, and where each comes from. */
export function fileScope(source: ts.SourceFile): FileScope {
  const assigned = assignedNames(source)
  const bound = boundNames(source)
  function declarationOf(node: ts.Node): ts.Node | undefined {
    if (!ts.isIdentifier(node)) return undefined
    for (let scope: ts.Node | undefined = node.parent; scope; scope = scope.parent) {
      const found = scopeDeclaration(scope, node.text)
      if (found !== undefined) return found
    }
    return bound.get(node.text)
  }
  return {
    checker: {
      getSymbolAtLocation(node: ts.Node) {
        const declaration = declarationOf(node)
        return declaration === undefined ? undefined : { flags: 0, valueDeclaration: declaration }
      },
      getAliasedSymbol(symbol: NameSymbol) {
        return symbol
      },
    },
    declarationOf,
    reassigns: name => assigned.has(name),
    originOf(node: ts.Node) {
      if (!ts.isIdentifier(node)) return undefined
      const imported = importOrigin(source, node.text)
      if (imported !== undefined) return imported
      const declaration = declarationOf(node)
      return declaration === undefined ? undefined : requireOrigin(declaration, node.text)
    },
  }
}
