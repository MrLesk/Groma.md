namespace Groma.CSharpScanner;

public sealed record ScanRequest(
    string Input,
    string RepositoryRoot,
    string Configuration = "Debug",
    int MaxProjects = 128,
    int MaxFiles = 20_000)
{
    public static ScanRequest Parse(string[] args)
    {
        if (args.Length < 3 || args.Length % 2 == 0)
            throw new ArgumentException("Usage: csharp-scanner <input.sln|input.slnx|input.csproj> --root <repository> [--configuration Debug] [--max-projects 128] [--max-files 20000]");
        Dictionary<string, string> options = new(StringComparer.Ordinal);
        for (int index = 1; index < args.Length; index += 2)
        {
            string name = args[index];
            if (name is not ("--root" or "--configuration" or "--max-projects" or "--max-files") || !options.TryAdd(name, args[index + 1]))
                throw new ArgumentException($"Unknown or repeated scanner option '{name}'.");
        }
        if (!options.TryGetValue("--root", out string? root))
            throw new ArgumentException("--root is required; source paths belong to the repository, not the input directory.");
        return new ScanRequest(args[0], root,
            options.GetValueOrDefault("--configuration", "Debug"),
            Limit(options, "--max-projects", 128), Limit(options, "--max-files", 20_000));
    }

    public void Validate()
    {
        if (!Directory.Exists(RepositoryRoot)) throw new DirectoryNotFoundException("Repository root does not exist.");
        if (!File.Exists(Input)) throw new FileNotFoundException("Scan input does not exist.", Input);
        if (Path.GetExtension(Input).ToLowerInvariant() is not (".sln" or ".slnx" or ".csproj"))
            throw new InvalidDataException("Scan input must be a .sln, .slnx or .csproj file.");
        if (string.IsNullOrWhiteSpace(Configuration) || MaxProjects < 1 || MaxFiles < 1)
            throw new ArgumentException("Configuration must be nonempty and limits must be positive.");
        SourcePath.RequireInside(RepositoryRoot, Input);
    }

    private static int Limit(Dictionary<string, string> options, string name, int fallback)
    {
        if (!options.TryGetValue(name, out string? value)) return fallback;
        return int.TryParse(value, out int result) && result > 0
            ? result : throw new ArgumentException($"{name} must be a positive integer.");
    }
}

internal static class SourcePath
{
    public static string Relative(string root, string path) =>
        Path.GetRelativePath(Path.GetFullPath(root), Path.GetFullPath(path)).Replace('\\', '/');

    public static void RequireInside(string root, string path)
    {
        string relative = Relative(root, path);
        if (relative == ".." || relative.StartsWith("../", StringComparison.Ordinal) || Path.IsPathRooted(relative))
            throw new InvalidDataException($"Source or project lies outside the repository: {relative}. Select a repository root containing the entire project graph.");
    }

    public static bool IsPhysicalSource(string root, string? path)
    {
        if (path is null || !path.EndsWith(".cs", StringComparison.OrdinalIgnoreCase)) return false;
        string[] segments = Relative(root, path).Split('/');
        if (segments.Contains("obj", StringComparer.OrdinalIgnoreCase) || segments.Contains("bin", StringComparer.OrdinalIgnoreCase)) return false;
        RequireInside(root, path);
        if (!File.Exists(path)) throw new FileNotFoundException("A C# compile document is missing.", path);
        return true;
    }
}
