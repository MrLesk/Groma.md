import type { ScanDiagnostic, ScanInvocation, ScanOperation } from '@groma/scanner'
import ts from 'typescript'
import { caller, executable, operationName, type Operation } from './functions.ts'
import { relative } from './project.ts'

/** Follow assignment targets, excluding property keys and default-value reads. */
function writesSymbol(target: ts.Node, symbol: ts.Symbol, checker: ts.TypeChecker): boolean {
  if (ts.isIdentifier(target)) return checker.getSymbolAtLocation(target) === symbol
  if (ts.isShorthandPropertyAssignment(target)) return checker.getShorthandAssignmentValueSymbol(target) === symbol
  if (ts.isArrayLiteralExpression(target)) return target.elements.some(item => writesSymbol(item, symbol, checker))
  if (ts.isObjectLiteralExpression(target)) return target.properties.some(item => writesSymbol(item, symbol, checker))
  if (ts.isPropertyAssignment(target)) return writesSymbol(target.initializer, symbol, checker)
  if (ts.isSpreadElement(target) || ts.isSpreadAssignment(target) || ts.isParenthesizedExpression(target)) {
    return writesSymbol(target.expression, symbol, checker)
  }
  if (ts.isBinaryExpression(target) && target.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    return writesSymbol(target.left, symbol, checker)
  }
  return false
}

function assignment(node: ts.Node): node is ts.BinaryExpression {
  return ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
    && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
}

/** React functions that hand back the function they are given: `useCallback`, and the component wrappers `memo` and `forwardRef`. */
const passThrough = new Set(['useCallback', 'memo', 'forwardRef'])

/** The platform a file name states, such as `.web` in `Menu.web.tsx`, or '' for a file every platform shares. */
function platform(file: string, suffixes: readonly string[]): string {
  const stem = file.replace(/\.[cm]?[jt]sx?$/, '')
  return suffixes.find(suffix => stem.endsWith(suffix)) ?? ''
}

export class Evidence {
  readonly operations = new Map<string, ScanOperation>()
  readonly invocations: ScanInvocation[] = []
  readonly diagnostics: ScanDiagnostic[] = []
  private readonly root: string
  private readonly checker: ts.TypeChecker
  private readonly files: Set<ts.SourceFile>
  /** A config with `moduleSuffixes` builds one file per platform, as React Native does, and `.web` names the web's. */
  private readonly platforms: string[]

  /** `readable` holds every source the program reads: components and handlers may live in any of them. */
  constructor(root: string, program: ts.Program, readable: ts.SourceFile[]) {
    this.root = root; this.checker = program.getTypeChecker(); this.files = new Set(readable)
    const suffixes = (program.getCompilerOptions().moduleSuffixes ?? []).filter(suffix => suffix !== '')
    this.platforms = suffixes.length ? [...suffixes, '.web'] : []
  }

  /** One operation per function, shared by callback and HTTP facts; code outside every function is the module's. */
  operationId(node: Operation | ts.SourceFile): string {
    const file = relative(this.root, node.getSourceFile().fileName)
    const position = node.getStart()
    const module = ts.isSourceFile(node)
    const id = `${file}#${module ? 'module' : position}`
    this.operations.set(id, { id, file, name: module ? '(anonymous)' : operationName(node), position })
    return id
  }

  /** Whether a callee is one of React's pass-through functions, imported from 'react' by name or read from its module object. */
  private reactPassThrough(callee: ts.Expression): boolean {
    const member = ts.isPropertyAccessExpression(callee) ? callee.name.text : undefined
    const local = ts.isPropertyAccessExpression(callee) ? callee.expression : callee
    const declaration = ts.isIdentifier(local) ? this.checker.getSymbolAtLocation(local)?.declarations?.[0] : undefined
    const statement = declaration && ts.findAncestor(declaration, ts.isImportDeclaration)
    if (!statement || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== 'react') return false
    const imported = ts.isImportSpecifier(declaration!) ? (declaration.propertyName ?? declaration.name).text : undefined
    return member === undefined ? imported !== undefined && passThrough.has(imported) : imported === undefined && passThrough.has(member)
  }

  /** A function value: the function itself, or the function a React pass-through function is given. */
  private unwrapped(node: ts.Expression, depth: number): Operation | undefined {
    if (executable(node)) return node
    if (!ts.isCallExpression(node) || depth > 4 || !this.reactPassThrough(node.expression)) return undefined
    const [value] = node.arguments
    if (value === undefined) return undefined
    return ts.isIdentifier(value) ? this.functionValue(value, depth + 1) : this.unwrapped(value, depth + 1)
  }

  /** The compiler resolves names and imports; a value is a source function or a `const` holding one. */
  private functionValue(name: ts.Node, depth = 0): Operation | undefined {
    let symbol = this.checker.getSymbolAtLocation(name)
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = this.checker.getAliasedSymbol(symbol)
    const declaration = symbol?.valueDeclaration
    if (!declaration || !this.files.has(declaration.getSourceFile())) return undefined
    if (executable(declaration)) return declaration
    if (ts.isVariableDeclaration(declaration) && declaration.parent.flags & ts.NodeFlags.Const
      && declaration.initializer) return this.unwrapped(declaration.initializer, depth)
    return undefined
  }

  /**
   * Whether a component the compiler resolved belongs to the build of the file that uses it. A platform's file
   * uses its own platform's files, or a shared file beside which that platform has no file of its own.
   */
  private sameBuild(user: ts.SourceFile, used: ts.SourceFile): boolean {
    const own = platform(user.fileName, this.platforms)
    if (own === '') return true
    const theirs = platform(used.fileName, this.platforms)
    if (theirs !== '') return theirs === own
    return !ts.sys.fileExists(used.fileName.replace(/(\.[cm]?[jt]sx?)$/, `${own}$1`))
  }

  private unsupported(node: ts.Node, reason: string): void {
    const source = node.getSourceFile()
    this.diagnostics.push({ severity: 'info', code: 'unsupported-react-binding',
      file: relative(this.root, source.fileName), line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      message: `No supported callback binding: ${reason}.` })
  }

  /** The calls in a component whose callee matches, or undefined when the component writes that value. */
  private calls(component: Operation, symbol: ts.Symbol, callee: (node: ts.Node) => boolean): ts.CallExpression[] | undefined {
    const calls: ts.CallExpression[] = []
    let reassigned = false
    const visit = (node: ts.Node): void => {
      if (assignment(node) && (writesSymbol(node.left, symbol, this.checker) || callee(node.left))) reassigned = true
      if (ts.isForOfStatement(node) && writesSymbol(node.initializer, symbol, this.checker)) reassigned = true
      if (ts.isCallExpression(node) && callee(node.expression)) calls.push(node)
      ts.forEachChild(node, visit)
    }
    visit(component)
    // Mutable callback values are unsupported; symbol identity alone cannot establish their target.
    return reassigned ? undefined : calls
  }

  /**
   * The calls of the props the component reads from its first parameter, by destructuring them (with or without
   * a default) or as members such as `props.onSave()`, narrowed to one `prop` when named; undefined when the
   * component writes one of them.
   */
  private propCalls(component: Operation, prop?: string): ts.CallExpression[] | undefined {
    const parameter = component.parameters[0]
    const named = (name: string) => prop === undefined || name === prop
    if (parameter !== undefined && ts.isIdentifier(parameter.name)) {
      const props = this.checker.getSymbolAtLocation(parameter.name)
      return props === undefined ? [] : this.calls(component, props, node => ts.isPropertyAccessExpression(node)
        && named(node.name.text) && ts.isIdentifier(node.expression) && this.checker.getSymbolAtLocation(node.expression) === props)
    }
    if (parameter === undefined || !ts.isObjectBindingPattern(parameter.name)) return []
    const found = parameter.name.elements.filter(element => !element.dotDotDotToken && named((element.propertyName ?? element.name).getText()))
      .map(element => {
        const symbol = ts.isIdentifier(element.name) ? this.checker.getSymbolAtLocation(element.name) : undefined
        return symbol === undefined ? [] : this.calls(component, symbol, node => ts.isIdentifier(node) && this.checker.getSymbolAtLocation(node) === symbol)
      })
    if (found.includes(undefined)) return undefined
    return found.flatMap(item => item ?? [])
  }

  /**
   * A prop the component calls is a callback interaction: a function supplied in place or named from the
   * sources binds to its calls, and any other value is reported as unsupported. A prop the component never
   * calls is no interaction of this component.
   */
  private binding(component: Operation, attribute: ts.JsxAttribute): void {
    const initializer = attribute.initializer
    if (!initializer || !ts.isJsxExpression(initializer) || !initializer.expression) return
    const prop = attribute.name.getText()
    const calls = this.propCalls(component, prop)
    if (calls?.length === 0) return
    if (calls === undefined) { this.unsupported(attribute, `the component writes ${prop}`); return }
    const expression = initializer.expression
    const target = executable(expression) ? expression : ts.isIdentifier(expression) ? this.functionValue(expression) : undefined
    if (!target) { this.unsupported(attribute, `${prop} receives a value that is not a function the sources define`); return }
    const source = attribute.getSourceFile()
    for (const call of calls) {
      const operation = caller(call)
      if (!operation) continue
      this.invocations.push({ source: this.operationId(operation), targets: [this.operationId(target)], unresolved: false,
        member: prop, position: call.getStart(),
        line: call.getSourceFile().getLineAndCharacterOfPosition(call.getStart()).line + 1,
        binding: { file: relative(this.root, source.fileName), position: attribute.getStart(),
          line: source.getLineAndCharacterOfPosition(attribute.getStart()).line + 1 } })
    }
  }

  private element(node: ts.JsxSelfClosingElement | ts.JsxOpeningElement): void {
    const component = this.functionValue(node.tagName)
    // A component the compiler resolved for another platform's build is not this file's.
    if (!component || !this.sameBuild(node.getSourceFile(), component.getSourceFile())) return
    if (node.attributes.properties.some(ts.isJsxSpreadAttribute)) {
      if (this.propCalls(component)?.length !== 0) this.unsupported(node, 'a spread may supply a prop the component calls')
      return
    }
    for (const attribute of node.attributes.properties) if (ts.isJsxAttribute(attribute)) this.binding(component, attribute)
  }

  inspect(node: ts.Node): void {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) this.element(node)
    ts.forEachChild(node, child => this.inspect(child))
  }
}
