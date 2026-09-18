using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Groma.CSharpScanner;

/// <summary>Operation identity shared by the evidence extractors: a node's position and kind within its file.</summary>
internal static class OperationId
{
    public static string Of(string file, SyntaxNode node) => $"operation:{file}:{node.SpanStart}:{node.RawKind}";

    /// <summary>The id of a resolved method's own declaration, or null when it is not repository source.</summary>
    public static string? OfMethod(string repositoryRoot, IMethodSymbol? method)
    {
        if (method is null || method.MethodKind == MethodKind.DelegateInvoke) return null;
        method = (method.ReducedFrom ?? method).OriginalDefinition;
        method = method.PartialImplementationPart ?? method;
        foreach (SyntaxReference declaration in method.DeclaringSyntaxReferences)
        {
            SyntaxNode syntax = declaration.GetSyntax();
            if (!Path.IsPathRooted(syntax.SyntaxTree.FilePath)) return null;
            string file = SourcePath.Relative(repositoryRoot, syntax.SyntaxTree.FilePath);
            // Expression-bodied property getters point to the property declaration.
            if (syntax is PropertyDeclarationSyntax { ExpressionBody: not null } property) return Of(file, property.ExpressionBody);
            if (syntax is IndexerDeclarationSyntax { ExpressionBody: not null } indexer) return Of(file, indexer.ExpressionBody);
            return Of(file, syntax);
        }
        return null;
    }
}
