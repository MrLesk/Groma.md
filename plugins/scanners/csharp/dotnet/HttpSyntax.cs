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

    /// <summary>
    /// An attribute's constructor argument, written in place or named like <c>template:</c>, which holds its route
    /// template or name. Property settings such as <c>Name = ...</c> come after it and are not it.
    /// </summary>
    public static ExpressionSyntax? Argument(AttributeSyntax attribute) => attribute.ArgumentList?.Arguments
        .FirstOrDefault(argument => argument.NameEquals is null)?.Expression;

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

    /// <summary>Text the compilation proves constant: a literal, a const field, or their concatenation.</summary>
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

    /// <summary>Whether this file assigns the symbol anywhere but its declaration, or passes or binds it by reference.</summary>
    public static bool Written(ISymbol symbol, SemanticModel model, CancellationToken cancellationToken)
    {
        foreach (SyntaxNode candidate in model.SyntaxTree.GetRoot(cancellationToken).DescendantNodes())
        {
            ExpressionSyntax? written = candidate switch
            {
                AssignmentExpressionSyntax assignment => assignment.Left,
                ArgumentSyntax argument when !argument.RefKindKeyword.IsKind(SyntaxKind.None) => argument.Expression,
                RefExpressionSyntax reference => reference.Expression,
                _ => null,
            };
            if (written is not null && Targets(written)
                .Any(target => SymbolEqualityComparer.Default.Equals(model.GetSymbolInfo(target, cancellationToken).Symbol, symbol))) return true;
        }
        return false;
    }

    /// <summary>The names an assignment writes: its target, or each element a deconstruction assigns.</summary>
    private static IEnumerable<ExpressionSyntax> Targets(ExpressionSyntax target) => target is TupleExpressionSyntax tuple
        ? tuple.Arguments.SelectMany(argument => Targets(argument.Expression))
        : [target];

    /// <summary>
    /// The initializer of a local or readonly field that this file never assigns again, when nothing outside this file
    /// could assign it: a local lives in one method, and a readonly field only in its own type's constructors.
    /// </summary>
    public static ExpressionSyntax? SingleValue(SemanticModel model, ExpressionSyntax name, CancellationToken cancellationToken)
    {
        ISymbol? symbol = model.GetSymbolInfo(name, cancellationToken).Symbol;
        bool contained = symbol switch
        {
            ILocalSymbol => true,
            IFieldSymbol { IsReadOnly: true } field => field.ContainingType.DeclaringSyntaxReferences.All(part => part.SyntaxTree == model.SyntaxTree),
            _ => false,
        };
        if (!contained || Initializer(symbol!) is not ExpressionSyntax value || value.SyntaxTree != model.SyntaxTree) return null;
        return Written(symbol!, model, cancellationToken) ? null : value;
    }

    /// <summary>What a URL expression proves: text pieces and computed holes, in source order.</summary>
    public static List<UrlPart> Url(SemanticModel model, ExpressionSyntax expression, CancellationToken cancellationToken, int depth = 0)
    {
        if (Constant(model, expression, cancellationToken) is string text) return [new UrlPart(text)];
        switch (expression)
        {
            case IdentifierNameSyntax or MemberAccessExpressionSyntax when depth < 8
                && SingleValue(model, expression, cancellationToken) is ExpressionSyntax value:
                return Url(model, value, cancellationToken, depth + 1);
            case ParenthesizedExpressionSyntax parenthesized:
                return Url(model, parenthesized.Expression, cancellationToken, depth);
            case InterpolatedStringExpressionSyntax interpolated:
                List<UrlPart> parts = [];
                foreach (InterpolatedStringContentSyntax content in interpolated.Contents)
                {
                    if (content is InterpolatedStringTextSyntax literal) parts.Add(new UrlPart(literal.TextToken.ValueText));
                    else if (content is InterpolationSyntax hole) parts.AddRange(Url(model, hole.Expression, cancellationToken, depth));
                }
                return parts;
            case BinaryExpressionSyntax concatenation when concatenation.IsKind(SyntaxKind.AddExpression):
                return [.. Url(model, concatenation.Left, cancellationToken, depth), .. Url(model, concatenation.Right, cancellationToken, depth)];
            // A Uri wraps the URL its first argument states.
            case ObjectCreationExpressionSyntax creation when TypeName(creation.Type) == "Uri" && creation.ArgumentList?.Arguments.Count == 1:
                return Url(model, creation.ArgumentList.Arguments[0].Expression, cancellationToken, depth);
            default:
                return [ReadsConfiguration(model, expression, cancellationToken) ? UrlPart.Setting : UrlPart.Computed];
        }
    }

    private static readonly HashSet<string> ConfigurationTypes = new(StringComparer.Ordinal)
        { "IConfiguration", "IConfigurationRoot", "IConfigurationSection", "IConfigurationManager", "ConfigurationManager" };

    /// <summary>
    /// A value read from configuration: an IConfiguration indexer, <c>GetValue</c>, <c>GetConnectionString</c> or a
    /// section's <c>Value</c>, or an environment variable.
    /// </summary>
    private static bool ReadsConfiguration(SemanticModel model, ExpressionSyntax expression, CancellationToken cancellationToken) => expression switch
    {
        ElementAccessExpressionSyntax element => IsConfiguration(model, element.Expression, cancellationToken),
        MemberAccessExpressionSyntax { Name.Identifier.ValueText: "Value" } member => IsConfiguration(model, member.Expression, cancellationToken),
        InvocationExpressionSyntax call when CallName(call.Expression) is "GetValue" or "GetConnectionString" =>
            Receiver(call) is ExpressionSyntax receiver && IsConfiguration(model, receiver, cancellationToken),
        InvocationExpressionSyntax call when CallName(call.Expression) == "GetEnvironmentVariable" =>
            model.GetSymbolInfo(call, cancellationToken).Symbol?.ContainingType?.ToDisplayString() == "System.Environment",
        _ => false,
    };

    /// <summary>A configuration object, recognized by its type, or a section that GetSection reads from one.</summary>
    private static bool IsConfiguration(SemanticModel model, ExpressionSyntax expression, CancellationToken cancellationToken) =>
        expression is InvocationExpressionSyntax { Expression: MemberAccessExpressionSyntax { Name.Identifier.ValueText: "GetSection" } section }
            ? IsConfiguration(model, section.Expression, cancellationToken)
            : model.GetTypeInfo(expression, cancellationToken).Type is ITypeSymbol type && ConfigurationTypes.Contains(type.Name);
}
