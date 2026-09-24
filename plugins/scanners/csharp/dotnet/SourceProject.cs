using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Text;

namespace Groma.CSharpScanner;

/// <summary>
/// Builds one Roslyn solution from the project graph without MSBuild or package restore: each project's declared
/// language context, its compile sources and every project it reaches through its references.
/// </summary>
internal static class SourceProject
{
    private static readonly string[] ImplicitNamespaces =
        ["System", "System.Collections.Generic", "System.IO", "System.Linq", "System.Net.Http", "System.Threading", "System.Threading.Tasks"];

    public static async Task<Solution> LoadAsync(AdhocWorkspace workspace, ProjectGraph graph, ScanRequest request, CancellationToken cancellationToken)
    {
        Solution solution = workspace.CurrentSolution;
        // Runtime reference assemblies are supplied by the scanner, not the project's SDK.
        MetadataReference[] references = ((string?)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES") ?? "")
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
            .Select(file => MetadataReference.CreateFromFile(file)).ToArray();
        Dictionary<string, ProjectId> ids = graph.Projects.ToDictionary(project => project.File.Path, _ => ProjectId.CreateNewId(), StringComparer.Ordinal);
        foreach (ProjectNode project in graph.Projects)
        {
            ProjectId id = ids[project.File.Path];
            solution = solution.AddProject(ProjectInfo.Create(id, VersionStamp.Create(), project.Name, project.Name, LanguageNames.CSharp,
                filePath: project.File.Path,
                parseOptions: new CSharpParseOptions(Version(project.File, graph.Root), preprocessorSymbols: Symbols(project.File, request)),
                compilationOptions: new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary, allowUnsafe: project.File.IsTrue("AllowUnsafeBlocks")),
                metadataReferences: references));
            foreach (string source in project.Sources)
                solution = solution.AddDocument(DocumentId.CreateNewId(id), Path.GetFileName(source), SourceText.From(await File.ReadAllTextAsync(source, cancellationToken)), filePath: source);
            if (GlobalUsings(project.File) is string usings)
                solution = solution.AddDocument(DocumentId.CreateNewId(id), "GlobalUsings", SourceText.From(usings));
        }
        foreach (ProjectNode project in graph.Projects)
        {
            ProjectId id = ids[project.File.Path];
            foreach (string reference in project.References)
                solution = solution.AddProjectReference(id, new ProjectReference(ids[reference]));
            if (await IsExecutableAsync(project.File, solution.GetProject(id)!, cancellationToken))
                solution = solution.WithProjectCompilationOptions(id, solution.GetProject(id)!.CompilationOptions!.WithOutputKind(OutputKind.ConsoleApplication));
        }
        return solution;
    }

    /// <summary>
    /// An explicit OutputType wins, the Web and Worker SDKs default to Exe, and otherwise top-level statements make an
    /// executable, because C# accepts them in no other kind of project.
    /// </summary>
    private static async Task<bool> IsExecutableAsync(ProjectFile file, Project project, CancellationToken cancellationToken)
    {
        if (file.Property("OutputType") is string declared)
            return declared.Equals("Exe", StringComparison.OrdinalIgnoreCase) || declared.Equals("WinExe", StringComparison.OrdinalIgnoreCase);
        if (file.Sdks.Any(sdk => sdk.Equals("Microsoft.NET.Sdk.Web", StringComparison.OrdinalIgnoreCase) || sdk.Equals("Microsoft.NET.Sdk.Worker", StringComparison.OrdinalIgnoreCase)))
            return true;
        foreach (Document document in project.Documents)
            if (await document.GetSyntaxRootAsync(cancellationToken) is CompilationUnitSyntax unit && unit.Members.OfType<GlobalStatementSyntax>().Any()) return true;
        return false;
    }

    private static LanguageVersion Version(ProjectFile file, string root)
    {
        if (file.Property("LangVersion") is not string declared) return LanguageVersion.Latest;
        return LanguageVersionFacts.TryParse(declared, out LanguageVersion version)
            ? version : throw new InvalidDataException($"Unsupported C# language version '{declared}' in {SourcePath.Relative(root, file.Path)}.");
    }

    /// <summary>Declared constants, plus DEBUG and TRACE, which the SDK defines for the Debug configuration.</summary>
    private static string[] Symbols(ProjectFile file, ScanRequest request)
    {
        IEnumerable<string> declared = (file.Property("DefineConstants") ?? "")
            .Split([';', ','], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Where(SyntaxFacts.IsValidIdentifier);
        return [.. declared.Concat(request.Configuration == "Debug" ? ["DEBUG", "TRACE"] : []).Distinct(StringComparer.Ordinal)];
    }

    /// <summary>
    /// The global usings the SDK generates: the implicit namespaces when ImplicitUsings is enabled, then each Using item
    /// in order, which may add a namespace, a static type or an alias, or remove one.
    /// </summary>
    private static string? GlobalUsings(ProjectFile file)
    {
        List<(string Name, string? Alias, bool Static)> usings = file.Property("ImplicitUsings") is string implicitUsings
            && (implicitUsings.Equals("enable", StringComparison.OrdinalIgnoreCase) || implicitUsings.Equals("true", StringComparison.OrdinalIgnoreCase))
            ? [.. ImplicitNamespaces.Select(name => (name, (string?)null, false))] : [];
        foreach (ProjectItem item in file.Items.Where(item => item.Type == "Using"))
        {
            foreach (string name in Names(item.Include))
            {
                usings.RemoveAll(existing => existing.Name == name);
                usings.Add((name, item.Value("Alias"), item.Value("Static")?.Equals("true", StringComparison.OrdinalIgnoreCase) == true));
            }
            foreach (string name in Names(item.Remove)) usings.RemoveAll(existing => existing.Name == name);
        }
        return usings.Count == 0 ? null : string.Join('\n', usings.Select(item =>
            item.Alias is not null ? $"global using {item.Alias} = global::{item.Name};"
            : item.Static ? $"global using static global::{item.Name};" : $"global using global::{item.Name};"));
    }

    private static string[] Names(string? value) => (value ?? "").Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
