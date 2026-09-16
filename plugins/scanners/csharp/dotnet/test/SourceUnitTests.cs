using Xunit;

namespace Groma.CSharpScanner.Tests;

public sealed class SourceUnitTests
{
    [Fact]
    public async Task PartialClassUsesOneSymbolAcrossAuthoredFiles()
    {
        using ScannerFixture fixture = new();
        ScanObservation scan = await fixture.ScanAsync();
        ScanSourceUnit unit = Assert.Single(scan.SourceUnits!);
        Assert.Equal(new[] { "Core/Partial.Declaration.cs", "Core/Partial.Implementation.cs" }, unit.Files);
        Assert.Contains(scan.Invocations!, call => call.Member == "Step" && !call.Unresolved);
        Assert.Equal(scan.ToCanonicalJson(), (await fixture.ScanAsync()).ToCanonicalJson());
    }

    [Fact]
    public async Task SameNamesInDifferentProjectsOrNamespacesStaySeparate()
    {
        using ScannerFixture fixture = new();
        foreach (string directory in new[] { "App", "Core/Other" })
        {
            string scope = directory == "App" ? "Fixture" : "Other";
            fixture.Write(directory + "/First.cs", $"namespace {scope}; public partial class PartialWork {{ public void Extra() {{ }} }}");
            fixture.Write(directory + "/Second.cs", $"namespace {scope}; public partial class PartialWork {{ }}");
        }
        ScanObservation scan = await fixture.ScanAsync();
        Assert.Equal(3, scan.SourceUnits!.Count);
        Assert.All(scan.SourceUnits!, unit => Assert.Single(unit.Files.Select(Path.GetDirectoryName).Distinct()));
    }

    [Fact]
    public async Task AFileWithAnIndependentTypePreventsPartialAssociation()
    {
        using ScannerFixture fixture = new();
        string file = Path.Combine(fixture.Root, "Core/Partial.Implementation.cs");
        File.AppendAllText(file, "\npublic class Independent { }\n");
        ScanObservation scan = await fixture.ScanAsync();
        Assert.Empty(scan.SourceUnits!);
        Assert.Contains(scan.Files, source => source.File == "Core/Partial.Declaration.cs");
        Assert.Contains(scan.Files, source => source.File == "Core/Partial.Implementation.cs");
    }
}
