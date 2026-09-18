import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { Call, ImplicitReceiver, PropertyRead, CssSelector, SelectorMatcher, TmplAstRecursiveVisitor, tmplAstVisitAll, parseTemplate, type TmplAstElement, type TmplAstBoundEvent } from '@angular/compiler'
import { readConfiguration, VERSION } from '@angular/compiler-cli'
import { createScanObservation, type ScanDiagnostic, type ScanInvocation, type ScanObservation, type ScanOperation } from '@groma/scanner'
import ts from 'typescript'
import { frameworkProjects, hasDependency } from '../../projects.ts'
import { combineObservations } from '../../observations.ts'
import { componentImports, sourceComponent, sourceOutput, type SourceComponent } from './components.ts'
import { angularHttpRequests } from './http.ts'

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

/** TypeScript binds local property access independently of external Angular declarations. */
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
  private readonly inspect: (element: TmplAstElement) => void
  constructor(inspect: (element: TmplAstElement) => void) { super(); this.inspect = inspect }
  override visitElement(element: TmplAstElement): void { this.inspect(element); super.visitElement(element) }
}

class Evidence {
  readonly operations = new Map<string, ScanOperation>()
  readonly invocations: ScanInvocation[] = []
  readonly diagnostics: ScanDiagnostic[] = []
  readonly templates = new Set<string>()

  private readonly root: string
  private readonly checker: ts.TypeChecker
  constructor(root: string, checker: ts.TypeChecker) {
    this.root = root
    this.checker = checker
  }

  /** One operation per function, shared by binding and HTTP facts. */
  operationId(node: ts.Node): string {
    const source = node.getSourceFile()
    const file = relative(this.root, source.fileName)
    const position = node.getStart()
    const id = `${file}#${position}`
    this.operations.set(id, { id, file, name: operationName(node), position })
    return id
  }

  private unsupported(event: TmplAstBoundEvent, template: string): void {
    this.diagnostics.push({ severity: 'info', code: 'unsupported-angular-binding',
      file: template, line: event.sourceSpan.start.line + 1,
      message: `${event.name} has no supported unique source output-to-method binding.` })
  }

  inspect(event: TmplAstBoundEvent, child: SourceComponent | undefined, component: ts.ClassDeclaration, template: string): void {
    const handler = event.handler instanceof Call ? event.handler : ('ast' in event.handler ? event.handler.ast : event.handler)
    if (!child || !(handler instanceof Call) || !(handler.receiver instanceof PropertyRead)
      || !(handler.receiver.receiver instanceof ImplicitReceiver)) {
      this.unsupported(event, template)
      return
    }
    const outputDeclaration = sourceOutput(child, event.name, this.checker)
    const target = this.checker.getTypeAtLocation(component).getProperty(handler.receiver.name)?.valueDeclaration
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
      this.invocations.push({ source: this.operationId(caller), targets: [this.operationId(target)], unresolved: false,
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
  if (!hasDependency(manifest, '@angular/core')) return undefined
  try {
    const config = readConfiguration(path.join(root, 'tsconfig.json'))
    failDiagnostics(config.errors)
    const program = ts.createProgram(config.rootNames, { ...config.options, noEmit: true } as ts.CompilerOptions)
    failDiagnostics(program.getSyntacticDiagnostics())
    return { manifest, program }
  } catch (error) {
    throw new Error(`ANGULAR_SOURCE_INVALID: Check the project tsconfig.json and TypeScript syntax. ${error}`)
  }
}

export async function checkAngularReadiness(root: string): Promise<void> {
  const projects = await frameworkProjects(root, '@angular/core', ['.ts'])
  for (const project of projects) angularProject(project)
}

export async function scanAngular(root: string): Promise<ScanObservation | undefined> {
  const parts = []
  for (const project of await frameworkProjects(root, '@angular/core', ['.ts'])) {
    const observation = await scanAngularProject(project, root)
    if (observation) parts.push({ key: relative(root, project), observation })
  }
  return combineObservations(parts)
}

async function scanAngularProject(projectRoot: string, root: string): Promise<ScanObservation | undefined> {
  const project = angularProject(projectRoot)
  if (!project) return undefined
  const { manifest, program } = project
  const checker = program.getTypeChecker()
  const evidence = new Evidence(root, checker)
  const sources = program.getSourceFiles().filter(source => owned(root, source))
  const components = sources.flatMap(source => source.statements.filter(ts.isClassDeclaration)
    .flatMap(node => sourceComponent(node, checker) ?? []))
  for (const component of components) inspectTemplate(root, component, components, checker, evidence)
  const httpRequests = await angularHttpRequests(sources, checker, call => {
    const caller = enclosingOperation(call)
    return caller === undefined ? undefined : evidence.operationId(caller)
  })
  const files = [...sources.map(source => ({ file: relative(root, source.fileName),
    symbols: source.statements.filter(ts.isClassDeclaration).map(node => ({
      id: `${relative(root, source.fileName)}#${node.getStart()}`, name: node.name?.text ?? 'default', kind: 'class',
    })) })), ...[...evidence.templates].map(file => ({ file, symbols: [] }))]
  const sourceUnits = components.map(component => {
    const primary = relative(root, component.declaration.getSourceFile().fileName)
    const companions = [component.template, ...component.styles].flatMap(resource => {
      if (resource === undefined) return []
      const file = componentResource(root, component, resource)
      if (file === undefined) return []
      readFileSync(path.join(root, file), 'utf8')
      return [file]
    })
    return { primary, files: [primary, ...companions] }
  })
  for (const file of new Set(sourceUnits.flatMap(unit => unit.files))) {
    if (!files.some(source => source.file === file)) files.push({ file, symbols: [] })
  }
  return createScanObservation({ scanner: { id: 'angular', technology: 'typescript/angular', engine: '@angular/compiler-cli', engineVersion: VERSION.full },
    roots: [{ id: 'angular-project', kind: 'package', name: manifest.name, file: relative(root, path.join(projectRoot, 'package.json')) }],
    files: files.map(file => ({ ...file, roots: ['angular-project'] })),
    sourceUnits,
    operations: [...evidence.operations.values()], invocations: evidence.invocations, diagnostics: evidence.diagnostics,
    ...(httpRequests.length ? { httpRequests } : {}) })
}

function componentResource(root: string, component: SourceComponent, resource: string): string | undefined {
  if (path.isAbsolute(resource) || /^[a-z][a-z0-9+.-]*:/i.test(resource)) return undefined
  const file = relative(root, path.resolve(path.dirname(component.declaration.getSourceFile().fileName), resource))
  return file.startsWith('../') ? undefined : file
}

function inspectTemplate(root: string, component: SourceComponent, components: SourceComponent[], checker: ts.TypeChecker, evidence: Evidence): void {
  if (!component.template) return
  const file = componentResource(root, component, component.template)
  if (file === undefined) return
  const parsed = parseTemplate(readFileSync(path.join(root, file), 'utf8'), file)
  if (parsed.errors?.length) throw new Error(`ANGULAR_TEMPLATE_INVALID: ${parsed.errors.join('\n')}`)
  evidence.templates.add(file)
  const imports = componentImports(component, checker)
  const matcher = new SelectorMatcher<SourceComponent>()
  for (const child of components.filter(item => imports.has(item.declaration))) {
    matcher.addSelectables(CssSelector.parse(child.selector), child)
  }
  tmplAstVisitAll(new BindingVisitor(element => {
    const selector = new CssSelector()
    selector.setElement(element.name)
    for (const attribute of element.attributes) selector.addAttribute(attribute.name, attribute.value)
    for (const input of element.inputs) selector.addAttribute(input.name, '')
    const matches = new Set<SourceComponent>()
    matcher.match(selector, (_selector, child) => matches.add(child))
    const child = matches.size === 1 ? [...matches][0] : undefined
    for (const event of element.outputs) evidence.inspect(event, child, component.declaration, file)
  }), parsed.nodes)
}
