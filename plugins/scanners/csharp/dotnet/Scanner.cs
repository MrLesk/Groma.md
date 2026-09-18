using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Groma.CSharpScanner;

public sealed class RoslynScanner
{
    public async Task<ScanObservation> ScanAsync(ScanRequest request, CancellationToken cancellationToken = default)
    {
        request = request with { Input = Path.GetFullPath(request.Input), RepositoryRoot = Path.GetFullPath(request.RepositoryRoot) };
        request.Validate();
        string[] expected = ProjectInput.ExpectedProjects(request);
        using AdhocWorkspace workspace = new();
        bool isProject = request.Input.EndsWith(".csproj", StringComparison.OrdinalIgnoreCase);
        Solution solution = SourceProject.Load(workspace, request, expected);
        Project[] projects = ProjectInput.ValidateLoaded(solution, request, expected);
        Dictionary<ProjectId, string> rootIds = projects.ToDictionary(project => project.Id,
            project => $"project:{SourcePath.Relative(request.RepositoryRoot, project.FilePath!)}");
        List<ScanFile> files = [];
        List<ScanSourceUnit> sourceUnits = [];
        List<ScanDiagnostic> diagnostics = [];
        OperationEvidence evidence = new(request.RepositoryRoot);
        HttpEvidence http = new(request.RepositoryRoot);

        foreach (Project project in projects)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Compilation compilation = await project.GetCompilationAsync(cancellationToken)
                ?? throw new InvalidDataException($"Roslyn could not compile '{project.Name}'.");
            CheckCompilation(compilation, project, request.RepositoryRoot, diagnostics, cancellationToken);
            sourceUnits.AddRange(PartialSourceUnits.Extract(compilation, request.RepositoryRoot, cancellationToken));
            foreach (Document document in project.Documents.OrderBy(document => document.FilePath, StringComparer.Ordinal))
            {
                if (!SourcePath.IsPhysicalSource(request.RepositoryRoot, document.FilePath)) continue;
                string file = SourcePath.Relative(request.RepositoryRoot, document.FilePath!);
                SyntaxTree tree = await document.GetSyntaxTreeAsync(cancellationToken)
                    ?? throw new InvalidDataException($"Roslyn could not parse '{file}'.");
                SemanticModel model = compilation.GetSemanticModel(tree);
                SyntaxNode root = await tree.GetRootAsync(cancellationToken);
                files.Add(new ScanFile(file, [rootIds[project.Id]], DeclaredSymbols(root, model, cancellationToken)));
                http.Extract(root, model, file, evidence.Extract(root, model, file, cancellationToken), cancellationToken);
            }
            foreach (ProjectReference reference in project.ProjectReferences)
            {
                if (!rootIds.ContainsKey(reference.ProjectId))
                    throw new InvalidDataException("A source project reference was not loaded; no observation will be published.");
            }
        }
        diagnostics.Add(new ScanDiagnostic("info", "CSHARP_CONTEXT", $"Declared C# source; configuration {request.Configuration}; {projects.Length} projects. External packages, MSBuild imports and source generators are not executed."));
        diagnostics.Add(new ScanDiagnostic("info", "CSHARP_OPERATION_SCOPE", "Explicit calls and constructions in implemented methods, accessors, local functions, lambdas and top-level statements. Implicit language calls, initializers, generated operations, receiver/delegate value flow, DI and protocol wiring are not resolved. Direct calls are evidence, not automatically architecture relationships."));
        string inputFile = SourcePath.Relative(request.RepositoryRoot, request.Input);
        string? solutionId = isProject ? null : $"solution:{inputFile}";
        List<ScanRoot> roots = projects.Select(project => new ScanRoot(rootIds[project.Id], "project", project.Name,
            SourcePath.Relative(request.RepositoryRoot, project.FilePath!), solutionId)).ToList();
        if (solutionId is not null)
            roots.Add(new ScanRoot(solutionId, "solution", Path.GetFileNameWithoutExtension(request.Input), inputFile));
        ScanOperation[] operations = [.. evidence.Operations, .. http.Operations];
        var (served, sent) = http.Facts(operations.Select(operation => operation.Id).ToHashSet(StringComparer.Ordinal));
        return ScanObservation.Create(
            new ScannerIdentity("csharp", "c#/.NET", "roslyn", typeof(CSharpCompilation).Assembly.GetName().Version!.ToString()),
            roots, files, diagnostics, operations, evidence.Invocations, sourceUnits, served, sent);
    }

    private static void CheckCompilation(Compilation compilation, Project project, string root, List<ScanDiagnostic> diagnostics, CancellationToken token)
    {
        Diagnostic[] errors = compilation.GetDiagnostics(token)
            .Where(diagnostic => diagnostic.Severity == DiagnosticSeverity.Error)
            .OrderBy(diagnostic => diagnostic.Location.SourceTree?.FilePath, StringComparer.Ordinal)
            .ThenBy(diagnostic => diagnostic.Location.SourceSpan.Start)
            .ThenBy(diagnostic => diagnostic.Id, StringComparer.Ordinal).ToArray();
        foreach (SyntaxTree tree in compilation.SyntaxTrees)
            if (tree.GetDiagnostics(token).Any(diagnostic => diagnostic.Severity == DiagnosticSeverity.Error))
                throw new InvalidDataException($"Invalid C# syntax in '{tree.FilePath}'.");
        diagnostics.AddRange(errors.Select(error => new ScanDiagnostic("warning", error.Id, NormalizeMessage(error.ToString(), root))));
    }

    private static ScanSymbol[] DeclaredSymbols(SyntaxNode root, SemanticModel model, CancellationToken token) =>
        root.DescendantNodes().OfType<MemberDeclarationSyntax>()
            .Where(declaration => declaration is BaseTypeDeclarationSyntax or DelegateDeclarationSyntax)
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
        _ => throw new InvalidDataException("Unsupported type declaration."),
    };

    private static string NormalizeMessage(string message, string root)
    {
        string normalized = message.Replace(root, ".", StringComparison.Ordinal);
        string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        return string.IsNullOrEmpty(home) ? normalized : normalized.Replace(home, "$HOME", StringComparison.Ordinal);
    }
}
