import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { Call, PropertyRead, TmplAstRecursiveVisitor, tmplAstVisitAll, type TmplAstBoundEvent } from '@angular/compiler'
import { createCompilerHost, NgtscProgram, readConfiguration, VERSION } from '@angular/compiler-cli'
import { createScanObservation, type ScanDiagnostic, type ScanInvocation, type ScanObservation, type ScanOperation } from '@groma/scanner'
import ts from 'typescript'

type TemplateChecker = ReturnType<NgtscProgram['compiler']['getTemplateTypeChecker']>

function relative(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/')
}

function owned(root: string, source: ts.SourceFile): boolean {
  return !source.isDeclarationFile && !relative(root, source.fileName).startsWith('../')
    && !source.fileName.includes('/node_modules/') && !source.fileName.endsWith('.ngtypecheck.ts')
}

function failDiagnostics(diagnostics: readonly ts.Diagnostic[]): void {
  const errors = diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(errors.map(item => {
    const file = item.file?.fileName ?? 'Angular'
    return `${file}: ${ts.flattenDiagnosticMessageText(item.messageText, '\n')}`
  }).join('\n'))
}

function enclosingOperation(node: ts.Node): ts.Node | undefined {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current) || ts.isMethodDeclaration(current)
      || ts.isFunctionDeclaration(current)) return current
  }
  return undefined
}

function operationName(node: ts.Node): string {
  if (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) return node.name?.getText() ?? 'function'
  return `callback at ${node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1}`
}

/** Angular proves the bound output property; TypeScript locates calls on that exact declaration. */
function outputEmissions(declaration: ts.Declaration, checker: ts.TypeChecker): ts.CallExpression[] {
  if (!ts.isPropertyDeclaration(declaration) || !ts.isClassDeclaration(declaration.parent)) return []
  const calls: ts.CallExpression[] = []
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'emit') {
      const receiver = checker.getSymbolAtLocation(node.expression.expression)
      if (receiver?.declarations?.includes(declaration)) calls.push(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(declaration.parent)
  return calls
}

class BindingVisitor extends TmplAstRecursiveVisitor {
  private readonly inspect: (event: TmplAstBoundEvent) => void
  constructor(inspect: (event: TmplAstBoundEvent) => void) { super(); this.inspect = inspect }
  override visitBoundEvent(event: TmplAstBoundEvent): void { this.inspect(event) }
}

class Evidence {
  readonly operations = new Map<string, ScanOperation>()
  readonly invocations: ScanInvocation[] = []
  readonly diagnostics: ScanDiagnostic[] = []
  readonly templates = new Set<string>()

  private readonly root: string
  private readonly templatesChecker: TemplateChecker
  private readonly checker: ts.TypeChecker
  constructor(root: string, templatesChecker: TemplateChecker, checker: ts.TypeChecker) {
    this.root = root
    this.templatesChecker = templatesChecker
    this.checker = checker
  }

  private operation(node: ts.Node): string {
    const source = node.getSourceFile()
    const file = relative(this.root, source.fileName)
    const position = node.getStart()
    const id = `${file}#${position}`
    this.operations.set(id, { id, file, name: operationName(node), position })
    return id
  }

  private unsupported(event: TmplAstBoundEvent, template: string): void {
    this.diagnostics.push({ severity: 'info', code: 'unsupported-angular-binding',
      message: `${template}:${event.sourceSpan.start.line + 1}: ${event.name} has no supported unique source output-to-method binding.` })
  }

  inspect(event: TmplAstBoundEvent, component: ts.ClassDeclaration, template: string): void {
    const output = this.templatesChecker.getSymbolOfNode(event, component)
    const handler = event.handler instanceof Call ? event.handler : ('ast' in event.handler ? event.handler.ast : event.handler)
    if (!output || !('bindings' in output) || output.bindings.length !== 1
      || !(handler instanceof Call) || !(handler.receiver instanceof PropertyRead)) {
      this.unsupported(event, template)
      return
    }
    const binding = output.bindings[0]!
    const outputDeclaration = this.templatesChecker.getTsSymbolOfSymbol(binding)?.valueDeclaration
    const handlerSymbol = this.templatesChecker.getSymbolOfNode(handler.receiver, component)
    const target = handlerSymbol && this.templatesChecker.getTsSymbolOfSymbol(handlerSymbol)?.valueDeclaration
    if (!outputDeclaration || !target || !ts.isMethodDeclaration(target) || !target.body
      || !owned(this.root, target.getSourceFile()) || !owned(this.root, outputDeclaration.getSourceFile())) {
      this.unsupported(event, template)
      return
    }
    const calls = outputEmissions(outputDeclaration, this.checker)
    if (!calls.length) this.unsupported(event, template)
    for (const call of calls) {
      const caller = enclosingOperation(call)
      if (!caller) continue
      this.invocations.push({ source: this.operation(caller), targets: [this.operation(target)], unresolved: false,
        member: event.name, line: call.getSourceFile().getLineAndCharacterOfPosition(call.getStart()).line + 1,
        position: call.getStart(), binding: { file: template, line: event.sourceSpan.start.line + 1,
          position: event.sourceSpan.start.offset } })
    }
  }
}

function angularProject(root: string) {
  const manifestPath = path.join(root, 'package.json')
  if (!existsSync(manifestPath)) return undefined
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (!manifest.dependencies?.['@angular/core'] && !manifest.devDependencies?.['@angular/core']) return undefined
  try {
    const config = readConfiguration(path.join(root, 'tsconfig.json'))
    failDiagnostics(config.errors)
    const options = { ...config.options, noEmit: true, strictTemplates: true, _enableTemplateTypeChecker: true }
    const ng = new NgtscProgram(config.rootNames, options, createCompilerHost({ options }))
    failDiagnostics(ng.getTsSyntacticDiagnostics())
    failDiagnostics(ng.getNgOptionDiagnostics())
    failDiagnostics(ng.getNgSemanticDiagnostics())
    return { manifest, ng }
  } catch (error) {
    throw new Error(`ANGULAR_PROJECT_PREPARATION: Install the project dependencies with its declared package manager and lockfile, and ensure tsconfig.json is valid. ${error}`)
  }
}

export async function checkAngularReadiness(root: string): Promise<void> {
  if (!angularProject(root)) throw new Error('ANGULAR_PROJECT_REQUIRED: Select a project with @angular/core in its root package.json, or disable the angular scanner.')
}

export async function scanAngular(root: string): Promise<ScanObservation | undefined> {
  const project = angularProject(root)
  if (!project) return undefined
  const { manifest, ng } = project
  const program: ts.Program = ng.getTsProgram()
  const templateChecker = ng.compiler.getTemplateTypeChecker()
  const evidence = new Evidence(root, templateChecker, program.getTypeChecker())
  const sources = program.getSourceFiles().filter(source => owned(root, source))
  for (const source of sources) {
    for (const component of source.statements.filter(ts.isClassDeclaration)) {
      const template = templateChecker.getTemplate(component)
      const resource = ng.compiler.getDirectiveResources(component)?.template
      if (!template || !resource?.path) continue
      const file = relative(root, resource.path)
      evidence.templates.add(file)
      tmplAstVisitAll(new BindingVisitor(event => evidence.inspect(event, component, file)), template)
    }
  }
  const files = [...sources.map(source => ({ file: relative(root, source.fileName),
    symbols: source.statements.filter(ts.isClassDeclaration).map(node => ({
      id: `${relative(root, source.fileName)}#${node.getStart()}`, name: node.name?.text ?? 'default', kind: 'class',
    })) })), ...[...evidence.templates].map(file => ({ file, symbols: [] }))]
  return createScanObservation({ scanner: { language: 'angular', engine: '@angular/compiler-cli', engineVersion: VERSION.full },
    root: { kind: 'package', name: manifest.name, file: 'package.json' },
    scopes: [{ id: 'angular-project', name: manifest.name }],
    files, placements: files.map(({ file }) => ({ file, scope: 'angular-project' })), relationships: [],
    operations: [...evidence.operations.values()], invocations: evidence.invocations, diagnostics: evidence.diagnostics })
}
