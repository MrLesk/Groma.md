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

func member(_ node: Syntax, converter: SourceLocationConverter, fallback: String) -> Member? {
    let token: TokenSyntax
    let modifiers: DeclModifierListSyntax
    if let function = node.as(FunctionDeclSyntax.self) {
        token = function.name
        modifiers = function.modifiers
    } else if let initializer = node.as(InitializerDeclSyntax.self) {
        token = initializer.initKeyword
        modifiers = initializer.modifiers
    } else if let deinitializer = node.as(DeinitializerDeclSyntax.self) {
        token = deinitializer.deinitKeyword
        modifiers = deinitializer.modifiers
    } else {
        return nil
    }
    return Member(name: plainName(token), line: converter.location(for: token.positionAfterSkippingLeadingTrivia).line,
                  visibility: access(modifiers, default: fallback))
}

// Declarations listed directly in a file or member block, including every #if branch but `#if false`:
// conditional compilation is retained as source and no build configuration is executed. Declarations
// inside statements, closures and function bodies are nested, so the walk never enters them.
func declaredItems(_ node: Syntax) -> [Syntax] {
    if disabled(node) { return [] }
    if node.is(SourceFileSyntax.self) || node.is(CodeBlockItemListSyntax.self) || node.is(CodeBlockItemSyntax.self)
        || node.is(MemberBlockItemListSyntax.self) || node.is(MemberBlockItemSyntax.self)
        || node.is(IfConfigDeclSyntax.self) || node.is(IfConfigClauseListSyntax.self) || node.is(IfConfigClauseSyntax.self) {
        return node.children(viewMode: .sourceAccurate).flatMap { declaredItems($0) }
    }
    return node.isProtocol((any DeclSyntaxProtocol).self) ? [node] : []
}

struct Outline {
    var declarations: [Declaration] = []
    /// The types this file extends; a nested type among them is listed so its extensions join its declaration.
    private let extended: Set<String>

    init(tree: SourceFileSyntax, converter: SourceLocationConverter) {
        let items = declaredItems(Syntax(tree))
        extended = Set(items.compactMap { $0.as(ExtensionDeclSyntax.self).map { extendedName($0.extendedType) } })
        for node in items {
            if let function = node.as(FunctionDeclSyntax.self) {
                appendFunction(function.name, modifiers: function.modifiers, converter: converter)
            } else if let macro = node.as(MacroDeclSyntax.self) {
                // A macro declaration is a module's callable API, as a function signature is.
                appendFunction(macro.name, modifiers: macro.modifiers, converter: converter)
            } else if let variable = node.as(VariableDeclSyntax.self) {
                for binding in variable.bindings where binding.initializer?.value.is(ClosureExprSyntax.self) == true {
                    guard let name = binding.pattern.as(IdentifierPatternSyntax.self)?.identifier else { continue }
                    appendFunction(name, modifiers: variable.modifiers, converter: converter)
                }
            } else if let group = node.asProtocol((any DeclGroupSyntax).self) {
                appendType(node, group: group, converter: converter)
            }
        }
    }

    private mutating func appendFunction(_ name: TokenSyntax, modifiers: DeclModifierListSyntax, converter: SourceLocationConverter) {
        declarations.append(Declaration(kind: "function", name: plainName(name),
            line: converter.location(for: name.positionAfterSkippingLeadingTrivia).line, visibility: access(modifiers)))
    }

    /// `enclosing` names the type a nested declaration belongs to and the access its members get by default.
    private mutating func appendType(_ node: Syntax, group: any DeclGroupSyntax, converter: SourceLocationConverter,
                                     enclosing: (name: String, access: String)? = nil) {
        guard let local = declaredName(node) else { return }
        let isExtension = node.is(ExtensionDeclSyntax.self)
        let name = enclosing.map { "\($0.name).\(local)" } ?? local
        let visibility = access(group.modifiers, default: enclosing?.access ?? "internal")
        // A protocol or an extension gives its members its own access by default; a type gives them internal.
        let fallback = node.is(ProtocolDeclSyntax.self) || isExtension ? visibility : "internal"
        let items = group.memberBlock.members.flatMap { declaredItems(Syntax($0)) }
        let members = items.compactMap { member($0, converter: converter, fallback: fallback) }
        let position = typeName(node)?.positionAfterSkippingLeadingTrivia ?? group.introducer.positionAfterSkippingLeadingTrivia
        if let index = declarations.firstIndex(where: { $0.kind == "type" && $0.name == name }) {
            declarations[index].members?.append(contentsOf: members)
            if !isExtension { declarations[index].visibility = visibility }
        } else {
            declarations.append(Declaration(kind: "type", name: name, line: converter.location(for: position).line,
                                            visibility: visibility, members: members))
        }
        // A type declared in an extension, as in `extension Editor { struct Store {} }`, is listed as
        // `Editor.Store`, and so is a nested type this file extends. Other nested types stay part of their declaration.
        for item in items {
            guard let nested = item.asProtocol((any DeclGroupSyntax).self), let nestedName = declaredName(item) else { continue }
            if isExtension || extended.contains("\(name).\(nestedName)") {
                appendType(item, group: nested, converter: converter, enclosing: (name, fallback))
            }
        }
    }
}
