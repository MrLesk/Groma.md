using Microsoft.Build.Locator;
using Microsoft.CodeAnalysis;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace Groma.CSharpScanner;

internal static class ProjectInput
{
    private static readonly object RegistrationLock = new();
    private static string? registeredPath;

    public static VisualStudioInstance RegisterMSBuild(string input)
    {
        lock (RegistrationLock)
        {
            VisualStudioInstance instance = MSBuildLocator.QueryVisualStudioInstances(new VisualStudioInstanceQueryOptions
            {
                WorkingDirectory = Path.GetDirectoryName(Path.GetFullPath(input))!,
                DiscoveryTypes = DiscoveryType.DotNetSdk,
            }).FirstOrDefault() ?? throw new InvalidDataException("No compatible .NET SDK was found for this input. Check its global.json and run groma scanner setup csharp.");
            if (registeredPath is not null && registeredPath != instance.MSBuildPath)
                throw new InvalidDataException("A different project SDK requires a fresh scanner process.");
            if (!MSBuildLocator.IsRegistered)
            {
                MSBuildLocator.RegisterInstance(instance);
                registeredPath = instance.MSBuildPath;
            }
            return instance;
        }
    }

    public static string[] ExpectedProjects(ScanRequest request)
    {
        string extension = Path.GetExtension(request.Input).ToLowerInvariant();
        IEnumerable<string> paths = extension switch
        {
            ".csproj" => [request.Input],
            ".slnx" => XDocument.Load(request.Input).Descendants("Project")
                .Select(project => (string?)project.Attribute("Path") ?? throw new InvalidDataException("Solution project is missing its Path."))
                .Select(path => AbsoluteProject(request.Input, path)),
            _ => Regex.Matches(File.ReadAllText(request.Input), "\"([^\"]+\\.(?:csproj|vbproj|fsproj|vcxproj))\"", RegexOptions.IgnoreCase)
                .Select(match => AbsoluteProject(request.Input, match.Groups[1].Value)),
        };
        string[] expected = paths.Select(Path.GetFullPath).Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal).ToArray();
        if (expected.Length == 0) throw new InvalidDataException("Input contains no supported C# projects.");
        if (expected.Length > request.MaxProjects) throw new InvalidDataException($"Project limit exceeded ({request.MaxProjects}); select a smaller input.");
        foreach (string project in expected) ValidateProjectFile(request.RepositoryRoot, project);
        return expected;
    }

    public static Project[] ValidateLoaded(Solution solution, ScanRequest request, string[] expected)
    {
        Project[] projects = solution.Projects.OrderBy(project => project.FilePath, StringComparer.Ordinal).ToArray();
        if (projects.Length > request.MaxProjects) throw new InvalidDataException($"Project limit exceeded ({request.MaxProjects}); select a smaller input.");
        if (projects.Any(project => project.Language != LanguageNames.CSharp || project.FilePath is null))
            throw new InvalidDataException("This scanner supports C# project graphs only; select a C# project rather than a mixed solution.");
        if (projects.GroupBy(project => Path.GetFullPath(project.FilePath!), StringComparer.Ordinal).Any(group => group.Count() > 1))
            throw new InvalidDataException("Multiple target-framework contexts for one project are unsupported. This prototype does not merge conditional compilations.");
        HashSet<string> loaded = projects.Select(project => Path.GetFullPath(project.FilePath!)).ToHashSet(StringComparer.Ordinal);
        if (expected.Any(path => !loaded.Contains(path))) throw new InvalidDataException("MSBuild omitted a requested project; no observation will be published.");
        Dictionary<string, ProjectId> files = new(StringComparer.Ordinal);
        foreach (Project project in projects)
        {
            ValidateProjectFile(request.RepositoryRoot, project.FilePath!);
            foreach (Document document in project.Documents)
            {
                if (!SourcePath.IsPhysicalSource(request.RepositoryRoot, document.FilePath)) continue;
                string file = SourcePath.Relative(request.RepositoryRoot, document.FilePath!);
                if (files.TryGetValue(file, out ProjectId? owner) && owner != project.Id)
                    throw new InvalidDataException($"Linked source '{file}' belongs to multiple project contexts. Select one project; the shared contract requires one placement per file.");
                files[file] = project.Id;
                if (files.Count > request.MaxFiles) throw new InvalidDataException($"Source file limit exceeded ({request.MaxFiles}); select a smaller input.");
            }
        }
        return projects;
    }

    private static void ValidateProjectFile(string root, string project)
    {
        SourcePath.RequireInside(root, project);
        if (!project.EndsWith(".csproj", StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Only C# SDK-style projects are supported; select a .csproj input.");
        XElement element = XDocument.Load(project).Root ?? throw new InvalidDataException("Project XML has no root.");
        string? sdk = (string?)element.Attribute("Sdk");
        if (sdk is not ("Microsoft.NET.Sdk" or "Microsoft.NET.Sdk.Web" or "Microsoft.NET.Sdk.Worker"))
            throw new InvalidDataException($"Unsupported project SDK in '{SourcePath.Relative(root, project)}'. This prototype supports standard .NET, Web and Worker SDK project headers.");
    }

    private static string AbsoluteProject(string input, string path) =>
        Path.GetFullPath(Path.Combine(Path.GetDirectoryName(input)!, path.Replace('\\', Path.DirectorySeparatorChar)));
}
