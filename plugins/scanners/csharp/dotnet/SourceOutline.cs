using System.Text.Json;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Groma.CSharpScanner;

public sealed record SourceReference(string File, IReadOnlyList<string> Symbols);
public sealed record OutlineRequest(string Root, IReadOnlyList<SourceReference> References);
public sealed record CodeSymbol(string Name, int Line, string Visibility, bool Entry);
public sealed record CodeType(string Name, int Line, string Visibility, bool Entry, IReadOnlyList<CodeSymbol> Members)
{
    public string Kind => "type";
}
public sealed record CodeFile(string File, IReadOnlyList<CodeType> Declarations);

/// <summary>
/// The source outline of Code reference files, read from C# syntax alone. Types and delegates declared directly in a
/// file or in its namespaces are listed, each type with the methods, constructors, finalizers and operators that file
/// declares on it.
/// </summary>
public static class SourceOutline
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static string Run(string request, CancellationToken cancellationToken)
    {
        OutlineRequest parsed = JsonSerializer.Deserialize<OutlineRequest>(request, JsonOptions)
            ?? throw new ArgumentException("An outline request is required.");
        return JsonSerializer.Serialize(Read(parsed, cancellationToken), JsonOptions) + "\n";
    }

    public static CodeFile[] Read(OutlineRequest request, CancellationToken cancellationToken = default) => request.References
        .Select(reference => new CodeFile(reference.File, Types(request.Root, reference, cancellationToken)))
        .Where(file => file.Declarations.Count > 0)
        .ToArray();

    private static CodeType[] Types(string root, SourceReference reference, CancellationToken cancellationToken)
    {
        SyntaxTree tree = CSharpSyntaxTree.ParseText(File.ReadAllText(Path.Combine(root, reference.File)), cancellationToken: cancellationToken);
        return TopLevel(tree.GetCompilationUnitRoot(cancellationToken).Members).Select(declaration => TypeOf(declaration, reference)).ToArray();
    }

    /// <summary>Type and delegate declarations; namespaces are transparent and nested types are not listed.</summary>
    private static IEnumerable<MemberDeclarationSyntax> TopLevel(SyntaxList<MemberDeclarationSyntax> members)
    {
        foreach (MemberDeclarationSyntax member in members)
        {
            if (member is BaseNamespaceDeclarationSyntax block)
                foreach (MemberDeclarationSyntax nested in TopLevel(block.Members)) yield return nested;
            else if (member is BaseTypeDeclarationSyntax or DelegateDeclarationSyntax) yield return member;
        }
    }

    /// <summary>Enums and delegates are types without members.</summary>
    private static CodeType TypeOf(MemberDeclarationSyntax declaration, SourceReference reference)
    {
        SyntaxToken name = declaration is DelegateDeclarationSyntax callable ? callable.Identifier : ((BaseTypeDeclarationSyntax)declaration).Identifier;
        CodeSymbol[] members = declaration is TypeDeclarationSyntax type ? Members(type, reference) : [];
        return new CodeType(name.ValueText, Line(name), Visibility(declaration.Modifiers, "internal"), reference.Symbols.Contains(name.ValueText), members);
    }

    /// <summary>Every declared method, constructor, finalizer and operator. A Code link names a member as <c>Type.Member</c>.</summary>
    private static CodeSymbol[] Members(TypeDeclarationSyntax type, SourceReference reference)
    {
        string defaultVisibility = type is InterfaceDeclarationSyntax ? "public" : "private";
        return type.Members.OfType<BaseMethodDeclarationSyntax>().Select(member =>
        {
            (string name, SyntaxToken token) = MemberName(member);
            bool entry = reference.Symbols.Contains($"{type.Identifier.ValueText}.{name}");
            return new CodeSymbol(name, Line(token), Visibility(member.Modifiers, defaultVisibility), entry);
        }).ToArray();
    }

    private static (string Name, SyntaxToken Token) MemberName(BaseMethodDeclarationSyntax member) => member switch
    {
        MethodDeclarationSyntax method => (method.Identifier.ValueText, method.Identifier),
        ConstructorDeclarationSyntax constructor => (constructor.Identifier.ValueText, constructor.Identifier),
        DestructorDeclarationSyntax finalizer => ($"~{finalizer.Identifier.ValueText}", finalizer.Identifier),
        OperatorDeclarationSyntax op => ($"operator {op.OperatorToken.Text}", op.OperatorKeyword),
        ConversionOperatorDeclarationSyntax conversion => ($"{conversion.ImplicitOrExplicitKeyword.Text} operator {conversion.Type}", conversion.OperatorKeyword),
        _ => throw new InvalidDataException($"Unsupported C# method declaration: {member.Kind()}."),
    };

    /// <summary>Any access that admits subtypes is protected; a file-local type is private to its file.</summary>
    private static string Visibility(SyntaxTokenList modifiers, string defaultVisibility) =>
        modifiers.Any(SyntaxKind.PublicKeyword) ? "public"
        : modifiers.Any(SyntaxKind.ProtectedKeyword) ? "protected"
        : modifiers.Any(SyntaxKind.InternalKeyword) ? "internal"
        : modifiers.Any(SyntaxKind.PrivateKeyword) || modifiers.Any(SyntaxKind.FileKeyword) ? "private"
        : defaultVisibility;

    private static int Line(SyntaxToken token) => token.GetLocation().GetLineSpan().StartLinePosition.Line + 1;
}
