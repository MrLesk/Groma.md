using System.Globalization;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Groma.CSharpScanner;

public sealed class RoslynScanner
{
    public async Task<ScanObservation> ScanAsync(ScanRequest request, CancellationToken cancellationToken = default)
    {
        ProjectGraph graph = ProjectGraph.Load(request);
        using AdhocWorkspace workspace = new();
        Solution solution = await SourceProject.LoadAsync(workspace, graph, request, cancellationToken);
        Dictionary<string, Project> compiled = solution.Projects.ToDictionary(project => project.FilePath!, StringComparer.Ordinal);
        Dictionary<string, string> rootIds = graph.Projects.ToDictionary(project => project.File.Path,
            project => $"project:{SourcePath.Relative(graph.Root, project.File.Path)}", StringComparer.Ordinal);
        List<ScanFile> files = [];
        List<ScanSourceUnit> sourceUnits = [];
        List<ScanEntryPoint> entryPoints = [];
        List<ScanDiagnostic> diagnostics = [.. graph.Skipped];
        OperationEvidence evidence = new(graph.Root);
        HttpEvidence http = new(graph.Root, await HttpEndpoints.Conventions(solution.Projects.SelectMany(project => project.Documents), cancellationToken));

        foreach (ProjectNode node in graph.Projects)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Compilation compilation = await compiled[node.File.Path].GetCompilationAsync(cancellationToken)
                ?? throw new InvalidDataException($"Roslyn could not compile '{node.Name}'.");
            CheckCompilation(compilation, node, graph, diagnostics, cancellationToken);
            sourceUnits.AddRange(PartialSourceUnits.Extract(compilation, graph, node, cancellationToken));
            if (EntryPoint(compilation, node, graph, cancellationToken) is ScanEntryPoint entry) entryPoints.Add(entry);
            foreach (Document document in compiled[node.File.Path].Documents
                .Where(document => document.FilePath is not null && graph.Analyzes(node, document.FilePath))
                .OrderBy(document => document.FilePath, StringComparer.Ordinal))
            {
                string file = SourcePath.Relative(graph.Root, document.FilePath!);
                SyntaxTree tree = await document.GetSyntaxTreeAsync(cancellationToken) ?? throw new InvalidDataException($"Roslyn could not parse '{file}'.");
                SemanticModel model = compilation.GetSemanticModel(tree);
                SyntaxNode root = await tree.GetRootAsync(cancellationToken);
                files.Add(new ScanFile(file, [.. graph.CompilingProjects[document.FilePath!].Select(project => rootIds[project])], DeclaredSymbols(root, model, cancellationToken)));
                http.Extract(root, model, file, evidence.Extract(root, model, file, cancellationToken), cancellationToken);
            }
        }
        diagnostics.Add(new ScanDiagnostic("info", "CSHARP_CONTEXT", $"Declared C# source; configuration {request.Configuration}; {graph.Projects.Count} projects. External packages, MSBuild targets and conditions, and source generators are not evaluated."));
        diagnostics.Add(new ScanDiagnostic("info", "CSHARP_OPERATION_SCOPE", "Explicit calls and constructions in implemented methods, accessors, local functions, lambdas and top-level statements. Implicit language calls, initializers, generated operations, receiver/delegate value flow, DI and protocol wiring are not resolved."));
        ScanOperation[] operations = [.. evidence.Operations, .. http.Operations];
        var (served, sent) = http.Facts(operations.Select(operation => operation.Id).ToHashSet(StringComparer.Ordinal));
        return ScanObservation.Create(
            new ScannerIdentity("csharp", "c#/.NET", "roslyn", typeof(CSharpCompilation).Assembly.GetName().Version!.ToString()),
            Roots(graph, rootIds), files, diagnostics, operations, evidence.Invocations, sourceUnits, served, sent, entryPoints);
    }

    /// <summary>Each project under the first input solution that lists it, and those solutions.</summary>
    private static List<ScanRoot> Roots(ProjectGraph graph, Dictionary<string, string> rootIds)
    {
        string SolutionId(string solution) => $"solution:{SourcePath.Relative(graph.Root, solution)}";
        List<ScanRoot> roots = [.. graph.Projects.Select(project => new ScanRoot(rootIds[project.File.Path], "project", project.Name,
            SourcePath.Relative(graph.Root, project.File.Path), graph.Solutions.TryGetValue(project.File.Path, out string? solution) ? SolutionId(solution) : null))];
        roots.AddRange(graph.Projects.Select(project => graph.Solutions.GetValueOrDefault(project.File.Path)).OfType<string>().Distinct(StringComparer.Ordinal)
            .Select(solution => new ScanRoot(SolutionId(solution), "solution", Path.GetFileNameWithoutExtension(solution), SourcePath.Relative(graph.Root, solution))));
        return roots;
    }

    /// <summary>The compiler's entry point when it is a scanned repository source, with the scanned files this project compiles.</summary>
    private static ScanEntryPoint? EntryPoint(Compilation compilation, ProjectNode node, ProjectGraph graph, CancellationToken cancellationToken)
    {
        string? entry = compilation.GetEntryPoint(cancellationToken)?.Locations.FirstOrDefault(location => location.IsInSource)?.SourceTree?.FilePath;
        bool Scanned(string? file) => file is not null && graph.CompilingProjects.ContainsKey(file);
        if (!Scanned(entry)) return null;
        return new ScanEntryPoint(SourcePath.Relative(graph.Root, entry!), SourcePath.Relative(graph.Root, node.File.Path), node.Name,
            [.. node.Sources.Where(Scanned).Select(file => SourcePath.Relative(graph.Root, file)).Order(StringComparer.Ordinal)]);
    }

    /// <summary>
    /// Invalid syntax fails the scan. Compiler errors in files this project analyzes, and errors without a source file,
    /// such as a missing entry point, become warnings located by file and line; another project reports its own files.
    /// </summary>
    private static void CheckCompilation(Compilation compilation, ProjectNode node, ProjectGraph graph, List<ScanDiagnostic> diagnostics, CancellationToken token)
    {
        foreach (SyntaxTree tree in compilation.SyntaxTrees)
            if (tree.GetDiagnostics(token).Any(diagnostic => diagnostic.Severity == DiagnosticSeverity.Error))
                throw new InvalidDataException($"Invalid C# syntax in '{SourcePath.Relative(graph.Root, tree.FilePath)}'.");
        foreach (Diagnostic error in compilation.GetDiagnostics(token).Where(diagnostic => diagnostic.Severity == DiagnosticSeverity.Error))
        {
            string message = NormalizeMessage(error.GetMessage(CultureInfo.InvariantCulture), graph.Root);
            string? path = error.Location.IsInSource ? error.Location.SourceTree?.FilePath : null;
            if (string.IsNullOrEmpty(path))
                diagnostics.Add(new ScanDiagnostic("warning", error.Id, message, SourcePath.Relative(graph.Root, node.File.Path)));
            else if (graph.Analyzes(node, path))
                diagnostics.Add(new ScanDiagnostic("warning", error.Id, message, SourcePath.Relative(graph.Root, path), error.Location.GetLineSpan().StartLinePosition.Line + 1));
        }
    }

    /// <summary>Named types a file declares; a C# 14 extension block extends another type and names none.</summary>
    private static ScanSymbol[] DeclaredSymbols(SyntaxNode root, SemanticModel model, CancellationToken token) =>
        root.DescendantNodes().OfType<MemberDeclarationSyntax>()
            .Where(declaration => declaration is (BaseTypeDeclarationSyntax and not ExtensionBlockDeclarationSyntax) or DelegateDeclarationSyntax)
            .Select(declaration =>
            {
                INamedTypeSymbol symbol = model.GetDeclaredSymbol(declaration, token) as INamedTypeSymbol
                    ?? throw new InvalidDataException("Roslyn could not resolve a type declaration.");
                return new ScanSymbol(symbol.ToDisplayString(SymbolDisplayFormat.FullyQualifiedFormat), symbol.Name, DeclarationKind(declaration));
            }).ToArray();

    private static string DeclarationKind(MemberDeclarationSyntax declaration) => declaration switch
    {
        RecordDeclarationSyntax record when record.ClassOrStructKeyword.IsKind(SyntaxKind.StructKeyword) => "record-struct",
        RecordDeclarationSyntax => "record",
        ClassDeclarationSyntax => "class",
        InterfaceDeclarationSyntax => "interface",
        StructDeclarationSyntax => "struct",
        EnumDeclarationSyntax => "enum",
        DelegateDeclarationSyntax => "delegate",
        _ => throw new InvalidDataException($"Unsupported type declaration: {declaration.Kind()}."),
    };

    private static string NormalizeMessage(string message, string root)
    {
        string normalized = message.Replace(root, ".", StringComparison.Ordinal);
        string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        return string.IsNullOrEmpty(home) ? normalized : normalized.Replace(home, "$HOME", StringComparison.Ordinal);
    }
}
