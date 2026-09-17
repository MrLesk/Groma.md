using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Groma.CSharpScanner;

/// <summary>
/// Binding-normalized tokens of one named operation body, compared by core. Names bound to parameters, locals,
/// query range variables, labels and local functions become slots numbered in order of appearance, so renamed
/// copies match. The operation's own name stays text, like a method name, so different recursions stay different.
/// Member names, argument labels, other identifiers (types included), keywords, literals and operators keep their text.
/// Braces, parentheses, brackets, commas, semicolons and dots are dropped, so optional braces and layout do not
/// change the tokens. Grouping is lost with them, as in the TypeScript tokenizer: <c>(a + b) * c</c> and
/// <c>a + b * c</c> yield the same tokens. The parenthesis that opens an argument list becomes <c>call</c>, so
/// <c>x.Count()</c> differs from <c>x.Count</c>.
/// </summary>
internal static class OperationTokens
{
    public static string[] Of(SyntaxNode operation, IMethodSymbol own, SemanticModel model, CancellationToken cancellationToken)
    {
        Dictionary<ISymbol, int> slots = new(SymbolEqualityComparer.Default);
        List<string> tokens = [];
        foreach (SyntaxNode part in Parts(operation).OfType<SyntaxNode>())
        {
            foreach (SyntaxToken token in part.DescendantTokens())
            {
                cancellationToken.ThrowIfCancellationRequested();
                string? text = token.IsKind(SyntaxKind.IdentifierToken)
                    ? NameToken(token, own, model, slots, cancellationToken)
                    : OtherToken(token);
                if (text is not null) tokens.Add(text);
            }
        }
        return [.. tokens];
    }

    /// <summary>The code an operation runs, without its attributes, modifiers, return type or own name.</summary>
    private static SyntaxNode?[] Parts(SyntaxNode operation) => operation switch
    {
        ConstructorDeclarationSyntax constructor => [constructor.ParameterList, constructor.Initializer, constructor.Body, constructor.ExpressionBody],
        BaseMethodDeclarationSyntax method => [method.ParameterList, method.Body, method.ExpressionBody],
        LocalFunctionStatementSyntax local => [local.ParameterList, local.Body, local.ExpressionBody],
        AccessorDeclarationSyntax accessor => [accessor.Body, accessor.ExpressionBody],
        // Only an expression-bodied property or indexer getter remains: callers never tokenize lambdas.
        _ => [operation],
    };

    private static string NameToken(SyntaxToken token, IMethodSymbol own, SemanticModel model, Dictionary<ISymbol, int> slots, CancellationToken cancellationToken)
    {
        SyntaxNode parent = token.Parent!;
        // A named argument's label is the callee's parameter, not a local of this operation.
        if (parent.Parent is NameColonSyntax) return token.ValueText;
        ISymbol? symbol = (parent is SimpleNameSyntax
            ? model.GetSymbolInfo(parent, cancellationToken).Symbol
            : model.GetDeclaredSymbol(parent, cancellationToken))?.OriginalDefinition;
        bool local = symbol is ILocalSymbol or IParameterSymbol or IRangeVariableSymbol or ILabelSymbol
            || symbol is IMethodSymbol { MethodKind: MethodKind.LocalFunction } && !SymbolEqualityComparer.Default.Equals(symbol, own);
        if (local)
        {
            if (!slots.TryGetValue(symbol!, out int slot)) slots.Add(symbol!, slot = slots.Count);
            return $"${slot}";
        }
        bool member = parent.Parent is MemberAccessExpressionSyntax access && access.Name == parent || parent.Parent is MemberBindingExpressionSyntax;
        return member ? $".{token.ValueText}" : token.ValueText;
    }

    private static string? OtherToken(SyntaxToken token) => token.Kind() switch
    {
        SyntaxKind.OpenParenToken => token.Parent is ArgumentListSyntax ? "call" : null,
        SyntaxKind.CloseParenToken or SyntaxKind.OpenBraceToken or SyntaxKind.CloseBraceToken or SyntaxKind.OpenBracketToken
            or SyntaxKind.CloseBracketToken or SyntaxKind.CommaToken or SyntaxKind.SemicolonToken or SyntaxKind.DotToken => null,
        _ => token.Text,
    };
}
