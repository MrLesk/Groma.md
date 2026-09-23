import SwiftSyntax

/// The declared name without escaping backticks: `` func `catch`() `` declares `catch`.
func plainName(_ token: TokenSyntax) -> String {
    token.identifier?.name ?? token.text
}

func typeName(_ node: Syntax) -> TokenSyntax? {
    node.asProtocol((any NamedDeclSyntax).self)?.name
}

/// `extension Box<Int>` extends `Box` and `extension [Int]` extends `Array`: generic arguments and
/// type sugar do not name another type.
func extendedName(_ type: TypeSyntax) -> String {
    if let member = type.as(MemberTypeSyntax.self) { return "\(extendedName(member.baseType)).\(plainName(member.name))" }
    if type.is(ArrayTypeSyntax.self) { return "Array" }
    if type.is(DictionaryTypeSyntax.self) { return "Dictionary" }
    if type.is(OptionalTypeSyntax.self) { return "Optional" }
    return type.as(IdentifierTypeSyntax.self).map { plainName($0.name) } ?? type.trimmedDescription
}

/// The type an extension extends or a type declaration declares; symbols and outline entries share it.
func declaredName(_ node: Syntax) -> String? {
    node.as(ExtensionDeclSyntax.self).map { extendedName($0.extendedType) } ?? typeName(node).map(plainName)
}
