import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ASTWithSource, Call, CssSelector, ImplicitReceiver, PropertyRead, RecursiveAstVisitor, SelectorMatcher, ThisReceiver,
  TmplAstRecursiveVisitor, parseTemplate, tmplAstVisitAll, type AST, type TmplAstBoundEvent, type TmplAstElement, type TmplAstNode } from '@angular/compiler'
import type { ScanSourceUnit } from '@groma/scanner'
import ts from 'typescript'
import { directiveImports, EMITS, outputEmissions, sourceOutput, type SourceDirective } from './directives.ts'
import { enclosingOperation, type Evidence } from './evidence.ts'
import { relative } from './project.ts'

/** A parsed template: the repository file that holds its text, the text, and nodes whose offsets are file offsets. */
interface ParsedTemplate { file: string; text: string; nodes: TmplAstNode[] }

/** A local resource a component names: a path relative to its class file, inside the repository. */
function componentResource(root: string, directive: SourceDirective, resource: string): string | undefined {
  if (path.isAbsolute(resource) || /^[a-z][a-z0-9+.-]*:/i.test(resource)) return undefined
  const file = relative(root, path.resolve(path.dirname(directive.declaration.getSourceFile().fileName), resource))
  return file.startsWith('../') ? undefined : file
}

/**
 * A named resource outside the scanner's files, such as one the checkout lacks, leaves the component without it rather
 * than failing the scan.
 */
function missingResource(evidence: Evidence, root: string, directive: SourceDirective, resource: string): void {
  const source = directive.declaration.getSourceFile()
  evidence.diagnostics.push({ severity: 'warning', code: 'angular-missing-resource', file: relative(root, source.fileName),
    line: source.getLineAndCharacterOfPosition(directive.metadata.getStart()).line + 1,
    message: `${resource} is not among the files the scanner reads; the component is scanned without it.` })
}

function nodes(text: string, file: string, options: Parameters<typeof parseTemplate>[2] = {}): TmplAstNode[] {
  const template = parseTemplate(text, file, options)
  if (template.errors?.length) throw new Error(`ANGULAR_TEMPLATE_INVALID: ${template.errors.join('\n')}`)
  return template.nodes
}

class ElementVisitor extends TmplAstRecursiveVisitor {
  private readonly inspect: (element: TmplAstElement) => void
  constructor(inspect: (element: TmplAstElement) => void) { super(); this.inspect = inspect }
  override visitElement(element: TmplAstElement): void { this.inspect(element); super.visitElement(element) }
}

function handlerOf(event: TmplAstBoundEvent): AST {
  return event.handler instanceof ASTWithSource ? event.handler.ast : event.handler
}

/** `name(...)` or `this.name(...)` on the component itself. */
function ownMember(ast: AST, name?: string): string | undefined {
  if (!(ast instanceof PropertyRead) || (name !== undefined && ast.name !== name)) return undefined
  return ast.receiver instanceof ImplicitReceiver || ast.receiver instanceof ThisReceiver ? ast.name : undefined
}

/** The calls in template code that send one output: `saved.emit(value)` in an event handler. */
class EmitCalls extends RecursiveAstVisitor {
  readonly found: Call[] = []
  private readonly output: string
  constructor(output: string) { super(); this.output = output }
  override visitCall(ast: Call, context: unknown): unknown {
    if (ast.receiver instanceof PropertyRead && EMITS.has(ast.receiver.name) && ownMember(ast.receiver.receiver, this.output)) this.found.push(ast)
    return super.visitCall(ast, context)
  }
}

interface Send { operation: string; line: number; position: number }

/**
 * Every component's template, parsed once, with the source unit and output bindings it establishes. Inline templates
 * are read in place, so their offsets are class file offsets; a template or stylesheet file is read only from `files`.
 */
export class Templates {
  private readonly templates = new Map<SourceDirective, ParsedTemplate | undefined>()
  private readonly root: string
  private readonly evidence: Evidence
  private readonly files: ReadonlySet<string>
  constructor(root: string, evidence: Evidence, files: ReadonlySet<string>) { this.root = root; this.evidence = evidence; this.files = files }

  /** A component's class with the template and stylesheets it names among the scanner's files. */
  unit(component: SourceDirective): ScanSourceUnit {
    const primary = relative(this.root, component.declaration.getSourceFile().fileName)
    const template = component.view?.templateUrl === undefined ? undefined : this.parsed(component)?.file
    const styles = (component.view?.styles ?? []).flatMap(resource => {
      const file = componentResource(this.root, component, resource)
      if (file === undefined) return []
      if (this.files.has(file)) return [file]
      missingResource(this.evidence, this.root, component, resource)
      return []
    })
    return { primary, files: [primary, ...(template === undefined ? [] : [template]), ...styles] }
  }

  private parsed(directive: SourceDirective): ParsedTemplate | undefined {
    if (!this.templates.has(directive)) this.templates.set(directive, this.load(directive))
    return this.templates.get(directive)
  }

  private load(directive: SourceDirective): ParsedTemplate | undefined {
    const inline = directive.view?.template
    if (inline) {
      const source = inline.getSourceFile()
      const start = inline.getStart(source) + 1
      const { line, character } = source.getLineAndCharacterOfPosition(start)
      const range = { startPos: start, startLine: line, startCol: character, endPos: inline.getEnd() - 1 }
      return { file: relative(this.root, source.fileName), text: source.text, nodes: nodes(source.text, source.fileName, { range, escapedString: true }) }
    }
    const url = directive.view?.templateUrl
    const file = url === undefined ? undefined : componentResource(this.root, directive, url)
    if (url === undefined || file === undefined) return undefined
    if (!this.files.has(file)) {
      missingResource(this.evidence, this.root, directive, url)
      return undefined
    }
    const text = readFileSync(path.join(this.root, file), 'utf8')
    return { file, text, nodes: nodes(text, file) }
  }

  /** Output bindings in a component's template, each to one source directive the component imports. */
  bindOutputs(parent: SourceDirective, directives: readonly SourceDirective[], checker: ts.TypeChecker): void {
    const view = this.parsed(parent)
    if (!view) return
    const imports = directiveImports(parent, checker)
    const matcher = new SelectorMatcher<SourceDirective>()
    for (const child of directives) {
      if (child.selector !== undefined && imports.has(child.declaration)) matcher.addSelectables(CssSelector.parse(child.selector), child)
    }
    tmplAstVisitAll(new ElementVisitor(element => {
      const selector = new CssSelector()
      selector.setElement(element.name)
      for (const attribute of element.attributes) selector.addAttribute(attribute.name, attribute.value)
      for (const input of element.inputs) selector.addAttribute(input.name, '')
      const matches = new Set<SourceDirective>()
      matcher.match(selector, (_selector, child) => matches.add(child))
      for (const event of element.outputs) this.bind(event, [...matches], parent, view, checker)
    }), view.nodes)
  }

  /** A direct method call on the parent, bound to the one matched directive that declares the output. */
  private bind(event: TmplAstBoundEvent, matches: SourceDirective[], parent: SourceDirective, view: ParsedTemplate, checker: ts.TypeChecker): void {
    const handler = handlerOf(event)
    const method = handler instanceof Call ? ownMember(handler.receiver) : undefined
    const target = method === undefined ? undefined : checker.getTypeAtLocation(parent.declaration).getProperty(method)?.valueDeclaration
    const providers = matches.flatMap(child => {
      const output = sourceOutput(child, event.name, checker)
      return output ? [{ child, output }] : []
    })
    const sends = providers.length === 1 && target && ts.isMethodDeclaration(target) && target.body
      ? this.sends(providers[0]!.child, providers[0]!.output, checker) : []
    if (!sends.length) {
      this.evidence.diagnostics.push({ severity: 'info', code: 'unsupported-angular-binding', file: view.file,
        line: event.sourceSpan.start.line + 1, message: `${event.name} has no supported unique source output-to-method binding.` })
      return
    }
    const binding = { file: view.file, line: event.sourceSpan.start.line + 1, position: event.sourceSpan.start.offset }
    const handlerId = this.evidence.operationId(target!)
    for (const send of sends) {
      this.evidence.invocations.push({ source: send.operation, targets: [handlerId], unresolved: false, member: event.name,
        line: send.line, position: send.position, binding })
    }
  }

  /** Where a directive sends an output: an `emit` in its class, or an event handler in its own template. */
  private sends(child: SourceDirective, output: ts.PropertyDeclaration, checker: ts.TypeChecker): Send[] {
    const sends = outputEmissions(output, child, checker).flatMap(call => {
      const caller = enclosingOperation(call)
      return caller ? [{ operation: this.evidence.operationId(caller), position: call.getStart(),
        line: call.getSourceFile().getLineAndCharacterOfPosition(call.getStart()).line + 1 }] : []
    })
    const view = this.parsed(child)
    if (!view) return sends
    tmplAstVisitAll(new ElementVisitor(element => {
      for (const event of element.outputs) {
        const calls = new EmitCalls(output.name.getText())
        handlerOf(event).visit(calls)
        for (const call of calls.found) {
          const position = call.sourceSpan.start
          sends.push({ operation: this.evidence.operation(view.file, event.handlerSpan.start.offset, `(${event.name}) handler`),
            position, line: view.text.slice(0, position).split('\n').length })
        }
      }
    }), view.nodes)
    return sends
  }
}
