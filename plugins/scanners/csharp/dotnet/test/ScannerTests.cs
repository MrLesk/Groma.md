using System.Diagnostics;
using Xunit;

namespace Groma.CSharpScanner.Tests;

public sealed class ScannerTests
{
    [Fact]
    public async Task SolutionScanKeepsPartialFilesAtomicAndFindsProjectReferences()
    {
        using FixtureSolution fixture = FixtureSolution.Create();
        RoslynScanner scanner = new();

        ScanObservation first = await scanner.ScanAsync(fixture.SolutionPath);
        ScanObservation second = await scanner.ScanAsync(fixture.SolutionPath);

        Assert.Equal(first.ToCanonicalJson(), second.ToCanonicalJson());
        ScanFile[] partialFiles = first.Files
            .Where(file => file.Symbols.Any(symbol => symbol.Id == "global::Fixture.Shared"))
            .ToArray();
        Assert.Equal(2, partialFiles.Length);
        Assert.Contains(first.Placements, placement => placement == new ScanPlacement(
            "Core/Shared.First.cs", "scope:Core/Core.csproj"));
        Assert.Contains(first.Placements, placement => placement == new ScanPlacement(
            "Core/Shared.Second.cs", "scope:Core/Core.csproj"));
        Assert.Contains(first.Relationships, relationship => relationship == new ScanRelationship(
            "scope:App/App.csproj", "scope:Core/Core.csproj", "project-reference"));
        Assert.Contains(first.Relationships, relationship => relationship == new ScanRelationship(
            "App/UsesCore.cs", "Core/Shared.First.cs", "source-dependency"));
        Assert.Contains(first.Relationships, relationship => relationship == new ScanRelationship(
            "App/UsesCore.cs", "Core/Shared.Second.cs", "source-dependency"));
        Assert.DoesNotContain(first.Relationships, relationship =>
            relationship.Source == "App/Unused.cs" && relationship.Kind == "source-dependency");
        Assert.DoesNotContain(first.Relationships, relationship =>
            relationship.Source == "Core/Shared.First.cs" && relationship.Kind == "source-dependency");
    }

    [Fact]
    public async Task FailedCommandPublishesNoPartialJson()
    {
        StringWriter output = new();
        StringWriter error = new();

        int exitCode = await ScannerCommand.RunAsync(
            [Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".sln")],
            output,
            error);

        Assert.Equal(1, exitCode);
        Assert.Equal(string.Empty, output.ToString());
        Assert.NotEmpty(error.ToString());
    }

    private sealed class FixtureSolution : IDisposable
    {
        private const string CoreProjectId = "11111111-1111-1111-1111-111111111111";
        private const string AppProjectId = "22222222-2222-2222-2222-222222222222";
        private const string CSharpProjectTypeId = "FAE04EC0-301F-11D3-BF4B-00C04F79EFBC";

        private FixtureSolution(string directory) => Directory = directory;

        public string Directory { get; }

        public string SolutionPath => Path.Combine(Directory, "Fixture.sln");

        public static FixtureSolution Create()
        {
            FixtureSolution fixture = new(Path.Combine(
                Path.GetTempPath(),
                "groma-csharp-scanner-" + Guid.NewGuid()));
            System.IO.Directory.CreateDirectory(Path.Combine(fixture.Directory, "Core"));
            System.IO.Directory.CreateDirectory(Path.Combine(fixture.Directory, "App"));
            File.WriteAllText(Path.Combine(fixture.Directory, "Core", "Core.csproj"), ProjectFile());
            File.WriteAllText(
                Path.Combine(fixture.Directory, "Core", "Shared.First.cs"),
                "namespace Fixture; public partial class Shared { }");
            File.WriteAllText(
                Path.Combine(fixture.Directory, "Core", "Shared.Second.cs"),
                "namespace Fixture; public partial class Shared { public void Run() { } }");
            File.WriteAllText(
                Path.Combine(fixture.Directory, "App", "App.csproj"),
                ProjectFile("<ItemGroup><ProjectReference Include=\"../Core/Core.csproj\" /></ItemGroup>"));
            File.WriteAllText(
                Path.Combine(fixture.Directory, "App", "UsesCore.cs"),
                "using Fixture; namespace App; public class UsesCore { public Shared Value { get; } = new(); }");
            File.WriteAllText(
                Path.Combine(fixture.Directory, "App", "Unused.cs"),
                "using Fixture; using Alias = Fixture.Shared; namespace App; public class Unused<Shared> { public Shared Value { get; set; } = default!; }");
            File.WriteAllText(fixture.SolutionPath, SolutionFile());
            fixture.Restore();
            return fixture;
        }

        public void Dispose() => System.IO.Directory.Delete(Directory, recursive: true);

        private void Restore()
        {
            string dotnet = Environment.GetEnvironmentVariable("DOTNET_HOST_PATH") ?? "dotnet";
            ProcessStartInfo startInfo = new(dotnet)
            {
                WorkingDirectory = Directory,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
            };
            startInfo.ArgumentList.Add("restore");
            startInfo.ArgumentList.Add(SolutionPath);
            using Process process = Process.Start(startInfo)
                ?? throw new InvalidOperationException("Could not start dotnet restore.");
            Task<string> output = process.StandardOutput.ReadToEndAsync();
            Task<string> error = process.StandardError.ReadToEndAsync();
            process.WaitForExit();
            Task.WaitAll(output, error);
            if (process.ExitCode != 0)
                throw new InvalidOperationException(error.Result);
        }

        private static string ProjectFile(string extra = "") => $$"""
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <TargetFramework>net10.0</TargetFramework>
                <Nullable>enable</Nullable>
              </PropertyGroup>
              {{extra}}
            </Project>
            """;

        private static string SolutionFile() => $$"""
            Microsoft Visual Studio Solution File, Format Version 12.00
            # Visual Studio Version 17
            Project("{{{CSharpProjectTypeId}}}") = "Core", "Core/Core.csproj", "{{{CoreProjectId}}}"
            EndProject
            Project("{{{CSharpProjectTypeId}}}") = "App", "App/App.csproj", "{{{AppProjectId}}}"
            EndProject
            Global
              GlobalSection(SolutionConfigurationPlatforms) = preSolution
                Debug|Any CPU = Debug|Any CPU
              EndGlobalSection
              GlobalSection(ProjectConfigurationPlatforms) = postSolution
                {{{CoreProjectId}}}.Debug|Any CPU.ActiveCfg = Debug|Any CPU
                {{{CoreProjectId}}}.Debug|Any CPU.Build.0 = Debug|Any CPU
                {{{AppProjectId}}}.Debug|Any CPU.ActiveCfg = Debug|Any CPU
                {{{AppProjectId}}}.Debug|Any CPU.Build.0 = Debug|Any CPU
              EndGlobalSection
            EndGlobal
            """;
    }
}
