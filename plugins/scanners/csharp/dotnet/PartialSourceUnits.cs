using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Groma.CSharpScanner;

internal static class PartialSourceUnits
{
    /// <summary>
    /// Authored files that each declare only one part of the same partial class form one unit. Types nested in a part
    /// are its members, not other types. The primary is the file named after the class, else the shortest name, rather
    /// than a helper part.
    /// </summary>
    public static IEnumerable<ScanSourceUnit> Extract(Compilation compilation, ProjectGraph graph, ProjectNode project, CancellationToken token)
    {
        Dictionary<INamedTypeSymbol, List<string>> declarations = new(SymbolEqualityComparer.Default);
        foreach (SyntaxTree tree in compilation.SyntaxTrees)
        {
            if (!graph.Analyzes(project, tree.FilePath)) continue;
            MemberDeclarationSyntax[] types = [.. SourceOutline.TopLevel(tree.GetCompilationUnitRoot(token).Members)];
            if (types.Length != 1 || types[0] is not ClassDeclarationSyntax declaration
                || !declaration.Modifiers.Any(SyntaxKind.PartialKeyword)) continue;
            INamedTypeSymbol? symbol = compilation.GetSemanticModel(tree).GetDeclaredSymbol(declaration, token);
            if (symbol is null) continue;
            if (!declarations.TryGetValue(symbol, out List<string>? files)) declarations[symbol] = files = [];
            files.Add(SourcePath.Relative(graph.Root, tree.FilePath));
        }
        foreach ((INamedTypeSymbol symbol, List<string> members) in declarations)
        {
            string[] files = members.Distinct().Order(StringComparer.Ordinal).ToArray();
            if (files.Length < 2) continue;
            // Do not associate a subset when another declaration shares a file with an independent type.
            if (!symbol.DeclaringSyntaxReferences.All(reference =>
                files.Contains(SourcePath.Relative(graph.Root, reference.SyntaxTree.FilePath)))) continue;
            string primary = files.FirstOrDefault(file => Path.GetFileNameWithoutExtension(file) == symbol.Name)
                ?? files.OrderBy(file => Path.GetFileName(file).Length).ThenBy(file => file, StringComparer.Ordinal).First();
            yield return new ScanSourceUnit(primary, files);
        }
    }
}
