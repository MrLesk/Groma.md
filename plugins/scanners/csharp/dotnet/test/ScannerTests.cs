using Xunit;

namespace Groma.CSharpScanner.Tests;

public sealed class ScannerTests
{
    [Theory]
    [InlineData("Microsoft.NET.Sdk.Web", "")]
    [InlineData("Microsoft.NET.Sdk.Worker", "")]
    [InlineData("Microsoft.NET.Sdk", "<OutputType>Exe</OutputType>")]
    public async Task CompilerEntryIncludesOwnSourcesButNotReferencedLibraries(string sdk, string output)
    {
        using ScannerFixture fixture = new();
        fixture.Write("Service/Service.csproj", $"<Project Sdk=\"{sdk}\"><PropertyGroup><TargetFramework>net10.0</TargetFramework>{output}</PropertyGroup><ItemGroup><ProjectReference Include=\"../Library/Library.csproj\" /></ItemGroup></Project>");
        fixture.Write("Service/Program.cs", "System.Console.WriteLine(new Library.Value());");
        fixture.Write("Service/Handler.cs", "class Handler {}");
        fixture.Write("Library/Library.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\"><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>");
        fixture.Write("Library/Value.cs", "namespace Library; public class Value {}");
        ScanObservation scan = await fixture.ScanAsync(Path.Combine(fixture.Root, "Service/Service.csproj"));
        ScanEntryPoint entry = Assert.Single(scan.EntryPoints!);
        Assert.Equal("Service/Program.cs", entry.File);
        Assert.Equal("Service/Service.csproj", entry.Declaration);
        Assert.Contains("Service/Handler.cs", entry.Files);
        Assert.DoesNotContain("Library/Value.cs", entry.Files);
    }

    [Fact]
    public async Task SolutionScanKeepsPartialFilesAtomicAndPreservesProjectHierarchy()
    {
        using FixtureSolution fixture = FixtureSolution.Create();
        RoslynScanner scanner = new();

        ScanObservation first = await scanner.ScanAsync(new ScanRequest(fixture.Directory, [fixture.SolutionPath], ScannerFixture.Inventory(fixture.Directory)));

        ScanFile[] partialFiles = first.Files
            .Where(file => file.Symbols.Any(symbol => symbol.Id == "global::Fixture.Shared"))
            .ToArray();
        Assert.Equal(2, partialFiles.Length);
        ScanRoot solution = Assert.Single(first.Roots, root => root.Kind == "solution");
        ScanRoot[] projects = first.Roots.Where(root => root.Kind == "project").ToArray();
        Assert.Equal(2, projects.Length);
        Assert.All(projects, project => Assert.Equal(solution.Id, project.Parent));
        ScanRoot core = Assert.Single(projects, root => root.File == "Core/Core.csproj");
        Assert.All(partialFiles, file => Assert.Equal([core.Id], file.Roots));
        Assert.All(first.Files, file => Assert.All(file.Roots, id => Assert.Contains(projects, root => root.Id == id)));
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
            return fixture;
        }

        public void Dispose() => System.IO.Directory.Delete(Directory, recursive: true);

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
