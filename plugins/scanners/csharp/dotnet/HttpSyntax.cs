using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Groma.CSharpScanner;

/// <summary>Syntax the HTTP extractors share: attribute and member names, proven constants, and URL expressions.</summary>
internal static class HttpSyntax
{
    /// <summary>An attribute's own name without the Attribute suffix, such as HttpGet for [Mvc.HttpGetAttribute].</summary>
    public static string AttributeName(AttributeSyntax attribute)
    {
        string name = attribute.Name switch
        {
            QualifiedNameSyntax qualified => qualified.Right.Identifier.ValueText,
            AliasQualifiedNameSyntax alias => alias.Name.Identifier.ValueText,
            SimpleNameSyntax simple => simple.Identifier.ValueText,
            _ => "",
        };
        return name.EndsWith("Attribute", StringComparison.Ordinal) ? name[..^"Attribute".Length] : name;
    }

    /// <summary>The first positional argument of an attribute, which holds its route template.</summary>
    public static ExpressionSyntax? Template(AttributeSyntax attribute) => attribute.ArgumentList?.Arguments
        .FirstOrDefault(argument => argument.NameEquals is null && argument.NameColon is null)?.Expression;

    public static string CallName(ExpressionSyntax expression) => expression switch
    {
        MemberAccessExpressionSyntax access => access.Name.Identifier.ValueText,
        MemberBindingExpressionSyntax binding => binding.Name.Identifier.ValueText,
        SimpleNameSyntax name => name.Identifier.ValueText,
        _ => "",
    };

    public static ExpressionSyntax? Receiver(InvocationExpressionSyntax call) =>
        call.Expression is MemberAccessExpressionSyntax access ? access.Expression : null;

    public static string TypeName(TypeSyntax? type) => type switch
    {
        null => "",
        QualifiedNameSyntax qualified => qualified.Right.Identifier.ValueText,
        SimpleNameSyntax name => name.Identifier.ValueText,
        NullableTypeSyntax nullable => TypeName(nullable.ElementType),
        _ => "",
    };

    /// <summary>
    /// Text the compilation proves constant: a literal, a const field, or their concatenation. A readonly field is
    /// not proof, because a constructor may assign it a different value.
    /// </summary>
    public static string? Constant(SemanticModel model, ExpressionSyntax? expression, CancellationToken cancellationToken)
    {
        if (expression is null) return null;
        return model.GetConstantValue(expression, cancellationToken) is { HasValue: true } constant ? constant.Value as string : null;
    }

    /// <summary>The single assigned value of a local, parameter or field declaration.</summary>
    public static ExpressionSyntax? Initializer(ISymbol symbol) =>
        symbol.DeclaringSyntaxReferences.FirstOrDefault()?.GetSyntax() is VariableDeclaratorSyntax { Initializer: not null } declarator
            ? declarator.Initializer!.Value : null;

    /// <summary>The declared type name of a local, parameter or field, such as WebApplication.</summary>
    public static string DeclaredTypeName(ISymbol? symbol) => symbol switch
    {
        ILocalSymbol local => local.Type.Name,
        IParameterSymbol parameter => parameter.Type.Name,
        IFieldSymbol field => field.Type.Name,
        IPropertySymbol property => property.Type.Name,
        _ => "",
    };

    /// <summary>What a URL expression proves: text pieces and computed holes, in source order.</summary>
    public static List<UrlPart> Url(SemanticModel model, ExpressionSyntax expression, CancellationToken cancellationToken)
    {
        if (Constant(model, expression, cancellationToken) is string text) return [new UrlPart(text)];
        switch (expression)
        {
            case ParenthesizedExpressionSyntax parenthesized:
                return Url(model, parenthesized.Expression, cancellationToken);
            case InterpolatedStringExpressionSyntax interpolated:
                List<UrlPart> parts = [];
                foreach (InterpolatedStringContentSyntax content in interpolated.Contents)
                {
                    if (content is InterpolatedStringTextSyntax literal) parts.Add(new UrlPart(literal.TextToken.ValueText));
                    else if (content is InterpolationSyntax hole) parts.AddRange(Url(model, hole.Expression, cancellationToken));
                }
                return parts;
            case BinaryExpressionSyntax concatenation when concatenation.IsKind(SyntaxKind.AddExpression):
                return [.. Url(model, concatenation.Left, cancellationToken), .. Url(model, concatenation.Right, cancellationToken)];
            // A Uri wraps the URL its first argument states.
            case ObjectCreationExpressionSyntax creation when TypeName(creation.Type) == "Uri" && creation.ArgumentList?.Arguments.Count == 1:
                return Url(model, creation.ArgumentList.Arguments[0].Expression, cancellationToken);
            default:
                return [UrlPart.Computed];
        }
    }
}
