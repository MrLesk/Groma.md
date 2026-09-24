using System.Text.Json;

namespace Groma.CSharpScanner;

/// <summary>
/// One scan of a repository. The adapter supplies the repository's tracked, unignored and not excluded C# files, so
/// the worker never loads a project or analyzes a source the host left out, and every input among them, so each
/// project loads once.
/// </summary>
public sealed record ScanRequest(
    string Root,
    IReadOnlyList<string> Inputs,
    IReadOnlyList<string> Files,
    string Configuration = "Debug",
    int MaxProjects = 128,
    int MaxFiles = 20_000)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static ScanRequest Parse(string json) =>
        JsonSerializer.Deserialize<ScanRequest>(json, JsonOptions) ?? throw new ArgumentException("A scan request is required.");

    public void Validate()
    {
        if (!Directory.Exists(Root)) throw new DirectoryNotFoundException("Repository root does not exist.");
        if (Inputs.Count == 0) throw new ArgumentException("A scan request needs at least one .sln, .slnx or .csproj input.");
        foreach (string input in Inputs)
        {
            string full = Path.GetFullPath(Path.Combine(Root, input));
            if (!File.Exists(full)) throw new FileNotFoundException("Scan input does not exist.", input);
            if (Path.GetExtension(full).ToLowerInvariant() is not (".sln" or ".slnx" or ".csproj"))
                throw new InvalidDataException("Scan input must be a .sln, .slnx or .csproj file.");
            SourcePath.RequireInside(Root, full);
        }
        if (string.IsNullOrWhiteSpace(Configuration) || MaxProjects < 1 || MaxFiles < 1)
            throw new ArgumentException("Configuration must be nonempty and limits must be positive.");
    }
}

internal static class SourcePath
{
    public static string Relative(string root, string path) =>
        Path.GetRelativePath(Path.GetFullPath(root), Path.GetFullPath(path)).Replace('\\', '/');

    public static bool IsInside(string root, string path)
    {
        string relative = Relative(root, path);
        return relative != ".." && !relative.StartsWith("../", StringComparison.Ordinal) && !Path.IsPathRooted(relative);
    }

    public static void RequireInside(string root, string path)
    {
        if (!IsInside(root, path))
            throw new InvalidDataException($"Source or project lies outside the repository: {Relative(root, path)}. Select a repository root containing the entire project graph.");
    }
}
