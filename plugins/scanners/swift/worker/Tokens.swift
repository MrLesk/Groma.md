import SwiftSyntax

/// Replace lexically bound local names, retaining members, labels, literals and unknown names.
final class BodyTokens {
    private var scopes: [[String: String]] = [[:]]
    private var replacements: [Int: String] = [:]
    private var nextSlot = 0

    private func bind(_ token: TokenSyntax) {
        guard token.text != "_" else { return }
        let value = "local:\(nextSlot)"
        nextSlot += 1
        scopes[scopes.count - 1][token.text] = value
        replacements[token.positionAfterSkippingLeadingTrivia.utf8Offset] = value
    }

    private func bindPattern(_ node: Syntax) {
        if let identifier = node.as(IdentifierPatternSyntax.self) { bind(identifier.identifier) }
        else { for child in node.children(viewMode: .sourceAccurate) { bindPattern(child) } }
    }

    private func lookup(_ name: String) -> String? {
        for scope in scopes.reversed() { if let value = scope[name] { return value } }
        return nil
    }

    private func scoped(_ run: () -> Void) {
        scopes.append([:])
        run()
        scopes.removeLast()
    }

    private func walkChildren(_ node: Syntax) {
        for child in node.children(viewMode: .sourceAccurate) { walk(child) }
    }

    private func reference(_ node: DeclReferenceExprSyntax) {
        if let member = node.parent?.as(MemberAccessExprSyntax.self), member.declName.id == node.id { return }
        if let value = lookup(node.baseName.text) {
            replacements[node.baseName.positionAfterSkippingLeadingTrivia.utf8Offset] = value
        }
    }

    private func localBinding(_ node: PatternBindingSyntax) {
        if let initializer = node.initializer { walk(Syntax(initializer)) }
        bindPattern(Syntax(node.pattern))
        if let accessor = node.accessorBlock { walk(Syntax(accessor)) }
    }

    private func optionalBinding(_ node: OptionalBindingConditionSyntax) {
        if let initializer = node.initializer { walk(Syntax(initializer)) }
        bindPattern(Syntax(node.pattern))
    }

    private func scopedSyntax(_ node: Syntax) -> Bool {
        if let conditional = node.as(IfExprSyntax.self) {
            scoped { walk(Syntax(conditional.conditions)); walk(Syntax(conditional.body)) }
            if let alternative = conditional.elseBody { walk(Syntax(alternative)) }
            return true
        }
        if node.is(CodeBlockSyntax.self) || node.is(ClosureExprSyntax.self)
            || node.is(WhileStmtSyntax.self) || node.is(SwitchCaseSyntax.self) || node.is(CatchClauseSyntax.self) {
            scoped { walkChildren(node) }
            return true
        }
        return false
    }

    private func bindingSyntax(_ node: Syntax) -> Bool {
        if let binding = node.as(PatternBindingSyntax.self) { localBinding(binding); return true }
        if let binding = node.as(OptionalBindingConditionSyntax.self) { optionalBinding(binding); return true }
        if let binding = node.as(IdentifierPatternSyntax.self) { bind(binding.identifier); return true }
        if let parameter = node.as(FunctionParameterSyntax.self) { bind(parameter.secondName ?? parameter.firstName); return true }
        if let parameter = node.as(ClosureParameterSyntax.self) { bind(parameter.secondName ?? parameter.firstName); return true }
        if let parameter = node.as(ClosureShorthandParameterSyntax.self) { bind(parameter.name); return true }
        if let capture = node.as(ClosureCaptureSyntax.self) {
            walkChildren(node)
            if let name = capture.tokens(viewMode: .sourceAccurate).first(where: {
                if case .identifier = $0.tokenKind { return true }
                return false
            }) { bind(name) }
            return true
        }
        return false
    }

    private func walk(_ node: Syntax) {
        if let reference = node.as(DeclReferenceExprSyntax.self) { self.reference(reference); return }
        if bindingSyntax(node) || scopedSyntax(node) { return }
        if let loop = node.as(ForStmtSyntax.self) {
            walk(Syntax(loop.sequence))
            scoped {
                bindPattern(Syntax(loop.pattern))
                if let clause = loop.whereClause { walk(Syntax(clause)) }
                walk(Syntax(loop.body))
            }
            return
        }
        if let function = node.as(FunctionDeclSyntax.self) {
            bind(function.name)
            scoped {
                walk(Syntax(function.signature.parameterClause))
                if let body = function.body { walk(Syntax(body)) }
            }
            return
        }
        walkChildren(node)
    }

    func tokens(body: Syntax, parameters: [TokenSyntax]) -> [String] {
        for parameter in parameters { bind(parameter) }
        walk(body)
        return body.tokens(viewMode: .sourceAccurate).map { token in
            replacements[token.positionAfterSkippingLeadingTrivia.utf8Offset] ?? token.text
        }
    }
}
