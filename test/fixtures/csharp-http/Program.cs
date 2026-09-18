using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers(options => options.SuppressAsyncSuffixInActionNames = true);
var app = builder.Build();

app.MapGet("/health", () => "ok");
app.MapPost("/talks", (string body) => body);
app.MapMethods("/ping", new[] { "GET", "HEAD" }, () => "pong");

var talks = app.MapGroup("/api/speakers");
talks.MapGet("/{id:int}", (int id) => id.ToString());
talks.MapDelete("/{id:int}", Handlers.Remove);

var drafts = talks.MapGroup("/drafts");
drafts.MapGet("/{id:int}/{*rest}", (int id, string rest) => rest);

// A computed pattern or method list, a Map branch, a reassigned or computed group, and a builder
// that arrives as a parameter all report nothing.
app.MapGet(Patterns.Search(), () => "search");
app.MapMethods("/verbs", Patterns.Verbs(), () => "verbs");
app.Map("/legacy", () => "legacy");

var computed = app.MapGroup(Patterns.Search());
computed.MapGet("/items", () => "items");

var moved = app.MapGroup("/first");
moved = app.MapGroup("/second");
moved.MapGet("/items", () => "items");

MapNotes(app);

var status = WebApplication.Create(args);
status.MapGet("/status", () => "up");

app.MapControllers();
app.Run();

static void MapNotes(IEndpointRouteBuilder routes) => routes.MapGet("/notes", () => "notes");

static class Patterns
{
    public static string Search() => "/search";

    public static string[] Verbs() => ["GET"];
}

static class Handlers
{
    public static string Remove(int id) => "removed";
}
