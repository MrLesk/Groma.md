using Xunit;

namespace Groma.CSharpScanner.Tests;

public sealed class CoverageTests
{
    [Fact]
    public async Task CompilerErrorsPublishNoPartialObservation()
    {
        using ScannerFixture fixture = new();
        await fixture.RestoreAsync();
        fixture.Write("App/Broken.cs", "public class Broken { MissingType Value = new(); }");
        StringWriter output = new(); StringWriter error = new();
        int result = await ScannerCommand.RunAsync([fixture.Project, "--root", fixture.Root], output, error);
        Assert.Equal(1, result); Assert.Empty(output.ToString()); Assert.Contains("CS0246", error.ToString());
    }

    [Fact]
    public async Task MultiTargetVariantsCannotBeSilentlyMerged()
    {
        using ScannerFixture fixture = new();
        fixture.Write("Core/Core.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\"><PropertyGroup><TargetFrameworks>net10.0;net10.0-windows</TargetFrameworks></PropertyGroup></Project>");
        await fixture.RestoreAsync();
        InvalidDataException error = await Assert.ThrowsAsync<InvalidDataException>(() => fixture.ScanAsync(fixture.Solution));
        Assert.Contains("target-framework", error.Message);
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
        await fixture.RestoreAsync();
        InvalidDataException error = await Assert.ThrowsAsync<InvalidDataException>(() => fixture.ScanAsync());
        Assert.Contains("multiple project contexts", error.Message);
    }

    [Fact]
    public async Task ProjectAndFileBudgetsFailRatherThanTruncate()
    {
        using ScannerFixture fixture = new();
        await fixture.RestoreAsync();
        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.ScanAsync(fixture.Solution, maxProjects: 1));
        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.ScanAsync(maxFiles: 1));
    }

    [Fact]
    public async Task ReferencedProjectOutsideTheDeclaredRepositoryFails()
    {
        using ScannerFixture fixture = new();
        await fixture.RestoreAsync();
        await Assert.ThrowsAsync<InvalidDataException>(() => new RoslynScanner().ScanAsync(new ScanRequest(fixture.Project, Path.GetDirectoryName(fixture.Project)!)));
    }

    [Fact]
    public async Task PackageFreeProjectCanBindWithoutRestoreAndDoesNotCreateAssets()
    {
        using ScannerFixture fixture = new();
        ScanObservation observation = await fixture.ScanAsync();
        Assert.True(observation.Complete);
        Assert.False(File.Exists(Path.Combine(fixture.Root, "App/obj/project.assets.json")));
        Assert.False(File.Exists(Path.Combine(fixture.Root, "Core/obj/project.assets.json")));
    }

    [Fact]
    public async Task MissingPackageSymbolsFailWithoutAttemptingRestore()
    {
        using ScannerFixture fixture = new();
        string source = File.ReadAllText(fixture.Project);
        fixture.Write("App/App.csproj", source.Replace("</Project>", "<ItemGroup><PackageReference Include=\"Unrestored.Groma.Example\" Version=\"1.0.0\" /></ItemGroup></Project>", StringComparison.Ordinal));
        fixture.Write("App/PackageUse.cs", "public class PackageUse { Unrestored.PackageType Value = new(); }");
        await Assert.ThrowsAnyAsync<Exception>(() => fixture.ScanAsync());
        Assert.False(File.Exists(Path.Combine(fixture.Root, "App/obj/project.assets.json")));
    }

    [Fact]
    public async Task WebSdkImplicitFrameworkReferencesAndTopLevelEntryAreSupported()
    {
        using ScannerFixture fixture = new();
        fixture.Write("Api/Api.csproj", "<Project Sdk=\"Microsoft.NET.Sdk.Web\"><PropertyGroup><TargetFramework>net10.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings></PropertyGroup></Project>");
        fixture.Write("Api/Program.cs", "var builder = WebApplication.CreateBuilder(args); var app = builder.Build(); app.Run();");
        ScanObservation observation = await fixture.ScanAsync(Path.Combine(fixture.Root, "Api/Api.csproj"));
        Assert.Single(observation.Files);
        Assert.Single(observation.Operations!);
        Assert.All(observation.Invocations!, invocation => Assert.True(invocation.Unresolved));
    }

    [Fact]
    public async Task UnavailablePinnedSdkDoesNotSilentlyUseTheInstalledSdk()
    {
        using ScannerFixture fixture = new();
        fixture.Write("global.json", "{\"sdk\":{\"version\":\"99.0.999\",\"rollForward\":\"disable\"}}");
        await Assert.ThrowsAnyAsync<Exception>(() => fixture.ScanAsync());
    }

    [Fact]
    public async Task LegacyProjectIsRejectedBeforeLoading()
    {
        using ScannerFixture fixture = new();
        fixture.Write("Old.csproj", "<Project ToolsVersion=\"14.0\" />");
        InvalidDataException error = await Assert.ThrowsAsync<InvalidDataException>(() => fixture.ScanAsync(Path.Combine(fixture.Root, "Old.csproj")));
        Assert.Contains("Unsupported project SDK", error.Message);
    }
}
