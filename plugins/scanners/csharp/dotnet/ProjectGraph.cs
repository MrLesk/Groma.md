using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace Groma.CSharpScanner;

/// <summary>
/// One C# project as a scan compiles it: its evaluated file, its compile sources and every project it reaches through
/// its references, which the SDK passes on transitively.
/// </summary>
internal sealed record ProjectNode(ProjectFile File, string Name, IReadOnlyList<string> Sources, IReadOnlyList<string> References);

/// <summary>
/// The C# projects one request analyzes, each loaded once whatever the number of inputs that name it: solution
/// entries, project inputs and every project they reference. Projects in other languages and projects that are not
/// SDK-style are left out. Each source belongs to every project that compiles it and is analyzed by the first.
/// </summary>
internal sealed partial class ProjectGraph
{
    private readonly Dictionary<string, ProjectNode?> loaded = new(StringComparer.Ordinal);
    private readonly HashSet<string> inventory;
    private readonly string[] sources;
    private readonly ScanRequest request;

    private ProjectGraph(ScanRequest request)
    {
        this.request = request;
        Root = Path.GetFullPath(request.Root);
        inventory = request.Files.Select(file => Path.GetFullPath(Path.Combine(Root, file))).ToHashSet(StringComparer.Ordinal);
        sources = [.. inventory.Where(file => file.EndsWith(".cs", StringComparison.OrdinalIgnoreCase)).Order(StringComparer.Ordinal)];
    }

    public string Root { get; }

    /// <summary>Loaded projects in path order.</summary>
    public List<ProjectNode> Projects { get; } = [];

    /// <summary>The first input solution, in path order, that lists each project.</summary>
    public Dictionary<string, string> Solutions { get; } = new(StringComparer.Ordinal);

    /// <summary>Every project that compiles each repository source, in path order; the first one analyzes it.</summary>
    public Dictionary<string, List<string>> CompilingProjects { get; } = new(StringComparer.Ordinal);

    public List<ScanDiagnostic> Skipped { get; } = [];

    public bool Analyzes(ProjectNode project, string source) =>
        CompilingProjects.TryGetValue(source, out List<string>? projects) && projects[0] == project.File.Path;

    public static ProjectGraph Load(ScanRequest request)
    {
        request.Validate();
        ProjectGraph graph = new(request);
        foreach (string input in request.Inputs.Select(input => Path.GetFullPath(Path.Combine(graph.Root, input))).Order(StringComparer.Ordinal))
        {
            if (input.EndsWith(".csproj", StringComparison.OrdinalIgnoreCase)) graph.Visit(input);
            else foreach (string project in SolutionProjects(input).Where(project => project.EndsWith(".csproj", StringComparison.OrdinalIgnoreCase)))
            {
                graph.Solutions.TryAdd(project, input);
                graph.Visit(project);
            }
        }
        graph.Projects.Sort((left, right) => string.CompareOrdinal(left.File.Path, right.File.Path));
        foreach (ProjectNode project in graph.Projects)
            foreach (string source in project.Sources.Where(graph.inventory.Contains))
            {
                if (!graph.CompilingProjects.TryGetValue(source, out List<string>? projects)) graph.CompilingProjects[source] = projects = [];
                projects.Add(project.File.Path);
            }
        if (graph.CompilingProjects.Count > request.MaxFiles) throw new InvalidDataException($"Source file limit exceeded ({request.MaxFiles}); select a smaller input.");
        return graph;
    }

    /// <summary>The project paths a .sln or .slnx lists, in any language; solution folders name no project file.</summary>
    private static IEnumerable<string> SolutionProjects(string solution)
    {
        IEnumerable<string> paths = solution.EndsWith(".slnx", StringComparison.OrdinalIgnoreCase)
            ? XDocument.Load(solution).Descendants().Where(element => element.Name.LocalName == "Project")
                .Select(project => (string?)project.Attribute("Path")).OfType<string>()
            : SolutionEntry().Matches(File.ReadAllText(solution)).Select(match => match.Groups[1].Value);
        return paths.Select(path => Path.GetFullPath(Path.Combine(Path.GetDirectoryName(solution)!, ProjectFile.Slashes(path)))).Distinct(StringComparer.Ordinal);
    }

    /// <summary>
    /// Loads a project once, after the projects it references, so each reference's own list is already complete. Only a
    /// project in the repository's inventory loads, so a project the host excluded is never read, whether an input, a
    /// solution entry or a reference names it.
    /// </summary>
    private ProjectNode? Visit(string project)
    {
        if (loaded.TryGetValue(project, out ProjectNode? known)) return known;
        loaded[project] = null;
        if (!inventory.Contains(project)) return null;
        ProjectFile file = ProjectFile.Load(project, Root);
        if (file.Sdks.Count == 0)
        {
            Skipped.Add(new ScanDiagnostic("warning", "CSHARP_UNSUPPORTED_PROJECT", "Not an SDK-style project, so its source is not analyzed.",
                SourcePath.Relative(Root, project)));
            return null;
        }
        List<string> references = [];
        foreach (string include in file.Items.Where(item => item.Type == "ProjectReference" && item.Include is not null).SelectMany(item => Split(item.Include!)))
        {
            string target = Path.GetFullPath(Path.Combine(file.Directory, ProjectFile.Slashes(include)));
            if (target.EndsWith(".csproj", StringComparison.OrdinalIgnoreCase) && Visit(target) is ProjectNode referenced)
                references.AddRange([target, .. referenced.References]);
        }
        ProjectNode node = new(file, file.Property("AssemblyName") ?? Path.GetFileNameWithoutExtension(project),
            CompileSources(file), [.. references.Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal)]);
        loaded[project] = node;
        Projects.Add(node);
        if (Projects.Count > request.MaxProjects) throw new InvalidDataException($"Project limit exceeded ({request.MaxProjects}); select a smaller input.");
        return node;
    }

    /// <summary>
    /// The files a project compiles, as MSBuild orders its Compile items: the default glob over the project directory,
    /// then each Include and Remove in document order. Repository files come from the inventory; an explicit file outside
    /// the repository is compilation context only.
    /// </summary>
    private List<string> CompileSources(ProjectFile file)
    {
        List<string> compiled = [];
        HashSet<string> included = new(StringComparer.Ordinal);
        void Add(IEnumerable<string> files) => compiled.AddRange(files.Where(included.Add));
        if (!file.IsFalse("EnableDefaultCompileItems") && !file.IsFalse("EnableDefaultItems"))
            Add(sources.Where(source => SourcePath.IsInside(file.Directory, source)));
        foreach (ProjectItem item in file.Items.Where(item => item.Type == "Compile"))
        {
            if (item.Include is not null)
            {
                Func<string, bool>[] excluded = [.. Split(item.Exclude ?? "").Select(pattern => Glob(file, pattern))];
                foreach (string pattern in Split(item.Include))
                    Add(Matching(file, pattern).Where(source => !excluded.Any(exclude => exclude(source))));
            }
            if (item.Remove is null) continue;
            foreach (Func<string, bool> removed in Split(item.Remove).Select(pattern => Glob(file, pattern)))
            {
                compiled.RemoveAll(source => removed(source));
                included.RemoveWhere(source => removed(source));
            }
        }
        return compiled;
    }

    private IEnumerable<string> Matching(ProjectFile file, string pattern)
    {
        if (pattern.Contains('*') || pattern.Contains('?')) return sources.Where(Glob(file, pattern));
        string literal = Path.GetFullPath(Path.Combine(file.Directory, ProjectFile.Slashes(pattern)));
        bool context = !SourcePath.IsInside(Root, literal) && literal.EndsWith(".cs", StringComparison.OrdinalIgnoreCase) && File.Exists(literal);
        return context || Array.BinarySearch(sources, literal, StringComparer.Ordinal) >= 0 ? [literal] : [];
    }

    /// <summary>An MSBuild item pattern, relative to the project directory, as a test on absolute source paths.</summary>
    private static Func<string, bool> Glob(ProjectFile file, string pattern)
    {
        string expression = Regex.Escape(pattern.Replace('\\', '/')).Replace(@"\*\*/", "(?:.*/)?").Replace(@"\*\*", ".*").Replace(@"\*", "[^/]*").Replace(@"\?", "[^/]");
        Regex regex = new("^" + expression + "$", RegexOptions.CultureInvariant);
        return source => regex.IsMatch(SourcePath.Relative(file.Directory, source));
    }

    private static string[] Split(string value) => value.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    [GeneratedRegex("\"([^\"]+\\.[A-Za-z]+proj)\"", RegexOptions.IgnoreCase)]
    private static partial Regex SolutionEntry();
}
