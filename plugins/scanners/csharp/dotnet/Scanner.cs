using Microsoft.Build.Locator;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.MSBuild;
using System.Text.RegularExpressions;

namespace Groma.CSharpScanner;

public sealed class RoslynScanner
{
    private static readonly object MSBuildRegistrationLock = new();

    public async Task<ScanObservation> ScanAsync(string inputPath, CancellationToken cancellationToken = default)
    {
        string input = Path.GetFullPath(inputPath);
        if (!File.Exists(input))
            throw new FileNotFoundException("Scan input does not exist.", input);

        string extension = Path.GetExtension(input);
        if (extension is not (".sln" or ".csproj"))
            throw new InvalidDataException("Scan input must be a .sln or .csproj file.");

        RegisterMSBuild();
        string rootDirectory = Path.GetDirectoryName(input)!;
        HashSet<string> expectedProjects = FindExpectedProjects(input, rootDirectory);
        List<WorkspaceDiagnostic> workspaceDiagnostics = [];
        using MSBuildWorkspace workspace = MSBuildWorkspace.Create(new Dictionary<string, string>
        {
            ["NuGetAudit"] = "false",
        });
        workspace.LoadMetadataForReferencedProjects = false;
        workspace.RegisterWorkspaceFailedHandler(args => workspaceDiagnostics.Add(args.Diagnostic));

        Solution solution = extension == ".sln"
            ? await workspace.OpenSolutionAsync(input, cancellationToken: cancellationToken)
            : (await workspace.OpenProjectAsync(input, cancellationToken: cancellationToken)).Solution;

        Dictionary<string, ScanScope> scopes = new(StringComparer.Ordinal);
        Dictionary<string, HashSet<ScanSymbol>> symbolsByFile = new(StringComparer.Ordinal);
        HashSet<ScanPlacement> placements = [];
        HashSet<ScanRelationship> relationships = [];
        Dictionary<ProjectId, string> scopeByProject = new();

        foreach (Project project in solution.Projects.OrderBy(project => project.FilePath, StringComparer.Ordinal))
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (project.FilePath is null || Path.GetExtension(project.FilePath) != ".csproj")
                continue;

            string projectPath = RelativePath(rootDirectory, project.FilePath);
            string scopeId = $"scope:{projectPath}";
            scopes.TryAdd(scopeId, new ScanScope(scopeId, project.Name));
            scopeByProject[project.Id] = scopeId;
            Compilation compilation = await project.GetCompilationAsync(cancellationToken)
                ?? throw new InvalidDataException($"Roslyn could not compile scope '{scopeId}'.");

            foreach (Document document in project.Documents.OrderBy(document => document.FilePath, StringComparer.Ordinal))
            {
                if (!IsSourceFile(rootDirectory, document.FilePath))
                    continue;

                string file = RelativePath(rootDirectory, document.FilePath!);
                placements.Add(new ScanPlacement(file, scopeId));
                if (!symbolsByFile.TryGetValue(file, out HashSet<ScanSymbol>? symbols))
                    symbolsByFile[file] = symbols = [];

                SyntaxTree? tree = await document.GetSyntaxTreeAsync(cancellationToken);
                if (tree is null)
                    throw new InvalidDataException($"Roslyn could not parse '{file}'.");

                SemanticModel semanticModel = compilation.GetSemanticModel(tree);
                SyntaxNode root = await tree.GetRootAsync(cancellationToken);
                foreach (NameSyntax name in root.DescendantNodes().OfType<NameSyntax>())
                {
                    ISymbol? referenced = semanticModel.GetSymbolInfo(name, cancellationToken).Symbol;
                    foreach (Location location in referenced?.Locations ?? [])
                    {
                        string? targetPath = location.SourceTree?.FilePath;
                        if (!IsSourceFile(rootDirectory, targetPath))
                            continue;
                        string target = RelativePath(rootDirectory, targetPath!);
                        if (target != file)
                            relationships.Add(new ScanRelationship(file, target, "source-dependency"));
                    }
                }
                foreach (MemberDeclarationSyntax declaration in root.DescendantNodes().OfType<MemberDeclarationSyntax>())
                {
                    if (declaration is not BaseTypeDeclarationSyntax and not DelegateDeclarationSyntax)
                        continue;

                    ISymbol? symbol = semanticModel.GetDeclaredSymbol(declaration, cancellationToken);
                    if (symbol is not INamedTypeSymbol namedType)
                        throw new InvalidDataException($"Roslyn could not resolve a type declaration in '{file}'.");

                    symbols.Add(new ScanSymbol(
                        Id: namedType.ToDisplayString(SymbolDisplayFormat.FullyQualifiedFormat),
                        Name: namedType.Name,
                        Kind: DeclarationKind(declaration)));
                }
            }
        }

        foreach (Project project in solution.Projects)
        {
            if (!scopeByProject.TryGetValue(project.Id, out string? sourceScope))
                continue;
            foreach (ProjectReference reference in project.ProjectReferences)
            {
                if (scopeByProject.TryGetValue(reference.ProjectId, out string? targetScope))
                    relationships.Add(new ScanRelationship(sourceScope, targetScope, "project-reference"));
            }
        }

        ThrowIfIncomplete(workspaceDiagnostics, expectedProjects, solution, rootDirectory);
        return ScanObservation.Create(
            new ScannerIdentity(
                Language: "csharp",
                Engine: "roslyn",
                EngineVersion: typeof(CSharpCompilation).Assembly.GetName().Version!.ToString()),
            new ScanRoot(
                extension == ".sln" ? "solution" : "project",
                Path.GetFileNameWithoutExtension(input),
                RelativePath(rootDirectory, input)),
            scopes.Values,
            symbolsByFile.Select(pair => new ScanFile(pair.Key, pair.Value.ToArray())),
            placements,
            relationships,
            workspaceDiagnostics.Select(diagnostic => new ScanDiagnostic(
                diagnostic.Kind == WorkspaceDiagnosticKind.Failure ? "error" : "warning",
                "MSBUILD_WORKSPACE",
                NormalizeMessage(diagnostic.Message, rootDirectory))));
    }

    private static void RegisterMSBuild()
    {
        lock (MSBuildRegistrationLock)
        {
            if (!MSBuildLocator.IsRegistered)
                MSBuildLocator.RegisterDefaults();
        }
    }

    private static HashSet<string> FindExpectedProjects(string input, string rootDirectory)
    {
        if (Path.GetExtension(input) == ".csproj")
            return [RelativePath(rootDirectory, input)];

        return Regex.Matches(File.ReadAllText(input), "\"([^\"]+\\.csproj)\"", RegexOptions.IgnoreCase)
            .Select(match => match.Groups[1].Value.Replace('\\', Path.DirectorySeparatorChar))
            .Select(path => RelativePath(rootDirectory, Path.Combine(rootDirectory, path)))
            .ToHashSet(StringComparer.Ordinal);
    }

    private static void ThrowIfIncomplete(
        IReadOnlyCollection<WorkspaceDiagnostic> diagnostics,
        IReadOnlySet<string> expectedProjects,
        Solution solution,
        string rootDirectory)
    {
        WorkspaceDiagnostic? failure = diagnostics.FirstOrDefault(diagnostic => diagnostic.Kind == WorkspaceDiagnosticKind.Failure);
        if (failure is not null)
            throw new InvalidDataException($"MSBuild workspace failed: {NormalizeMessage(failure.Message, rootDirectory)}");

        HashSet<string> loadedProjects = solution.Projects
            .Where(project => project.FilePath is not null && Path.GetExtension(project.FilePath) == ".csproj")
            .Select(project => RelativePath(rootDirectory, project.FilePath!))
            .ToHashSet(StringComparer.Ordinal);
        string[] missing = expectedProjects.Except(loadedProjects, StringComparer.Ordinal).Order(StringComparer.Ordinal).ToArray();
        if (missing.Length > 0)
            throw new InvalidDataException($"MSBuild workspace omitted projects: {string.Join(", ", missing)}");
    }

    private static bool IsSourceFile(string rootDirectory, string? path)
    {
        if (path is null || Path.GetExtension(path) != ".cs" || !File.Exists(path))
            return false;
        string relative = RelativePath(rootDirectory, path);
        string[] segments = relative.Split('/');
        return relative != ".."
            && !relative.StartsWith("../", StringComparison.Ordinal)
            && !segments.Contains("obj", StringComparer.OrdinalIgnoreCase)
            && !segments.Contains("bin", StringComparer.OrdinalIgnoreCase);
    }

    private static string RelativePath(string rootDirectory, string path) =>
        Path.GetRelativePath(rootDirectory, Path.GetFullPath(path)).Replace('\\', '/');

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

    private static string NormalizeMessage(string message, string rootDirectory)
    {
        string normalized = message.Replace(rootDirectory, ".", StringComparison.Ordinal);
        string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        return string.IsNullOrEmpty(home) ? normalized : normalized.Replace(home, "$HOME", StringComparison.Ordinal);
    }
}
