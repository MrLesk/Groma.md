using Xunit;

namespace Groma.CSharpScanner.Tests;

public sealed class CoverageTests
{
    [Fact]
    public async Task DependencySourcesOutsideRepositoryRemainCompilationContext()
    {
        using ScannerFixture fixture = new();
        string external = Path.Combine(Path.GetTempPath(), "groma-dependency-" + Guid.NewGuid() + ".cs");
        try
        {
            File.WriteAllText(external, "public static class Dependency { public static int Value() => 1; }");
            string project = File.ReadAllText(fixture.Project);
            fixture.Write("App/App.csproj", project.Replace("</Project>",
                $"<ItemGroup><Compile Include=\"{external}\" /></ItemGroup></Project>", StringComparison.Ordinal));
            fixture.Write("App/Consumer.cs", "public class Consumer { public int Read() => Dependency.Value(); }");
            ScanObservation result = await fixture.ScanAsync();
            Assert.Contains(result.Files, file => file.File == "App/Consumer.cs");
            Assert.DoesNotContain(result.Files, file => file.File.StartsWith("../", StringComparison.Ordinal));
            Assert.DoesNotContain(result.Operations!, operation => operation.File.StartsWith("../", StringComparison.Ordinal));
            Assert.Contains(result.Invocations!, call => call.Member == "Value" && call.Unresolved && call.Targets.Count == 0);
            File.WriteAllText(external, "public class Invalid {");
            await Assert.ThrowsAsync<InvalidDataException>(() => fixture.ScanAsync());
        }
        finally { File.Delete(external); }
    }

    [Fact]
    public async Task LinkedFilesCannotHaveSeveralCompilationOwners()
    {
        using ScannerFixture fixture = new();
        fixture.Write("Shared.cs", "namespace Shared; public class Linked { }");
        foreach (string project in new[] { "App/App.csproj", "Core/Core.csproj" })
        {
            string source = File.ReadAllText(Path.Combine(fixture.Root, project));
            fixture.Write(project, source.Replace("</Project>", "<ItemGroup><Compile Include=\"../Shared.cs\" /></ItemGroup></Project>", StringComparison.Ordinal));
        }
        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.ScanAsync());
    }
}
