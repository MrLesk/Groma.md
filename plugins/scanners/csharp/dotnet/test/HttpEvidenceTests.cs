using Xunit;

namespace Groma.CSharpScanner.Tests;

public sealed class HttpEvidenceTests
{
    [Fact]
    public async Task ControllersAndMinimalApisServeLiteralRoutesWhileClientsSendThem()
    {
        using ScannerFixture fixture = new("csharp-http");
        ScanObservation scan = await fixture.ScanAsync(Path.Combine(fixture.Root, "Http.csproj"));
        Dictionary<string, ScanOperation> operations = scan.Operations!.ToDictionary(operation => operation.Id, StringComparer.Ordinal);
        string Served(ScanHttpEndpoint endpoint) => $"{endpoint.Method} {Route(endpoint.Path)} <- {operations[endpoint.Operation].Name}";
        string Sent(ScanHttpRequest request) =>
            $"{request.Method ?? "?"} {(request.Configured == true ? "configured " : "")}{Route(request.Path)} <- {operations[request.Operation].Name}";

        // Absent: the [area] token; a conventionally routed controller; an abstract, partial or internal controller; a
        // controller whose base declares a public method, is marked [NonController] or is not declared in
        // source; a class that is not a controller; non-action methods ([NonAction], private, static, generic); an
        // [AcceptVerbs] action; a computed pattern or method list; a Map branch; a reassigned or computed group; and a
        // route on an IEndpointRouteBuilder that arrives as a parameter.
        Assert.Equal(new[]
        {
            "* /api/Talks/Feed <- Shop.TalksController.Feed()",
            // A verb attribute with a Name defines its own route on the class prefix, so the [Route] serves every method.
            "* /api/routes/r <- Shop.RoutesController.Read()",
            "DELETE /admin/talks/:id <- Shop.TalksController.Remove(int)",
            "DELETE /api/speakers/:id~ <- Handlers.Remove(int)",
            "GET /api/Lowercase <- Shop.Lowercasecontroller.List()",
            "GET /api/Talks <- Shop.TalksController.List()",
            "GET /api/Talks/:id~ <- Shop.TalksController.Read(int)",
            "GET /api/Talks/:slug* <- Shop.TalksController.Slug(string)",
            // A segment mixing text with a placeholder is one constrained parameter.
            "GET /api/Talks/:version~/talks <- Shop.TalksController.Versioned(int)",
            "GET /api/Talks/archive/:year~ <- Shop.TalksController.Year(int)",
            // A constraint may hold doubled braces or a slash inside its placeholder.
            "GET /api/Talks/codes/:code~ <- Shop.TalksController.Code(string)",
            "GET /api/Talks/deep/:path~ <- Shop.TalksController.Deep(string)",
            // Each verb attribute with a template serves only its own method on its own template.
            "GET /api/Talks/drafts <- Shop.TalksController.Publish()",
            // A [Route] takes the methods of the template-less verb attributes.
            "GET /api/Talks/latest <- Shop.TalksController.Latest()",
            "GET /api/Talks/named <- Shop.TalksController.Named()",
            "GET /api/Talks/tags/:tag~/raw%7Bcopy%7D <- Shop.TalksController.Tag(string)",
            // [action] is the method name without Async, or its [ActionName].
            "GET /api/async/Latest <- Shop.AsyncController.LatestAsync()",
            "GET /api/async/Newest <- Shop.AsyncController.Recent()",
            "GET /api/rooted <- Shop.RootedController.List()",
            "GET /api/routes <- Shop.RoutesController.Read()",
            // A base's [Route] is the prefix of a controller that declares none, as ASP.NET Core reads it.
            "GET /api/shared/:id~ <- Shop.DerivedController.Read(int)",
            "GET /api/speakers/:id~ <- lambda expression",
            "GET /api/speakers/drafts/:id~/:rest* <- lambda expression",
            "GET /health <- lambda expression",
            "GET /ping <- lambda expression",
            "GET /status <- lambda expression",
            "HEAD /ping <- lambda expression",
            // A template-less verb attribute beside a templated one serves the class prefix.
            "POST /api/Talks <- Shop.TalksController.Save(int?)",
            "POST /api/Talks/publish <- Shop.TalksController.Publish()",
            "POST /talks <- lambda expression",
            "PUT /api/Talks/:id? <- Shop.TalksController.Save(int?)",
        }, scan.HttpEndpoints!.Select(Served).Order(StringComparer.Ordinal));

        // Absent: a call on a local cache that only looks like a client. A query string is dropped. A local or readonly
        // field that nothing assigns again is its initializer's text, while a reassigned one is unknown. A configuration
        // read followed by a path is a configured base; a dictionary that only looks like configuration is unknown.
        Assert.Equal(new[]
        {
            "DELETE /api/talks/dynamic <- Shop.TalkClient.Remove(int)",
            "GET /api/talks <- Shop.TalkClient.List()",
            // A client from IHttpClientFactory, held by a local.
            "GET /api/talks/drafts <- Shop.FactoryClient.Drafts()",
            "GET /api/talks/dynamic <- Shop.TalkClient.Read(int)",
            "GET /api/talks/feed <- Shop.TalkClient.FeedItems()",
            "GET /api/talks/latest <- Shop.TalkClient.Latest()",
            "GET /api/talks/unknown <- Shop.TalkClient.Search(string)",
            "GET /unknown <- Shop.ArchiveClient.Load()",
            // Another part of PartialClient may assign its readonly field.
            "GET /unknown <- Shop.PartialClient.Load()",
            // Text continuing a configuration value's last segment is unknown.
            "GET /unknown <- Shop.SettingsClient.Glued()",
            // A local written through a ref alias, a ref argument or a deconstruction holds no single value.
            "GET /unknown <- Shop.TalkClient.Aliased()",
            "GET /unknown <- Shop.TalkClient.Any(string)",
            "GET /unknown <- Shop.TalkClient.Recent(bool)",
            "GET /unknown <- Shop.TalkClient.Referenced()",
            "GET /unknown <- Shop.TalkClient.Swapped()",
            "GET /unknown/api/settings <- Shop.SettingsClient.Lookalike()",
            // Only System.Environment reads an environment variable.
            "GET /unknown/api/settings/lookalike <- Shop.SettingsClient.LookalikeVariable()",
            "GET /unknown/api/talks <- Shop.TalkClient.External()",
            "GET configured /api/settings <- Shop.SettingsClient.Indexed()",
            "GET configured /api/settings/connection <- Shop.SettingsClient.Connection()",
            "GET configured /api/settings/section <- Shop.SettingsClient.Section()",
            "GET configured /api/settings/typed <- Shop.SettingsClient.Typed()",
            "GET configured /api/settings/variable <- Shop.SettingsClient.Variable()",
            "GET configured /api/talks <- Shop.ITalksApi.List()",
            "GET configured /api/talks/dynamic <- Shop.ITalksApi.Read(int)",
            "HEAD /ping <- Shop.TalkClient.Ping()",
            // A request message held by a local states the method and URL SendAsync sends.
            "POST /api/talks/publish <- Shop.FactoryClient.Publish()",
            "POST configured /api/talks <- Shop.ITalksApi.Create(string)",
            "POST configured /api/talks <- Shop.TalkClient.Save(string)",
        }, scan.HttpRequests!.Select(Sent).Order(StringComparer.Ordinal));

        // A declarative client method has no body, so its operation carries no comparable tokens.
        Assert.Null(Assert.Single(scan.Operations!, operation => operation.Name == "Shop.ITalksApi.List()").Tokens);
        Assert.Equal(scan.ToCanonicalJson(), (await fixture.ScanAsync(Path.Combine(fixture.Root, "Http.csproj"))).ToCanonicalJson());
    }

    [Fact]
    public async Task AnActionNameMayKeepItsAsyncSuffixWhenTheSourceTurnsItsRemovalOff()
    {
        using ScannerFixture fixture = new("csharp-http");
        fixture.Write("Setup.cs", """
            using Microsoft.AspNetCore.Mvc;

            static class Setup
            {
                public static void Configure(MvcOptions options) => options.SuppressAsyncSuffixInActionNames = false;
            }
            """);
        ScanObservation scan = await fixture.ScanAsync(Path.Combine(fixture.Root, "Http.csproj"));
        Dictionary<string, ScanOperation> operations = scan.Operations!.ToDictionary(operation => operation.Id, StringComparer.Ordinal);
        // LatestAsync's [action] path is then unknown, while [ActionName] still names Recent.
        Assert.Equal(new[] { "GET /api/async/Newest" }, scan.HttpEndpoints!
            .Where(endpoint => operations[endpoint.Operation].Name.StartsWith("Shop.AsyncController.", StringComparison.Ordinal))
            .Select(endpoint => $"{endpoint.Method} {Route(endpoint.Path)}"));
    }

    [Fact]
    public async Task ARouteTokenTransformerLeavesTokenPathsUnknown()
    {
        using ScannerFixture fixture = new("csharp-http");
        fixture.Write("Setup.cs", """
            using Microsoft.AspNetCore.Mvc;
            using Microsoft.AspNetCore.Mvc.ApplicationModels;

            static class Setup
            {
                public static void Configure(MvcOptions options) =>
                    options.Conventions.Add(new RouteTokenTransformerConvention(new KebabCase()));
            }
            """);
        ScanObservation scan = await fixture.ScanAsync(Path.Combine(fixture.Root, "Http.csproj"));
        string[] paths = [.. scan.HttpEndpoints!.Select(endpoint => Route(endpoint.Path))];
        // Paths built from [controller] or [action] are unknown, while a literal controller route still reports.
        Assert.DoesNotContain(paths, path => path.StartsWith("/api/Talks", StringComparison.Ordinal) || path.StartsWith("/api/async", StringComparison.Ordinal));
        Assert.Contains("/api/rooted", paths);
    }

    [Fact]
    public async Task AControllerTakesItsRouteFromABaseInAnotherProject()
    {
        using ScannerFixture fixture = new();
        fixture.Write("G/Web/Web.csproj", "<Project Sdk=\"Microsoft.NET.Sdk.Web\"><ItemGroup><ProjectReference Include=\"../Api/Api.csproj\" /></ItemGroup></Project>");
        fixture.Write("G/Web/AppsController.cs",
            "namespace G; public sealed class AppsController : Api.ApiController { [Microsoft.AspNetCore.Mvc.HttpGet(\"apps/{app}\")] public string Get(string app) => app; }");
        fixture.Write("G/Api/Api.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\"></Project>");
        fixture.Write("G/Api/ApiController.cs", "namespace G.Api; public static class Routes { public const string Prefix = \"/api\"; } "
            + "[Microsoft.AspNetCore.Mvc.Route(Routes.Prefix)] public abstract class ApiController : Microsoft.AspNetCore.Mvc.Controller { }");
        ScanObservation scan = await fixture.ScanAsync(Path.Combine(fixture.Root, "G/Web/Web.csproj"));
        ScanHttpEndpoint endpoint = Assert.Single(scan.HttpEndpoints!);
        Assert.Equal("GET /api/apps/:app", $"{endpoint.Method} {Route(endpoint.Path)}");
    }

    private static string Route(IReadOnlyList<ScanHttpSegment> path) => "/" + string.Join("/", path.Select(segment => segment.Kind switch
    {
        "literal" => segment.Value!,
        // ~ marks a constrained segment.
        "parameter" => $":{segment.Name}{(segment.Optional == true ? "?" : "")}{(segment.Constrained == true ? "~" : "")}",
        // An ASP.NET Core catch-all also matches no remaining segment, which core writes as *.
        "catch-all" => $":{segment.Name}{(segment.Optional == true ? "*" : "+")}{(segment.Constrained == true ? "~" : "")}",
        _ => segment.Kind,
    }));
}
