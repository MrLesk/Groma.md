import SwiftSyntax

func access(_ modifiers: DeclModifierListSyntax, default fallback: String = "internal") -> String {
    for modifier in modifiers where modifier.detail == nil {
        switch modifier.name.text {
        case "open", "public": return "public"
        case "package", "internal": return "internal"
        case "fileprivate", "private": return "private"
        default: continue
        }
    }
    return fallback
}

func typeName(_ node: Syntax) -> TokenSyntax? {
    node.asProtocol((any NamedDeclSyntax).self)?.name
}

func member(_ node: Syntax, converter: SourceLocationConverter, fallback: String) -> Member? {
    let token: TokenSyntax
    let modifiers: DeclModifierListSyntax
    if let function = node.as(FunctionDeclSyntax.self) {
        token = function.name
        modifiers = function.modifiers
    } else if let initializer = node.as(InitializerDeclSyntax.self) {
        token = initializer.initKeyword
        modifiers = initializer.modifiers
    } else {
        return nil
    }
    return Member(name: token.text, line: converter.location(for: token.positionAfterSkippingLeadingTrivia).line,
                  visibility: access(modifiers, default: fallback))
}

// Conditional compilation is retained as source; no build configuration is executed.
func declaredItems(_ node: Syntax) -> [Syntax] {
    if node.isProtocol((any DeclSyntaxProtocol).self), !node.is(IfConfigDeclSyntax.self) { return [node] }
    return node.children(viewMode: .sourceAccurate).flatMap { declaredItems($0) }
}

struct Outline {
    var declarations: [Declaration] = []

    init(tree: SourceFileSyntax, converter: SourceLocationConverter) {
        for node in declaredItems(Syntax(tree)) {
            if let function = node.as(FunctionDeclSyntax.self) {
                declarations.append(Declaration(kind: "function", name: function.name.text,
                    line: converter.location(for: function.name.positionAfterSkippingLeadingTrivia).line,
                    visibility: access(function.modifiers)))
            } else if let variable = node.as(VariableDeclSyntax.self) {
                for binding in variable.bindings where binding.initializer?.value.is(ClosureExprSyntax.self) == true {
                    guard let name = binding.pattern.as(IdentifierPatternSyntax.self)?.identifier else { continue }
                    declarations.append(Declaration(kind: "function", name: name.text,
                        line: converter.location(for: name.positionAfterSkippingLeadingTrivia).line,
                        visibility: access(variable.modifiers)))
                }
            } else if let group = node.asProtocol((any DeclGroupSyntax).self) {
                appendType(node, group: group, converter: converter)
            }
        }
    }

    mutating func appendType(_ node: Syntax, group: any DeclGroupSyntax, converter: SourceLocationConverter) {
        let extensionNode = node.as(ExtensionDeclSyntax.self)
        let token = typeName(node)
        guard let name = extensionNode?.extendedType.trimmedDescription ?? token?.text else { return }
        let visibility = access(group.modifiers)
        let fallback = node.is(ProtocolDeclSyntax.self) || extensionNode != nil ? visibility : "internal"
        let members = group.memberBlock.members.flatMap { declaredItems(Syntax($0)) }
            .compactMap { member($0, converter: converter, fallback: fallback) }
        let position = token?.positionAfterSkippingLeadingTrivia ?? group.introducer.positionAfterSkippingLeadingTrivia
        if let index = declarations.firstIndex(where: { $0.kind == "type" && $0.name == name }) {
            declarations[index].members?.append(contentsOf: members)
            if extensionNode == nil { declarations[index].visibility = visibility }
        } else {
            declarations.append(Declaration(kind: "type", name: name, line: converter.location(for: position).line,
                                            visibility: visibility, members: members))
        }
    }
}
