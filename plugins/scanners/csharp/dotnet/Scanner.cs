using Microsoft.Build.Locator;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.MSBuild;
using System.Collections.Concurrent;

namespace Groma.CSharpScanner;

public sealed class RoslynScanner
{
    public async Task<ScanObservation> ScanAsync(ScanRequest request, CancellationToken cancellationToken = default)
    {
        request = request with { Input = Path.GetFullPath(request.Input), RepositoryRoot = Path.GetFullPath(request.RepositoryRoot) };
        request.Validate();
        string[] expected = ProjectInput.ExpectedProjects(request);
        VisualStudioInstance sdk = ProjectInput.RegisterMSBuild(request.Input);
        ConcurrentQueue<WorkspaceDiagnostic> workspaceDiagnostics = new();
        using MSBuildWorkspace workspace = MSBuildWorkspace.Create(new Dictionary<string, string>
        {
            ["Configuration"] = request.Configuration,
            ["NuGetAudit"] = "false",
        });
        workspace.LoadMetadataForReferencedProjects = false;
        workspace.SkipUnrecognizedProjects = false;
        workspace.RegisterWorkspaceFailedHandler(args => workspaceDiagnostics.Enqueue(args.Diagnostic));
        bool isProject = request.Input.EndsWith(".csproj", StringComparison.OrdinalIgnoreCase);
        Solution solution = isProject
            ? (await workspace.OpenProjectAsync(request.Input, cancellationToken: cancellationToken)).Solution
            : await workspace.OpenSolutionAsync(request.Input, cancellationToken: cancellationToken);
        ThrowIfWorkspaceFailed(workspaceDiagnostics, request.RepositoryRoot);
        Project[] projects = ProjectInput.ValidateLoaded(solution, request, expected);
        Dictionary<ProjectId, string> scopes = projects.ToDictionary(project => project.Id,
            project => $"scope:{SourcePath.Relative(request.RepositoryRoot, project.FilePath!)}");
        List<ScanFile> files = [];
        List<ScanPlacement> placements = [];
        HashSet<ScanRelationship> relationships = [];
        List<ScanDiagnostic> diagnostics = [];
        OperationEvidence evidence = new(request.RepositoryRoot);

        foreach (Project project in projects)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Compilation compilation = await project.GetCompilationAsync(cancellationToken)
                ?? throw new InvalidDataException($"Roslyn could not compile '{project.Name}'.");
            CheckCompilation(compilation, project, request.RepositoryRoot, diagnostics, cancellationToken);
            foreach (Document document in project.Documents.OrderBy(document => document.FilePath, StringComparer.Ordinal))
            {
                if (!SourcePath.IsPhysicalSource(request.RepositoryRoot, document.FilePath)) continue;
                string file = SourcePath.Relative(request.RepositoryRoot, document.FilePath!);
                SyntaxTree tree = await document.GetSyntaxTreeAsync(cancellationToken)
                    ?? throw new InvalidDataException($"Roslyn could not parse '{file}'.");
                SemanticModel model = compilation.GetSemanticModel(tree);
                SyntaxNode root = await tree.GetRootAsync(cancellationToken);
                files.Add(new ScanFile(file, DeclaredSymbols(root, model, cancellationToken)));
                placements.Add(new ScanPlacement(file, scopes[project.Id]));
                ExtractDependencies(root, model, file, request.RepositoryRoot, relationships, cancellationToken);
                evidence.Extract(root, model, file, cancellationToken);
            }
            foreach (ProjectReference reference in project.ProjectReferences)
            {
                if (!scopes.TryGetValue(reference.ProjectId, out string? target))
                    throw new InvalidDataException("A source project reference was not loaded; no observation will be published.");
                relationships.Add(new ScanRelationship(scopes[project.Id], target, "project-reference"));
            }
        }
        ThrowIfWorkspaceFailed(workspaceDiagnostics, request.RepositoryRoot);
        HashSet<string> included = files.Select(file => file.File).ToHashSet(StringComparer.Ordinal);
        // Generated implementations and metadata are not physical repository-file endpoints.
        relationships.RemoveWhere(relationship => relationship.Kind == "source-dependency" && !included.Contains(relationship.Target));
        diagnostics.AddRange(workspaceDiagnostics.Select(diagnostic => new ScanDiagnostic("warning", "MSBUILD_WORKSPACE", NormalizeMessage(diagnostic.Message, request.RepositoryRoot))));
        diagnostics.Add(new ScanDiagnostic("info", "CSHARP_CONTEXT", $"MSBuild SDK {sdk.Version}; configuration {request.Configuration}; {projects.Length} projects. One loaded compilation context per physical project."));
        diagnostics.Add(new ScanDiagnostic("info", "CSHARP_OPERATION_SCOPE", "Explicit calls and constructions in implemented methods, accessors, local functions, lambdas and top-level statements. Implicit language calls, initializers, generated operations, receiver/delegate value flow, DI and protocol wiring are not resolved. Direct calls are evidence, not automatically architecture relationships."));
        return ScanObservation.Create(
            new ScannerIdentity("csharp", "roslyn", typeof(CSharpCompilation).Assembly.GetName().Version!.ToString()),
            new ScanRoot(isProject ? "project" : "solution", Path.GetFileNameWithoutExtension(request.Input), SourcePath.Relative(request.RepositoryRoot, request.Input)),
            projects.Select(project => new ScanScope(scopes[project.Id], project.Name)),
            files, placements, relationships, diagnostics, evidence.Operations, evidence.Invocations);
    }

    private static void CheckCompilation(Compilation compilation, Project project, string root, List<ScanDiagnostic> diagnostics, CancellationToken token)
    {
        Diagnostic[] errors = compilation.GetDiagnostics(token)
            .Where(diagnostic => diagnostic.Severity == DiagnosticSeverity.Error)
            .OrderBy(diagnostic => diagnostic.Location.SourceTree?.FilePath, StringComparer.Ordinal)
            .ThenBy(diagnostic => diagnostic.Location.SourceSpan.Start)
            .ThenBy(diagnostic => diagnostic.Id, StringComparer.Ordinal).ToArray();
        if (errors.Length > 0)
            throw new InvalidDataException($"Compilation failed for '{SourcePath.Relative(root, project.FilePath!)}' ({errors.Length} errors). Restore the selected project explicitly and fix compilation errors.\n" +
                string.Join("\n", errors.Take(5).Select(error => NormalizeMessage(error.ToString(), root))));
        if (project.AnalyzerReferences.Count > 0)
            diagnostics.Add(new ScanDiagnostic("info", "CSHARP_GENERATED_SCOPE", $"{SourcePath.Relative(root, project.FilePath!)}: compiler generators may contribute semantic input; generated documents are not emitted as primary source files."));
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

    private static void ExtractDependencies(SyntaxNode root, SemanticModel model, string file, string repositoryRoot, HashSet<ScanRelationship> relationships, CancellationToken token)
    {
        foreach (NameSyntax name in root.DescendantNodes().OfType<NameSyntax>())
        {
            if (name.Ancestors().Any(ancestor => ancestor is UsingDirectiveSyntax)) continue;
            ISymbol? referenced = model.GetSymbolInfo(name, token).Symbol;
            if (referenced is INamespaceSymbol) continue;
            foreach (Location location in referenced?.Locations ?? [])
            {
                string? targetPath = location.SourceTree?.FilePath;
                // A generated syntax tree can have a virtual path without a physical document.
                if (targetPath is null || !File.Exists(targetPath) || !SourcePath.IsPhysicalSource(repositoryRoot, targetPath)) continue;
                string target = SourcePath.Relative(repositoryRoot, targetPath);
                if (target != file) relationships.Add(new ScanRelationship(file, target, "source-dependency"));
            }
        }
    }

    private static void ThrowIfWorkspaceFailed(IEnumerable<WorkspaceDiagnostic> diagnostics, string root)
    {
        WorkspaceDiagnostic? failure = diagnostics.Where(diagnostic => diagnostic.Kind == WorkspaceDiagnosticKind.Failure)
            .OrderBy(diagnostic => diagnostic.Message, StringComparer.Ordinal).FirstOrDefault();
        if (failure is not null) throw new InvalidDataException($"MSBuild workspace failed: {NormalizeMessage(failure.Message, root)}");
    }

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
