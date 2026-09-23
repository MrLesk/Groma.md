import SwiftSyntax

private struct Context {
    /// The qualified name of the enclosing type, function or closure; nil at file level.
    var scope: String?
    var operation: String
}

/// Attributes that make a top-level type its program's entry point.
private let entryAttributes: Set<String> = ["main", "UIApplicationMain", "NSApplicationMain"]

final class Evidence {
    let file: String
    let converter: SourceLocationConverter
    private let offsets: [Int]
    private var symbols: [Symbol] = []
    private var entryType: String?
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
            // The range starts at the declaration so it holds the outline row of a multi-line signature.
            result.startLine = line(node)
            result.endLine = converter.location(for: body.endPositionBeforeTrailingTrivia).line
            result.tokens = BodyTokens().tokens(body: Syntax(body.statements), parameters: parameters.map { $0.secondName ?? $0.firstName })
        }
        operations.append(result)
        return id
    }

    private func named(_ name: String, context: Context) -> String {
        context.scope.map { "\($0).\(name)" } ?? name
    }

    /// A function, initializer or deinit: its symbol when it has a kind, then its body as a named operation.
    private func callable(_ node: Syntax, name local: String, kind: String?, body: CodeBlockSyntax?,
                          parameters: FunctionParameterListSyntax = [], context: Context) {
        let name = named(local, context: context)
        if let kind { symbol(node, name: name, kind: kind) }
        guard let body else { return }
        let id = operation(node, name: name, body: body, parameters: parameters)
        walk(Syntax(body), context: Context(scope: name, operation: id))
    }

    private func group(_ node: Syntax, declaration: any DeclGroupSyntax, context: Context) {
        let name = declaredName(node).map { named($0, context: context) }
        if let name, !node.is(ExtensionDeclSyntax.self) { symbol(node, name: name, kind: declaration.introducer.text) }
        if context.scope == nil && declaration.attributes.contains(where: {
            $0.as(AttributeSyntax.self).map { entryAttributes.contains($0.attributeName.trimmedDescription) } ?? false
        }) { entryType = name }
        walk(Syntax(declaration.memberBlock), context: Context(scope: name, operation: "\(file)#module"))
    }

    private func anonymous(_ node: Syntax, context: Context) {
        let id = operation(node, name: "callback at \(line(node))")
        for child in node.children(viewMode: .sourceAccurate) {
            walk(child, context: Context(scope: context.scope, operation: id))
        }
    }

    private func closure(_ node: ClosureExprSyntax, context: Context) {
        guard let binding = node.parent?.parent?.as(PatternBindingSyntax.self),
              let token = binding.pattern.as(IdentifierPatternSyntax.self)?.identifier else {
            anonymous(Syntax(node), context: context)
            return
        }
        let name = named(plainName(token), context: context)
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
        walk(Syntax(node.statements), context: Context(scope: name, operation: id))
    }

    private func walk(_ node: Syntax, context: Context) {
        if disabled(node) { return }
        if let function = node.as(FunctionDeclSyntax.self) {
            callable(node, name: plainName(function.name), kind: "function", body: function.body,
                     parameters: function.signature.parameterClause.parameters, context: context)
            return
        }
        if let initializer = node.as(InitializerDeclSyntax.self) {
            callable(node, name: "init", kind: "constructor", body: initializer.body,
                     parameters: initializer.signature.parameterClause.parameters, context: context)
            return
        }
        if let deinitializer = node.as(DeinitializerDeclSyntax.self) {
            callable(node, name: "deinit", kind: nil, body: deinitializer.body, context: context)
            return
        }
        if let group = node.asProtocol((any DeclGroupSyntax).self) { self.group(node, declaration: group, context: context); return }
        if let closure = node.as(ClosureExprSyntax.self) { self.closure(closure, context: context); return }
        if node.is(AccessorDeclSyntax.self) {
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
        return FileEvidence(file: file, entryType: entryType, symbols: symbols, operations: operations,
                            invocations: invocations, declarations: Outline(tree: tree, converter: converter).declarations)
    }
}
