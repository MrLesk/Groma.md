using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace Groma.CSharpScanner;

/// <summary>Loads declared source and local project references without MSBuild or package restore.</summary>
internal static class SourceProject
{
    public static Solution Load(AdhocWorkspace workspace, ScanRequest request, string[] expected)
    {
        Dictionary<string, (ProjectId Id, XElement Xml)> projects = new(StringComparer.Ordinal);
        void Add(string file)
        {
            file = Path.GetFullPath(file);
            if (projects.ContainsKey(file)) return;
            SourcePath.RequireInside(request.RepositoryRoot, file);
            XElement xml = XDocument.Load(file).Root ?? throw new InvalidDataException("Project XML has no root.");
            projects.Add(file, (ProjectId.CreateNewId(), xml));
            if (projects.Count > request.MaxProjects) throw new InvalidDataException("Project limit exceeded.");
            foreach (string reference in Items(xml, "ProjectReference", "Include"))
                Add(Path.Combine(Path.GetDirectoryName(file)!, reference.Replace('\\', Path.DirectorySeparatorChar)));
        }
        foreach (string file in expected) Add(file);
        Solution solution = workspace.CurrentSolution;
        // Runtime reference assemblies are supplied by the scanner, not the project's SDK.
        MetadataReference[] references = ((string?)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES") ?? "")
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
            .Select(file => MetadataReference.CreateFromFile(file)).ToArray();
        foreach (var (file, project) in projects)
        {
            string name = Property(project.Xml, "AssemblyName") ?? Path.GetFileNameWithoutExtension(file);
            LanguageVersion version = LanguageVersion.Latest;
            if (Property(project.Xml, "LangVersion") is string declared && !LanguageVersionFacts.TryParse(declared, out version))
                throw new InvalidDataException($"Unsupported C# language version: {declared}");
            string[] constants = (Property(project.Xml, "DefineConstants") ?? "").Split(';', StringSplitOptions.RemoveEmptyEntries);
            if (request.Configuration == "Debug") constants = [.. constants, "DEBUG", "TRACE"];
            solution = solution.AddProject(ProjectInfo.Create(project.Id, VersionStamp.Create(), name, name, LanguageNames.CSharp,
                filePath: file, parseOptions: new CSharpParseOptions(version, preprocessorSymbols: constants),
                compilationOptions: new CSharpCompilationOptions(OutputType(project.Xml) is "Exe" or "WinExe"
                    ? OutputKind.ConsoleApplication : OutputKind.DynamicallyLinkedLibrary), metadataReferences: references));
        }
        foreach (var (file, project) in projects)
        {
            foreach (string source in Sources(file, project.Xml))
                solution = solution.AddDocument(DocumentId.CreateNewId(project.Id), Path.GetFileName(source), SourceText.From(File.ReadAllText(source)), filePath: source);
            if (Property(project.Xml, "ImplicitUsings") is "enable" or "true")
                solution = solution.AddDocument(DocumentId.CreateNewId(project.Id), "ImplicitUsings",
                    SourceText.From("global using System; global using System.Collections.Generic; global using System.IO; global using System.Linq; global using System.Net.Http; global using System.Threading; global using System.Threading.Tasks;"));
            foreach (string reference in Items(project.Xml, "ProjectReference", "Include"))
            {
                string target = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(file)!, reference.Replace('\\', Path.DirectorySeparatorChar)));
                solution = solution.AddProjectReference(project.Id, new ProjectReference(projects[target].Id));
            }
        }
        return solution;
    }

    private static string? Property(XElement xml, string name) => xml.Descendants(name)
        .LastOrDefault(item => item.Attribute("Condition") is null && item.Parent?.Attribute("Condition") is null)?.Value.Trim();

    // Web and Worker SDK props default to Exe; an explicit project property takes precedence.
    private static string OutputType(XElement xml) => Property(xml, "OutputType")
        ?? (((string?)xml.Attribute("Sdk"))?.Split('/')[0] is "Microsoft.NET.Sdk.Web" or "Microsoft.NET.Sdk.Worker" ? "Exe" : "Library");

    private static IEnumerable<string> Items(XElement xml, string name, string attribute) => xml.Descendants(name)
        .Where(item => item.Attribute("Condition") is null && item.Parent?.Attribute("Condition") is null)
        .SelectMany(item => ((string?)item.Attribute(attribute) ?? "").Split(';', StringSplitOptions.RemoveEmptyEntries));

    private static IEnumerable<string> Sources(string project, XElement xml)
    {
        string directory = Path.GetDirectoryName(project)!;
        HashSet<string> files = new(StringComparer.Ordinal);
        if (Property(xml, "EnableDefaultCompileItems") != "false" && Property(xml, "EnableDefaultItems") != "false")
            foreach (string file in Directory.EnumerateFiles(directory, "*.cs", SearchOption.AllDirectories))
                if (SourcePath.IsPhysicalSource(directory, file)) files.Add(file);
        foreach (string include in Items(xml, "Compile", "Include"))
        {
            string pattern = include.Replace('\\', '/');
            if (!pattern.Contains('*') && !pattern.Contains('?')) files.Add(Path.GetFullPath(Path.Combine(directory, pattern)));
            else foreach (string file in Directory.EnumerateFiles(directory, "*.cs", SearchOption.AllDirectories))
                if (Matches(pattern, SourcePath.Relative(directory, file))) files.Add(file);
        }
        foreach (string remove in Items(xml, "Compile", "Remove"))
            files.RemoveWhere(file => Matches(remove.Replace('\\', '/'), SourcePath.Relative(directory, file)));
        return files.Order(StringComparer.Ordinal);
    }

    private static bool Matches(string pattern, string file)
    {
        string expression = Regex.Escape(pattern).Replace(@"\*\*/", "(?:.*/)?").Replace(@"\*\*", ".*").Replace(@"\*", "[^/]*").Replace(@"\?", "[^/]");
        return Regex.IsMatch(file, "^" + expression + "$", RegexOptions.CultureInvariant);
    }
}
