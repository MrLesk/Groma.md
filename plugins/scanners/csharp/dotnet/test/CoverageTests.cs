using Xunit;

namespace Groma.CSharpScanner.Tests;

public sealed class CoverageTests
{
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
        await fixture.RestoreAsync();
        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.ScanAsync());
    }
}
