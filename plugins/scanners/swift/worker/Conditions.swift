import SwiftSyntax

/// `#if false` disables code under every build configuration.
func disabled(_ node: Syntax) -> Bool {
    node.as(IfConfigClauseSyntax.self)?.condition?.as(BooleanLiteralExprSyntax.self)?.literal.tokenKind == .keyword(.false)
}

/// The compiler does not parse a block that needs another compiler or language version, as in
/// `#if compiler(>=6.4)`, so it may hold syntax that only a newer compiler understands.
func versionGated(_ node: Syntax) -> Bool {
    sequence(first: node, next: \.parent).contains { node in
        node.as(IfConfigClauseSyntax.self)?.condition?.tokens(viewMode: .sourceAccurate)
            .contains { ["compiler", "swift"].contains($0.text) } ?? false
    }
}
