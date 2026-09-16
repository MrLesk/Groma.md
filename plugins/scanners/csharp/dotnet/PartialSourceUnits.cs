using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Groma.CSharpScanner;

internal static class PartialSourceUnits
{
    public static IEnumerable<ScanSourceUnit> Extract(Compilation compilation, string root, CancellationToken token)
    {
        Dictionary<INamedTypeSymbol, List<string>> declarations = new(SymbolEqualityComparer.Default);
        foreach (SyntaxTree tree in compilation.SyntaxTrees)
        {
            if (!SourcePath.IsPhysicalSource(root, tree.FilePath)) continue;
            SyntaxNode syntax = tree.GetRoot(token);
            MemberDeclarationSyntax[] types = syntax.DescendantNodes().OfType<MemberDeclarationSyntax>()
                .Where(node => node is BaseTypeDeclarationSyntax or DelegateDeclarationSyntax).ToArray();
            if (types.Length != 1 || types[0] is not ClassDeclarationSyntax declaration
                || !declaration.Modifiers.Any(SyntaxKind.PartialKeyword)) continue;
            INamedTypeSymbol? symbol = compilation.GetSemanticModel(tree).GetDeclaredSymbol(declaration, token);
            if (symbol is null) continue;
            if (!declarations.TryGetValue(symbol, out List<string>? files)) declarations[symbol] = files = [];
            files.Add(SourcePath.Relative(root, tree.FilePath));
        }
        foreach ((INamedTypeSymbol symbol, List<string> members) in declarations)
        {
            string[] files = members.Distinct().Order(StringComparer.Ordinal).ToArray();
            if (files.Length < 2) continue;
            // Do not associate a subset when another declaration shares a file with an independent type.
            if (!symbol.DeclaringSyntaxReferences.All(reference =>
                files.Contains(SourcePath.Relative(root, reference.SyntaxTree.FilePath)))) continue;
            yield return new ScanSourceUnit(files[0], files);
        }
    }
}
