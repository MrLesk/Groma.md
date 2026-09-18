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

        // Absent: the [area] token, a segment mixing text with a parameter, a conventionally routed controller,
        // an abstract controller and one whose base may carry a route, a computed pattern or method list,
        // a Map branch, a reassigned or computed group, and a route on a builder that arrives as a parameter.
        Assert.Equal(new[]
        {
            "* /api/Talks/Feed <- Shop.TalksController.Feed()",
            "DELETE /admin/talks/:id <- Shop.TalksController.Remove(int)",
            "DELETE /api/speakers/:id <- Handlers.Remove(int)",
            "GET /api/Talks <- Shop.TalksController.List()",
            "GET /api/Talks/:id <- Shop.TalksController.Read(int)",
            "GET /api/Talks/:slug* <- Shop.TalksController.Slug(string)",
            "GET /api/Talks/archive/:year <- Shop.TalksController.Year(int)",
            "GET /api/speakers/:id <- lambda expression",
            "GET /api/speakers/drafts/:id/:rest* <- lambda expression",
            "GET /health <- lambda expression",
            "GET /ping <- lambda expression",
            "HEAD /ping <- lambda expression",
            // A verb attribute without a template only constrains methods, so both serve the template.
            "POST /api/Talks/:id? <- Shop.TalksController.Save(int?)",
            "POST /talks <- lambda expression",
            "PUT /api/Talks/:id? <- Shop.TalksController.Save(int?)",
        }, scan.HttpEndpoints!.Select(Served).Order(StringComparer.Ordinal));

        // Absent: a call on a local cache that only looks like a client. A query string is dropped, and a readonly
        // field is not proof of its text, so FeedItems reports an unknown path.
        Assert.Equal(new[]
        {
            "DELETE /api/talks/dynamic <- Shop.TalkClient.Remove(int)",
            "GET /api/talks <- Shop.TalkClient.List()",
            "GET /api/talks/dynamic <- Shop.TalkClient.Read(int)",
            "GET /api/talks/unknown <- Shop.TalkClient.Search(string)",
            "GET /unknown <- Shop.TalkClient.Any(string)",
            "GET /unknown <- Shop.TalkClient.FeedItems()",
            "GET /unknown/api/talks <- Shop.TalkClient.External()",
            "GET configured /api/talks <- Shop.ITalksApi.List()",
            "GET configured /api/talks/dynamic <- Shop.ITalksApi.Read(int)",
            "HEAD /ping <- Shop.TalkClient.Ping()",
            "POST configured /api/talks <- Shop.ITalksApi.Create(string)",
            "POST configured /api/talks <- Shop.TalkClient.Save(string)",
        }, scan.HttpRequests!.Select(Sent).Order(StringComparer.Ordinal));

        // A declarative client method has no body, so its operation carries no comparable tokens.
        Assert.Null(Assert.Single(scan.Operations!, operation => operation.Name == "Shop.ITalksApi.List()").Tokens);
        Assert.Equal(scan.ToCanonicalJson(), (await fixture.ScanAsync(Path.Combine(fixture.Root, "Http.csproj"))).ToCanonicalJson());
    }

    private static string Route(IReadOnlyList<ScanHttpSegment> path) => "/" + string.Join("/", path.Select(segment => segment.Kind switch
    {
        "literal" => segment.Value!,
        "parameter" => $":{segment.Name}{(segment.Optional == true ? "?" : "")}",
        // An ASP.NET Core catch-all also matches no remaining segment, which core writes as *.
        "catch-all" => $":{segment.Name}{(segment.Optional == true ? "*" : "+")}",
        _ => segment.Kind,
    }));
}
