import SwiftSyntax

private struct Context {
    var type: String?
    var operation: String
}

final class Evidence {
    let file: String
    let converter: SourceLocationConverter
    private let offsets: [Int]
    private var symbols: [Symbol] = []
    private var operations: [Operation] = []
    private var invocations: [Invocation] = []

    init(file: String, source: String, tree: SourceFileSyntax) {
        self.file = file
        converter = SourceLocationConverter(fileName: file, tree: tree)
        // SwiftSyntax uses UTF-8; the shared contract uses UTF-16.
        var offsets = Array(repeating: 0, count: source.utf8.count + 1)
        var byteOffset = 0
        var utf16Offset = 0
        for scalar in source.unicodeScalars {
            for _ in scalar.utf8 { offsets[byteOffset] = utf16Offset; byteOffset += 1 }
            utf16Offset += scalar.value > 0xffff ? 2 : 1
        }
        offsets[byteOffset] = utf16Offset
        self.offsets = offsets
    }

    private func position(_ node: some SyntaxProtocol) -> Int {
        offsets[node.positionAfterSkippingLeadingTrivia.utf8Offset]
    }

    private func line(_ node: some SyntaxProtocol) -> Int {
        converter.location(for: node.positionAfterSkippingLeadingTrivia).line
    }

    private func identity(_ node: some SyntaxProtocol) -> String { "\(file)#\(position(node))" }

    private func symbol(_ node: Syntax, name: String, kind: String) {
        symbols.append(Symbol(id: identity(node), name: name, kind: kind))
    }

    private func operation(_ node: Syntax, name: String, body: CodeBlockSyntax? = nil,
                           parameters: FunctionParameterListSyntax = []) -> String {
        let id = identity(node)
        var result = Operation(id: id, file: file, name: name, position: position(node))
        if let body {
            result.startLine = line(body)
            result.endLine = converter.location(for: body.endPositionBeforeTrailingTrivia).line
            result.tokens = BodyTokens().tokens(body: Syntax(body.statements), parameters: parameters.map { $0.secondName ?? $0.firstName })
        }
        operations.append(result)
        return id
    }

    private func named(_ name: String, context: Context) -> String {
        context.type.map { "\($0).\(name)" } ?? name
    }

    private func function(_ node: FunctionDeclSyntax, context: Context) {
        let syntax = Syntax(node)
        let name = named(node.name.text, context: context)
        symbol(syntax, name: name, kind: "function")
        guard let body = node.body else { return }
        let id = operation(syntax, name: name, body: body, parameters: node.signature.parameterClause.parameters)
        walk(Syntax(body), context: Context(type: context.type, operation: id))
    }

    private func initializer(_ node: InitializerDeclSyntax, context: Context) {
        let syntax = Syntax(node)
        let name = named("init", context: context)
        symbol(syntax, name: name, kind: "constructor")
        guard let body = node.body else { return }
        let id = operation(syntax, name: name, body: body, parameters: node.signature.parameterClause.parameters)
        walk(Syntax(body), context: Context(type: context.type, operation: id))
    }

    private func group(_ node: Syntax, declaration: any DeclGroupSyntax, context: Context) {
        let name = node.as(ExtensionDeclSyntax.self)?.extendedType.trimmedDescription
            ?? typeName(node).map { named($0.text, context: context) }
        if let name, !node.is(ExtensionDeclSyntax.self) { symbol(node, name: name, kind: declaration.introducer.text) }
        walk(Syntax(declaration.memberBlock), context: Context(type: name, operation: "\(file)#module"))
    }

    private func anonymous(_ node: Syntax, context: Context) {
        let id = operation(node, name: "callback at \(line(node))")
        for child in node.children(viewMode: .sourceAccurate) {
            walk(child, context: Context(type: context.type, operation: id))
        }
    }

    private func closure(_ node: ClosureExprSyntax, context: Context) {
        guard let binding = node.parent?.parent?.as(PatternBindingSyntax.self),
              let token = binding.pattern.as(IdentifierPatternSyntax.self)?.identifier else {
            anonymous(Syntax(node), context: context)
            return
        }
        let name = named(token.text, context: context)
        let syntax = Syntax(node)
        let id = identity(syntax)
        symbol(syntax, name: name, kind: "function")
        var result = Operation(id: id, file: file, name: name, position: position(node))
        result.startLine = line(node)
        result.endLine = converter.location(for: node.endPositionBeforeTrailingTrivia).line
        let parameters = node.signature?.parameterClause?.as(ClosureShorthandParameterListSyntax.self)?.map { $0.name }
            ?? node.signature?.parameterClause?.as(ClosureParameterClauseSyntax.self)?.parameters.map { $0.secondName ?? $0.firstName }
            ?? []
        result.tokens = BodyTokens().tokens(body: Syntax(node.statements), parameters: parameters)
        operations.append(result)
        walk(Syntax(node.statements), context: Context(type: context.type, operation: id))
    }

    private func walk(_ node: Syntax, context: Context) {
        if let function = node.as(FunctionDeclSyntax.self) { self.function(function, context: context); return }
        if let initializer = node.as(InitializerDeclSyntax.self) { self.initializer(initializer, context: context); return }
        if let group = node.asProtocol((any DeclGroupSyntax).self) { self.group(node, declaration: group, context: context); return }
        if let closure = node.as(ClosureExprSyntax.self) { self.closure(closure, context: context); return }
        if node.is(AccessorDeclSyntax.self) || node.is(DeinitializerDeclSyntax.self) {
            anonymous(node, context: context)
            return
        }
        if node.is(FunctionCallExprSyntax.self) {
            invocations.append(Invocation(source: context.operation, line: line(node), position: position(node)))
        }
        for child in node.children(viewMode: .sourceAccurate) { walk(child, context: context) }
    }

    func read(_ tree: SourceFileSyntax) -> FileEvidence {
        let module = "\(file)#module"
        operations.append(Operation(id: module, file: file, name: "(module)", position: 0))
        walk(Syntax(tree), context: Context(operation: module))
        return FileEvidence(file: file, symbols: symbols, operations: operations,
                            invocations: invocations, declarations: Outline(tree: tree, converter: converter).declarations)
    }
}
