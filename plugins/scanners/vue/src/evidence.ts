import type { ScanDiagnostic, ScanInvocation, ScanOperation } from '@groma/scanner'
import { ElementTypes, NodeTypes, type DirectiveNode, type ElementNode } from '@vue/compiler-dom'
import { forEachElementNode, parseScriptSetupRanges, type VueVirtualCode } from '@vue/language-core'
import ts from 'typescript'
import { relative, vueTypeScript, type VueProject } from './project.ts'

type Operation = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction

function operation(node: ts.Node): node is Operation {
  return ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)
}

function enclosingOperation(node: ts.Node): Operation | undefined {
  for (let current = node.parent; current; current = current.parent) {
    if (operation(current)) return current
  }
  return undefined
}

function immutable(node: Operation): boolean {
  if (ts.isFunctionDeclaration(node)) return !!node.body
  const parent = node.parent
  return ts.isVariableDeclaration(parent) && ts.isVariableDeclarationList(parent.parent)
    && (parent.parent.flags & ts.NodeFlags.Const) !== 0
}

function includesEvent(type: ts.Type, event: string): boolean {
  if (type.isStringLiteral()) return type.value === event
  return type.isUnion() && type.types.some(item => item.isStringLiteral() && item.value === event)
}

export class VueEvidence {
  readonly operations = new Map<string, ScanOperation>()
  readonly invocations: ScanInvocation[] = []
  readonly diagnostics: ScanDiagnostic[] = []
  private readonly project: VueProject

  constructor(project: VueProject) { this.project = project }

  inspect(file: string, sfc: VueVirtualCode): void {
    const template = sfc.ir.template
    if (!template?.ast) return
    for (const element of forEachElementNode(template.ast)) {
      for (const prop of element.props) {
        if (prop.type !== NodeTypes.DIRECTIVE || prop.name !== 'on') continue
        const binding = template.startTagEnd + prop.loc.start.offset
        if (!this.bind(file, element, prop, binding, template.startTagEnd)) {
          this.diagnostics.push({ severity: 'info', code: 'unsupported-vue-binding',
            message: `${relative(this.project.root, file)}:${this.project.line(file, binding)}: ${prop.loc.source} has no supported unique SFC event-to-function binding.` })
        }
      }
    }
  }

  private component(file: string, position: number): VueVirtualCode | undefined {
    const candidates = new Set<VueVirtualCode>()
    for (const node of this.project.nodes(file, position)) {
      if (!ts.isIdentifier(node)) continue
      const symbol = this.project.checker.getSymbolAtLocation(node)
      if (!symbol || !(symbol.flags & ts.SymbolFlags.Alias)) continue
      const target = this.project.checker.getAliasedSymbol(symbol)
      for (const declaration of target.declarations ?? []) {
        const source = declaration.getSourceFile()
        const sfc = this.project.owned(source) && this.project.sfc(source.fileName)
        if (sfc) candidates.add(sfc)
      }
    }
    return candidates.size === 1 ? [...candidates][0] : undefined
  }

  private handler(file: string, position: number): Operation | undefined {
    const candidates = new Set<Operation>()
    for (const node of this.project.nodes(file, position)) {
      if (!ts.isIdentifier(node)) continue
      for (const signature of this.project.checker.getTypeAtLocation(node).getCallSignatures()) {
        const declaration = signature.declaration
        if (declaration && operation(declaration) && immutable(declaration)
          && this.project.owned(declaration.getSourceFile())) candidates.add(declaration)
      }
    }
    return candidates.size === 1 ? [...candidates][0] : undefined
  }

  private emitSymbol(sfc: VueVirtualCode): ts.Symbol | undefined {
    const setup = sfc.ir.scriptSetup
    if (!setup) return undefined
    const emits = parseScriptSetupRanges(vueTypeScript, setup.ast, this.project.options).defineEmits
    if (!emits?.typeArg) return undefined
    const symbols = new Set<ts.Symbol>()
    for (const node of this.project.nodes(sfc.fileName, setup.startTagEnd + emits.exp.start)) {
      const call = node.parent
      if (!ts.isCallExpression(call) || !ts.isVariableDeclaration(call.parent)) continue
      const declaration = call.parent
      if (!ts.isVariableDeclarationList(declaration.parent) || !(declaration.parent.flags & ts.NodeFlags.Const)) continue
      const symbol = this.project.checker.getSymbolAtLocation(declaration.name)
      if (symbol) symbols.add(symbol)
    }
    return symbols.size === 1 ? [...symbols][0] : undefined
  }

  private emissions(sfc: VueVirtualCode, event: string): ts.CallExpression[] {
    const symbol = this.emitSymbol(sfc)
    const source = this.project.program.getSourceFile(sfc.fileName)
    if (!symbol || !source) return []
    const calls: ts.CallExpression[] = []
    const checker = this.project.checker
    function visit(node: ts.Node): void {
      if (ts.isCallExpression(node) && checker.getSymbolAtLocation(node.expression) === symbol) {
        const argument = node.arguments[0]
        const parameter = checker.getResolvedSignature(node)?.parameters[0]
        if (argument && ts.isStringLiteral(argument) && argument.text === event && parameter
          && includesEvent(checker.getTypeOfSymbolAtLocation(parameter, node), event)) calls.push(node)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
    return calls
  }

  private addOperation(node: Operation): string | undefined {
    const position = this.project.position(node)
    if (position === undefined) return undefined
    const file = relative(this.project.root, node.getSourceFile().fileName)
    const id = `${file}#${position}`
    const name = ts.isFunctionDeclaration(node) ? node.name?.text :
      ts.isVariableDeclaration(node.parent) ? node.parent.name.getText() : undefined
    this.operations.set(id, { id, file, position, name: name ?? `callback at ${this.project.line(node.getSourceFile().fileName, position)}` })
    return id
  }

  private bind(file: string, element: ElementNode, event: DirectiveNode, binding: number, templateOffset: number): boolean {
    if (element.tagType !== ElementTypes.COMPONENT || event.modifiers.length
      || event.arg?.type !== NodeTypes.SIMPLE_EXPRESSION || !event.arg.isStatic
      || event.exp?.type !== NodeTypes.SIMPLE_EXPRESSION) return false
    // The compiler's expression AST distinguishes a direct identifier from calls and dynamic expressions.
    const expression = ts.createSourceFile('handler.ts', event.exp.content, ts.ScriptTarget.Latest, true)
    const statement = expression.statements[0]
    if (expression.statements.length !== 1 || !statement || !ts.isExpressionStatement(statement)
      || !ts.isIdentifier(statement.expression)) return false
    const child = this.component(file, templateOffset + element.loc.start.offset + 1)
    const target = this.handler(file, templateOffset + event.exp.loc.start.offset)
    if (!child || !target) return false
    const calls = this.emissions(child, event.arg.content)
    let bound = false
    for (const call of calls) {
      const caller = enclosingOperation(call)
      const position = this.project.position(call)
      if (!caller || position === undefined) continue
      const source = this.addOperation(caller)
      const targetId = this.addOperation(target)
      if (!source || !targetId) continue
      this.invocations.push({ source, targets: [targetId], unresolved: false, member: event.arg.content,
        position, line: this.project.line(child.fileName, position),
        binding: { file: relative(this.project.root, file), position: binding, line: this.project.line(file, binding) } })
      bound = true
    }
    return bound
  }
}
