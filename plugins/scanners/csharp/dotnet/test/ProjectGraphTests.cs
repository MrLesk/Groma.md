using Xunit;

namespace Groma.CSharpScanner.Tests;

public sealed class ProjectGraphTests
{
    private const string Library = "<Project Sdk=\"Microsoft.NET.Sdk\"><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>";

    [Fact]
    public async Task EachProjectLoadsOnceHoweverManyInputsNameIt()
    {
        using ScannerFixture fixture = new();
        fixture.Write("G/Lib/Lib.csproj", Library);
        fixture.Write("G/Lib/Calc.cs", "namespace G; public static class Calc { public static int Score(int a, int b) { int total = a + b; return total * 2; } }");
        fixture.Write("G/One.slnx", "<Solution><Project Path=\"Lib/Lib.csproj\" /></Solution>");
        fixture.Write("G/Two.slnx", "<Solution><Project Path=\"Lib/Lib.csproj\" /></Solution>");
        ScanObservation scan = await new RoslynScanner().ScanAsync(fixture.Request(["G/One.slnx", "G/Two.slnx"]));
        Assert.Single(scan.Roots, root => root.Kind == "project");
        Assert.Single(scan.Operations!, operation => operation.Name == "G.Calc.Score(int, int)");
    }

    [Fact]
    public async Task AnInputReachesItsReferencesTransitivelyAndReadsItsLinkedFiles()
    {
        using ScannerFixture fixture = new();
        fixture.Write("G/App/App.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\"><ItemGroup><ProjectReference Include=\"../Mid/Mid.csproj\" /><Compile Include=\"../Shared/Clock.cs\" /></ItemGroup></Project>");
        fixture.Write("G/App/Use.cs", "namespace G; public static class Use { public static int Run() => Core.Helper.Twice(21); }");
        fixture.Write("G/Mid/Mid.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\"><ItemGroup><ProjectReference Include=\"../Core/Core.csproj\" /></ItemGroup></Project>");
        fixture.Write("G/Mid/Step.cs", "namespace G; public static class Step { }");
        fixture.Write("G/Core/Core.csproj", Library);
        fixture.Write("G/Core/Helper.cs", "namespace G.Core; public static class Helper { public static int Twice(int value) => value * 2; }");
        fixture.Write("G/Shared/Clock.cs", "namespace G; public static class Clock { }");
        ScanObservation scan = await new RoslynScanner().ScanAsync(fixture.Request(["G/App/App.csproj"]));
        Assert.Equal(["G/App/Use.cs", "G/Core/Helper.cs", "G/Mid/Step.cs", "G/Shared/Clock.cs"], scan.Files.Select(file => file.File));
        // The SDK passes references on, so App reaches Core through Mid.
        Assert.Contains(scan.Invocations!, call => call.Member == "Twice" && !call.Unresolved);
    }

    [Fact]
    public async Task ProjectsOfAnySdkScanWhileOtherLanguagesAndLegacyProjectsAreSkipped()
    {
        using ScannerFixture fixture = new();
        fixture.Write("G/Host/Host.csproj", "<Project Sdk=\"Aspire.AppHost.Sdk/13.5.3\"></Project>");
        fixture.Write("G/Host/Program.cs", "System.Console.WriteLine(\"host\");");
        fixture.Write("G/Ui/Ui.csproj", "<Project Sdk=\"Microsoft.NET.Sdk.Razor\"></Project>");
        fixture.Write("G/Ui/Ui.cs", "namespace G; public static class Ui { }");
        fixture.Write("G/Tool/Tool.csproj", "<Project><Import Project=\"Sdk.props\" Sdk=\"Microsoft.NET.Sdk\" /><PropertyGroup><OutputType>EXE</OutputType></PropertyGroup><Import Project=\"Sdk.targets\" Sdk=\"Microsoft.NET.Sdk\" /></Project>");
        fixture.Write("G/Tool/Tool.cs", "static class Tool { static void Main() { } }");
        fixture.Write("G/Old/Old.csproj", "<Project ToolsVersion=\"15.0\" xmlns=\"http://schemas.microsoft.com/developer/msbuild/2003\"><ItemGroup><Compile Include=\"Old.cs\" /></ItemGroup></Project>");
        fixture.Write("G/Old/Old.cs", "class Old { }");
        fixture.Write("G/All.slnx", "<Solution><Project Path=\"Host/Host.csproj\" /><Project Path=\"Ui/Ui.csproj\" /><Project Path=\"Tool/Tool.csproj\" />"
            + "<Project Path=\"Old/Old.csproj\" /><Project Path=\"Native/Native.vcxproj\" /></Solution>");
        ScanObservation scan = await new RoslynScanner().ScanAsync(fixture.Request(["G/All.slnx"]));
        Assert.Equal(["G/Host/Host.csproj", "G/Tool/Tool.csproj", "G/Ui/Ui.csproj"], scan.Roots.Where(root => root.Kind == "project").Select(root => root.File));
        // Top-level statements are only valid in an executable, and MSBuild reads OutputType in any case.
        Assert.Equal(["G/Host/Program.cs", "G/Tool/Tool.cs"], scan.EntryPoints!.Select(entry => entry.File));
        Assert.Contains(scan.Diagnostics, diagnostic => diagnostic.Code == "CSHARP_UNSUPPORTED_PROJECT" && diagnostic.File == "G/Old/Old.csproj");
    }

    [Fact]
    public async Task BuildPropsImportsAndProjectItemsSupplyTheDeclaredLanguageContext()
    {
        using ScannerFixture fixture = new();
        fixture.Write("G/Directory.Build.props", "<Project><PropertyGroup><ImplicitUsings>enable</ImplicitUsings><DefineConstants>BASE</DefineConstants></PropertyGroup>"
            + "<ItemGroup><Using Include=\"G.Helpers\" /></ItemGroup></Project>");
        fixture.Write("G/Common.props", "<Project><PropertyGroup><DefineConstants>$(DefineConstants);CORECLR</DefineConstants></PropertyGroup></Project>");
        fixture.Write("G/App/App.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\"><Import Project=\"../Common.props\" /><PropertyGroup><AllowUnsafeBlocks>true</AllowUnsafeBlocks></PropertyGroup>"
            + "<ItemGroup><Compile Remove=\"$(BaseIntermediateOutputPath)**\" /><Compile Remove=\"Legacy/**\" /><Compile Include=\"Legacy/Keep.cs\" /></ItemGroup></Project>");
        fixture.Write("G/App/Client.cs", """
            namespace G;
            public class Client
            {
                public Task<string> Load(HttpClient http) => http.GetStringAsync("/api/items");
                public void Warn() => Log.Warn("x");
            #if CORECLR && BASE
                public void Modern() { }
            #else
                public void Legacy() { }
            #endif
                public static unsafe void Clear(byte* pointer) => *pointer = 0;
                public Missing? Broken() => null;
            }
            """);
        fixture.Write("G/App/Helpers/Log.cs", "namespace G.Helpers; public static class Log { public static void Warn(string message) { } }");
        fixture.Write("G/App/Legacy/Drop.cs", "namespace G; public static class Drop { }");
        fixture.Write("G/App/Legacy/Keep.cs", "namespace G; public static class Keep { }");
        ScanObservation scan = await new RoslynScanner().ScanAsync(fixture.Request(["G/App/App.csproj"]));
        // ImplicitUsings from Directory.Build.props supplies HttpClient and Task, and the Using item supplies Log.
        Assert.Single(scan.HttpRequests!);
        Assert.Contains(scan.Invocations!, call => call.Member == "Warn" && !call.Unresolved);
        Assert.Contains(scan.Operations!, operation => operation.Name == "G.Client.Modern()");
        Assert.DoesNotContain(scan.Operations!, operation => operation.Name == "G.Client.Legacy()");
        // Compile items apply in document order: the Include after the Remove keeps its file. A path built from a property
        // only the SDK defines stays unknown, rather than becoming ** and removing every file.
        Assert.Contains(scan.Files, file => file.File == "G/App/Legacy/Keep.cs");
        Assert.DoesNotContain(scan.Files, file => file.File == "G/App/Legacy/Drop.cs");
        // Only the missing type fails to compile, and the warning locates it by file and line rather than in its text.
        ScanDiagnostic warning = Assert.Single(scan.Diagnostics, diagnostic => diagnostic.Severity == "warning");
        Assert.Equal(("CS0246", "G/App/Client.cs", 12), (warning.Code, warning.File, warning.Line));
        Assert.DoesNotContain("Client.cs", warning.Message, StringComparison.Ordinal);
    }
}
