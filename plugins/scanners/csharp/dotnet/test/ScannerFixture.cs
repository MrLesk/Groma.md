using System.Diagnostics;

namespace Groma.CSharpScanner.Tests;

internal sealed class ScannerFixture : IDisposable
{
    public string Root { get; } = Path.Combine(Path.GetTempPath(), "groma-csharp-evidence-" + Guid.NewGuid());
    public string Project => Path.Combine(Root, "App", "App.csproj");
    public string Solution => Path.Combine(Root, "Example.slnx");

    public ScannerFixture()
    {
        string? repository = AppContext.BaseDirectory;
        while (repository is not null && !Directory.Exists(Path.Combine(repository, "test", "fixtures", "csharp-operations")))
            repository = Path.GetDirectoryName(repository);
        string source = Path.Combine(repository ?? throw new InvalidOperationException("C# source fixture was not found."), "test", "fixtures", "csharp-operations");
        foreach (string file in Directory.GetFiles(source, "*", SearchOption.AllDirectories))
            Write(Path.GetRelativePath(source, file), File.ReadAllText(file));
    }

    public void Write(string file, string contents)
    {
        string full = Path.Combine(Root, file);
        Directory.CreateDirectory(Path.GetDirectoryName(full)!);
        File.WriteAllText(full, contents);
    }

    public async Task RestoreAsync(string? input = null)
    {
        ProcessStartInfo start = new(Environment.GetEnvironmentVariable("DOTNET_HOST_PATH") ?? "dotnet")
        {
            WorkingDirectory = Root, RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false,
        };
        foreach (string arg in new[] { "restore", Path.GetRelativePath(Root, input ?? Solution), "--nologo" }) start.ArgumentList.Add(arg);
        using Process process = Process.Start(start) ?? throw new InvalidOperationException("Could not restore the fixture.");
        Task<string> output = process.StandardOutput.ReadToEndAsync();
        Task<string> error = process.StandardError.ReadToEndAsync();
        using CancellationTokenSource timeout = new(TimeSpan.FromSeconds(30));
        try { await process.WaitForExitAsync(timeout.Token); }
        catch (OperationCanceledException) { process.Kill(entireProcessTree: true); throw; }
        if (process.ExitCode != 0) throw new InvalidOperationException(await output + await error);
    }

    public Task<ScanObservation> ScanAsync(string? input = null, int maxProjects = 128, int maxFiles = 20_000) =>
        new RoslynScanner().ScanAsync(new ScanRequest(input ?? Project, Root, MaxProjects: maxProjects, MaxFiles: maxFiles));

    public void Dispose() => Directory.Delete(Root, recursive: true);
}
