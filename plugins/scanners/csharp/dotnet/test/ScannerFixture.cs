
namespace Groma.CSharpScanner.Tests;

internal sealed class ScannerFixture : IDisposable
{
    public string Root { get; } = Path.Combine(Path.GetTempPath(), "groma-csharp-evidence-" + Guid.NewGuid());
    // Project and Solution name inputs of the csharp-operations layout only.
    public string Project => Path.Combine(Root, "App", "App.csproj");
    public string Solution => Path.Combine(Root, "Example.slnx");

    public ScannerFixture(string name = "csharp-operations")
    {
        string? repository = AppContext.BaseDirectory;
        while (repository is not null && !Directory.Exists(Path.Combine(repository, "test", "fixtures", name)))
            repository = Path.GetDirectoryName(repository);
        string source = Path.Combine(repository ?? throw new InvalidOperationException("C# source fixture was not found."), "test", "fixtures", name);
        foreach (string file in Directory.GetFiles(source, "*", SearchOption.AllDirectories))
            Write(Path.GetRelativePath(source, file), File.ReadAllText(file));
    }

    public void Write(string file, string contents)
    {
        string full = Path.Combine(Root, file);
        Directory.CreateDirectory(Path.GetDirectoryName(full)!);
        File.WriteAllText(full, contents);
    }

    public Task<ScanObservation> ScanAsync(string? input = null, int maxProjects = 128, int maxFiles = 20_000) =>
        new RoslynScanner().ScanAsync(new ScanRequest(input ?? Project, Root, MaxProjects: maxProjects, MaxFiles: maxFiles));

    public void Dispose() => Directory.Delete(Root, recursive: true);
}
