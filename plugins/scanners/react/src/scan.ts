import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createScanObservation, type ScanDiagnostic, type ScanInvocation, type ScanOperation } from '@groma/scanner'
import ts from 'typescript'
import { frameworkProjects, hasDependency } from '../../projects.ts'
import { combineObservations } from '../../observations.ts'
import { executable, type Operation } from './functions.ts'
import { reactHttpRequests } from './http.ts'
import { nextRouteEndpoints, nextRouters, routeLocation } from './routes.ts'

function relative(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/')
}

function failDiagnostics(diagnostics: readonly ts.Diagnostic[]): void {
  const errors = diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(errors.map(item => `${item.file?.fileName ?? 'React'}: ${ts.flattenDiagnosticMessageText(item.messageText, '\n')}`).join('\n'))
}

function reactProject(root: string, repositoryRoot = root) {
  const manifestFile = path.join(root, 'package.json')
  if (!existsSync(manifestFile)) return undefined
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
  if (!hasDependency(manifest, 'react')) return undefined
  try {
    const configFile = path.join(root, 'tsconfig.json')
    const config = ts.readConfigFile(configFile, ts.sys.readFile)
    if (config.error) failDiagnostics([config.error])
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, undefined, configFile)
    failDiagnostics(parsed.errors)
    const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true })
    const owned = program.getSourceFiles().filter(source => {
      const file = relative(repositoryRoot, source.fileName)
      return !source.isDeclarationFile && !file.startsWith('../') && !file.includes('node_modules/')
    })
    const sources = owned.filter(source => source.fileName.endsWith('.tsx'))
    if (!sources.length) throw new Error('The project tsconfig.json must include React TSX source files.')
    // Next.js declares endpoints by file location, so a Next.js project's route files are read besides
    // the components. Another server's files in the same places serve paths of its own.
    const routers = nextRouters(root)
    const routes = hasDependency(manifest, 'next')
      ? owned.filter(source => routeLocation(relative(root, source.fileName), routers) !== undefined) : []
    failDiagnostics(program.getSyntacticDiagnostics())
    return { manifest, program, owned, sources, routes, routers }
  } catch (error) {
    throw new Error(`REACT_SOURCE_INVALID: Check the project tsconfig.json and TSX syntax. ${error}`)
  }
}

function caller(node: ts.Node): Operation | undefined {
  for (let parent = node.parent; parent; parent = parent.parent) if (executable(parent)) return parent
  return undefined
}

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

class Evidence {
  readonly operations = new Map<string, ScanOperation>()
  readonly invocations: ScanInvocation[] = []
  readonly diagnostics: ScanDiagnostic[] = []
  private readonly root: string
  private readonly checker: ts.TypeChecker
  private readonly files: Set<ts.SourceFile>

  constructor(root: string, checker: ts.TypeChecker, sources: ts.SourceFile[]) {
    this.root = root; this.checker = checker; this.files = new Set(sources)
  }

  /** One operation per function, shared by callback and HTTP facts. */
  operationId(node: Operation): string {
    const file = relative(this.root, node.getSourceFile().fileName)
    const position = node.getStart()
    const id = `${file}#${position}`
    const name = node.name?.text ?? (ts.isVariableDeclaration(node.parent) ? node.parent.name.getText() : 'callback')
    this.operations.set(id, { id, file, name, position })
    return id
  }

  /** The compiler resolves names and imports; only direct source function values are supported. */
  private functionValue(name: ts.Node): Operation | undefined {
    let symbol = this.checker.getSymbolAtLocation(name)
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = this.checker.getAliasedSymbol(symbol)
    const declaration = symbol?.valueDeclaration
    if (!declaration || !this.files.has(declaration.getSourceFile())) return undefined
    if (executable(declaration)) return declaration
    if (ts.isVariableDeclaration(declaration) && declaration.parent.flags & ts.NodeFlags.Const
      && declaration.initializer && executable(declaration.initializer)) return declaration.initializer
    return undefined
  }

  private unsupported(node: ts.Node): void {
    const source = node.getSourceFile()
    this.diagnostics.push({ severity: 'info', code: 'unsupported-react-binding',
      file: relative(this.root, source.fileName), line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      message: 'No supported direct component prop-to-handler binding.' })
  }

  private propCalls(component: Operation, attribute: ts.JsxAttribute): ts.CallExpression[] {
    const parameter = component.parameters[0]
    if (!parameter || !ts.isObjectBindingPattern(parameter.name)) return []
    const binding = parameter.name.elements.find(element => !element.dotDotDotToken && !element.initializer
      && (element.propertyName ?? element.name).getText() === attribute.name.getText())
    if (!binding || !ts.isIdentifier(binding.name)) return []
    const symbol = this.checker.getSymbolAtLocation(binding.name)
    if (!symbol) return []
    const calls: ts.CallExpression[] = []
    let reassigned = false
    const checker = this.checker
    const visit = (node: ts.Node): void => {
      if (ts.isBinaryExpression(node)
        && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
        && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
        && writesSymbol(node.left, symbol, checker)) reassigned = true
      if (ts.isForOfStatement(node) && writesSymbol(node.initializer, symbol, checker)) reassigned = true
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
        && checker.getSymbolAtLocation(node.expression) === symbol) calls.push(node)
      ts.forEachChild(node, visit)
    }
    visit(component)
    // Mutable callback values are unsupported; symbol identity alone cannot establish their target.
    return reassigned ? [] : calls
  }

  private binding(component: Operation, attribute: ts.JsxAttribute): void {
    const initializer = attribute.initializer
    if (!initializer || !ts.isJsxExpression(initializer) || !initializer.expression) return
    const expression = initializer.expression
    if (!this.checker.getTypeAtLocation(expression).getCallSignatures().length) return
    const target = ts.isIdentifier(expression) ? this.functionValue(expression) : undefined
    const calls = this.propCalls(component, attribute)
    if (!target || !calls.length) { this.unsupported(attribute); return }
    const source = attribute.getSourceFile()
    for (const call of calls) {
      const operation = caller(call)
      if (!operation) continue
      this.invocations.push({ source: this.operationId(operation), targets: [this.operationId(target)], unresolved: false,
        member: attribute.name.getText(), position: call.getStart(),
        line: call.getSourceFile().getLineAndCharacterOfPosition(call.getStart()).line + 1,
        binding: { file: relative(this.root, source.fileName), position: attribute.getStart(),
          line: source.getLineAndCharacterOfPosition(attribute.getStart()).line + 1 } })
    }
  }

  private element(node: ts.JsxSelfClosingElement | ts.JsxOpeningElement): void {
    const component = this.functionValue(node.tagName)
    if (!component) return
    if (node.attributes.properties.some(ts.isJsxSpreadAttribute)) { this.unsupported(node); return }
    for (const attribute of node.attributes.properties) if (ts.isJsxAttribute(attribute)) this.binding(component, attribute)
  }

  inspect(node: ts.Node): void {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) this.element(node)
    ts.forEachChild(node, child => this.inspect(child))
  }
}

export async function checkReactReadiness(root: string): Promise<void> {
  const projects = await frameworkProjects(root, 'react', ['.tsx'])
  for (const project of projects) reactProject(project, root)
}

export async function scanReact(root: string) {
  const parts = []
  for (const project of await frameworkProjects(root, 'react', ['.tsx'])) {
    const observation = await scanReactProject(project, root)
    if (observation) parts.push({ key: relative(root, project), observation })
  }
  return combineObservations(parts)
}

async function scanReactProject(projectRoot: string, root: string) {
  const project = reactProject(projectRoot, root)
  if (!project) return undefined
  const { manifest, program, owned, sources, routes, routers } = project
  const evidence = new Evidence(root, program.getTypeChecker(), sources)
  for (const source of sources) evidence.inspect(source)
  const httpRequests = await reactHttpRequests(sources, owned, program.getTypeChecker(), call => {
    const operation = caller(call)
    return operation === undefined ? undefined : evidence.operationId(operation)
  })
  const httpEndpoints = nextRouteEndpoints(routes, projectRoot, routers, handler => evidence.operationId(handler))
  const files = [...new Set([...sources, ...routes].map(source => relative(root, source.fileName)))]
    .map(file => ({ file, symbols: [] }))
  return createScanObservation({ scanner: { id: 'react', technology: 'typescript/react', engine: 'typescript-sdk', engineVersion: ts.version },
    roots: [{ id: 'react-project', kind: 'package', name: manifest.name, file: relative(root, path.join(projectRoot, 'package.json')) }],
    files: files.map(file => ({ ...file, roots: ['react-project'] })),
    operations: [...evidence.operations.values()], invocations: evidence.invocations, diagnostics: evidence.diagnostics,
    ...(httpEndpoints.length ? { httpEndpoints } : {}), ...(httpRequests.length ? { httpRequests } : {}) })
}
