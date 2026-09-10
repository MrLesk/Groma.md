import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { createScanObservation, type ScanDiagnostic, type ScanInvocation, type ScanOperation } from '@groma/scanner'
import ts from 'typescript'

function relative(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/')
}

function failDiagnostics(diagnostics: readonly ts.Diagnostic[]): void {
  const errors = diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(errors.map(item => `${item.file?.fileName ?? 'React'}: ${ts.flattenDiagnosticMessageText(item.messageText, '\n')}`).join('\n'))
}

function reactProject(root: string) {
  const manifestFile = path.join(root, 'package.json')
  if (!existsSync(manifestFile)) return undefined
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
  if (!manifest.dependencies?.react && !manifest.devDependencies?.react) return undefined
  try {
    createRequire(manifestFile).resolve('react')
    const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
    if (config.error) failDiagnostics([config.error])
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
    failDiagnostics(parsed.errors)
    const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true })
    const sources = program.getSourceFiles().filter(source => {
      const file = relative(root, source.fileName)
      return file.endsWith('.tsx') && !source.isDeclarationFile && !file.startsWith('../') && !file.includes('node_modules/')
    })
    if (!sources.length) throw new Error('The root tsconfig.json must include React TSX source files.')
    const react = ts.resolveModuleName('react', sources[0]!.fileName, parsed.options, ts.sys).resolvedModule
    if (!react?.resolvedFileName.endsWith('.d.ts')) throw new Error('Install @types/react in the project.')
    failDiagnostics(program.getOptionsDiagnostics())
    failDiagnostics(program.getSyntacticDiagnostics())
    for (const source of sources) failDiagnostics(program.getSemanticDiagnostics(source))
    return { manifest, program, sources }
  } catch (error) {
    throw new Error(`REACT_PROJECT_PREPARATION: Install the project dependencies with its declared package manager and lockfile; provide a valid root tsconfig.json and type-correct TSX files. ${error}`)
  }
}

type Operation = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction

function executable(node: ts.Node): node is Operation {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node) || (ts.isFunctionDeclaration(node) && !!node.body)
}

function caller(node: ts.Node): Operation | undefined {
  for (let parent = node.parent; parent; parent = parent.parent) if (executable(parent)) return parent
  return undefined
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

  private operation(node: Operation): string {
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
      message: `${relative(this.root, source.fileName)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}: No supported direct component prop-to-handler binding.` })
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
    function visit(node: ts.Node): void {
      if (ts.isBinaryExpression(node) && ts.isIdentifier(node.left)
        && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
        && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
        && checker.getSymbolAtLocation(node.left) === symbol) reassigned = true
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
      this.invocations.push({ source: this.operation(operation), targets: [this.operation(target)], unresolved: false,
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
  if (!reactProject(root)) throw new Error('REACT_PROJECT_REQUIRED: Select a project with React in its root package.json, or disable the react scanner.')
}

export async function scanReact(root: string) {
  const project = reactProject(root)
  if (!project) return undefined
  const { manifest, program, sources } = project
  const evidence = new Evidence(root, program.getTypeChecker(), sources)
  for (const source of sources) evidence.inspect(source)
  const files = sources.map(source => ({ file: relative(root, source.fileName), symbols: [] }))
  return createScanObservation({ scanner: { language: 'react', engine: 'typescript', engineVersion: ts.version },
    root: { kind: 'package', name: manifest.name, file: 'package.json' },
    scopes: [{ id: 'react-project', name: manifest.name }], files,
    placements: files.map(({ file }) => ({ file, scope: 'react-project' })), relationships: [],
    operations: [...evidence.operations.values()], invocations: evidence.invocations, diagnostics: evidence.diagnostics })
}
