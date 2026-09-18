# C# scanner

The C# scanner bundles Roslyn and a self-contained .NET runtime. Install the
scanner and scan source without a project SDK, NuGet restore, generated output
or application build. `global.json` does not select the scanner's runtime.

```sh
groma scanner add @groma/scanner-csharp
groma scan
```

Maintainers build the package with the .NET 10 SDK and Bun:

```sh
bun scripts/package-csharp-scanner.ts
```

The package includes the executable worker, runtime, adapter and upstream
notices. Its consumer does not need `dotnet` or an installation script.

## Source inputs

The scanner discovers tracked and unignored SDK-style `.csproj`, `.sln` and
`.slnx` files. Solutions are selected before their projects; local project
references are loaded once. Set `settings.input` on the existing C# scanner
entry to select one project or solution relative to the repository root.

An in-memory Roslyn workspace reads project XML and authored C# files.
Unconditional language options, compile includes/removes, implicit usings and
local project references supply context. The scanner's runtime supplies base
.NET declarations. It does not run MSBuild, evaluate imported or conditional
build settings, restore packages, or execute source generators. Standard .NET,
Web and Worker SDK headers are accepted; this is not general framework analysis.

Generated `bin` and `obj` files are excluded. A physical source file cannot
belong to several selected project contexts. Project references must stay
inside the repository. Mixed-language graphs and legacy projects are unsupported.
Invalid syntax fails a scan. Missing external types produce diagnostics while
local declarations and supported operations remain available.

## Evidence

Partial class declarations in separate authored files are proposed as one source
unit when Roslyn identifies the same class in the same project. Each file must
contain only that type, and every declaration must qualify. Same-name classes
in other namespaces or projects are independent. Files containing additional
types remain separate source evidence. This does not associate Razor, XAML, or
generated source.

Core creates one component with all member Code references, attaches newly
discovered unowned partial files, and retains curated ownership on repeat scans.
Conflicting owners produce review diagnostics.
The existing C# source watcher includes new partial files. No project restore,
build, or source-generator execution is needed.

Roslyn resolves local overloads, generic methods, extensions, partial
implementations and direct calls. Calls with type errors, virtual dispatch,
interfaces and delegates retain uncertainty. Implicit calls, initializers,
generated operations, receiver/delegate value flow, dependency injection and
network protocols are not resolved.

Solutions and projects supply source roots and file membership. They are not
C4 components or proof of business collaborations. Core owns curated membership
and relationship selection; ordinary Markdown readers see the existing OKF
records and Code links. The scanner adds no map level or architecture metadata.

Settings also accept `configuration` (default `Debug`), `maxProjects` (128),
`maxFiles` (20000) and `timeoutSeconds` (120). Configuration selects the source
DEBUG/TRACE symbols; it does not execute a build configuration. Limits fail
rather than publish truncated evidence. Failed scanners retain their saved
evidence while other scanners can update the map.

Run `dotnet test plugins/scanners/csharp/dotnet/test/Groma.CSharpScanner.Tests.csproj`
for Roslyn tests. Fixtures are scanned without restore. The packaged test
removes language tools from PATH; see
[fresh-checkout validation](../fresh-checkout-validation.md).

## Source outline

Components list the declarations of their C# files under the
[shared outline contract](../creating-a-plugin.md#source-outline). The worker
parses each requested file with Roslyn syntax alone, without loading its
project, restoring packages or building.

- Classes, structs, records, interfaces, enums and delegates declared directly
  in the file or inside its namespaces are types. Enums and delegates have no
  members.
- A type's members are the methods, interface method signatures, constructors,
  finalizers and operators declared in its body, each overload separately.
  Constructors are named after the type and finalizers `~Type`; operators are
  named like `operator +` or `implicit operator int`.

Nested types, record and class primary constructors, fields, properties,
indexers, events, accessors and top-level statements are not listed. Each file
of a partial type lists the type with the members that file declares. A
declaration's line is its name's line; an operator's line is its `operator`
keyword's line. A member is an entry only when a Code link names it as
`Type.Member`.

The outline parses without preprocessor symbols, while a scan uses the
project's. Code inside `#if DEBUG` is therefore skipped, and `#else` branches
are listed.

Visibility follows the contract's C# row: `protected internal` and
`private protected` are `protected`, and a `file` type is `private`. Without an
access modifier, top-level types are `internal`, interface members `public`
and other members `private`. A partial declaration without a modifier reports
that default, even when another part declares its access.

## Compared operations

`groma lint` and scan findings compare C# operations under the
[shared rule](../../architecture-findings.md#compared-operations). The scanner
attaches a source range and body tokens to every implemented:

- method, constructor, finalizer and operator;
- property, indexer and event accessor, including an expression-bodied getter;
- local function, including one declared among top-level statements.

Other lambdas and anonymous methods, such as those passed as arguments, are
anonymous callbacks. Top-level statements and field and property initializers
are not compared.

These named operations are not compared:

- lambdas and anonymous methods assigned to a variable, field or property, or
  written in an object initializer.

Parameter and local names become slots. Parameters, an indexer's included, are
numbered in declaration order, so an indexer that swaps its parameters is a
different body. Declared types remain tokens, so copies that differ only in
those types are not identical.
Operators remain. Parentheses that group an expression or a pattern remain
unless they wrap a name, member access, element access, call, literal or `this`,
so `(a + b) * c` and `a + b * c` are different bodies while `(a) + b` and
`a + b` are not.

## HTTP endpoints and requests

The scanner reports the [HTTP facts](../evidence.md#http-endpoints-and-requests)
that core joins into derived relationships. It reads attributes and calls from
syntax, because ASP.NET Core and client packages are never restored.

Endpoints:

- attribute-routed controllers: `[Route]` on the class with `[HttpGet]`,
  `[HttpPost]`, `[HttpPut]`, `[HttpDelete]`, `[HttpPatch]`, `[HttpHead]`,
  `[HttpOptions]` or `[Route]` on an action. As in ASP.NET Core, each `[Route]`
  and each verb attribute with a template, `Name` or `Order` is one route. A
  verb attribute's route serves only its own method, so
  `[HttpGet("a")] [HttpPost("b")]` serves GET `a` and POST `b`. A `[Route]`
  serves the methods of the verb attributes without a template, or every method
  when there are none. Verb attributes without a template that no `[Route]`
  took serve the class prefix, so `[HttpPost] [HttpPut("{id?}")]` serves PUT
  `{id?}` and POST on the prefix. An action without routing attributes
  reports nothing. `[controller]` becomes the class name without its
  `Controller` suffix, and `[action]` the literal `[ActionName]` or else the
  method name without a trailing `Async`. When a source file may set
  `SuppressAsyncSuffixInActionNames` to anything but `true`, the `[action]`
  path of a method ending in `Async` reports nothing, and when the source names
  `RouteTokenTransformerConvention`, every `[controller]` or `[action]` path
  reports nothing. A class `[Route]` starting with `~/` starts at the root.
- a controller is a public, top-level, non-generic, non-abstract class declared
  in one place, named `*Controller`, marked `[Controller]` or deriving from
  `ControllerBase` or `Controller`, and not `[NonController]`, counting the
  attributes of its bases. A controller also serves the public methods and
  `[Route]` prefixes of its bases, so one with a base between it and
  `ControllerBase` that declares a public method or a `[Route]`, or that the
  source does not declare, reports nothing. An action is a public, non-static,
  non-generic method with a body and without `[NonAction]`.
- minimal APIs: `MapGet`, `MapPost`, `MapPut`, `MapDelete`, `MapPatch`, and
  `MapMethods` with literal methods, on a `MapGroup` chain or on the
  application: the result of `Build()` or `WebApplication.Create()`, or any
  name declared as `WebApplication`, such as a parameter. The handler is a
  lambda or a method the call names.

Requests:

- `HttpClient` calls, recognized by the receiver's own type: the `GetAsync`,
  `GetStringAsync`, `GetFromJsonAsync`, `PostAsync`, `PostAsJsonAsync`,
  `PutAsync`, `PatchAsync` and `DeleteAsync` families, and `SendAsync` with a
  `new HttpRequestMessage(HttpMethod.Get, url)`.
- declarative client interfaces such as Refit: `[Get]`, `[Post]`, `[Put]`,
  `[Delete]`, `[Patch]`, `[Head]` and `[Options]` on an interface method. Such
  a method has no body, so its request declares the operation itself.

Literal routes and URLs and values the compiler proves constant, such as a
`const` field, become facts. A local, or a readonly field whose type is declared
entirely in the file that uses it, stands for its initializer when that file
never assigns it again. These report nothing: conventional routing; an action
with `[AcceptVerbs]`; `[area]` and other route tokens; `IApplicationBuilder.Map`
middleware branches; framework constants such as `HttpMethods.Get`; and a route
on a group that is reassigned or carries a computed prefix, or on an
`IEndpointRouteBuilder` that arrives as a parameter.

The [producer checklist](../evidence.md#producer-checklist) for C#:

1. **Which prefixes belong in the path.** The class `[Route]` prefix and every
   `MapGroup` in the chain. A `~/` or leading `/` action template replaces the
   class prefix, while a group prefix always stays. A group or prefix that is
   not literal reports nothing.
2. **Whether the construct is an endpoint.** Controller actions and mapped
   handlers serve. Middleware branches, `MapControllers`, filters and
   authorization policies do not, and a declarative client interface reports
   requests instead.
3. **Dynamic or unknown.** `$"/talks/{id}"` and `"/talks/" + id` fill one whole
   segment, so they are dynamic. `$"/talks/find-{term}"` and a URL the source
   computes as a whole are unknown.
4. **The local helper.** Not supported. A request is reported at the operation
   that calls the client, so a helper that receives the path reports an unknown
   path and its callers report nothing.
5. **The base.** A leading `/` has no base. A relative path such as
   `"api/talks"`, which `HttpClient` resolves against its base address, and
   every declarative template set `configured`, and so does a configuration
   read followed by a path starting with `/`: an `IConfiguration` indexer,
   `GetValue`, `GetConnectionString`, a section's `Value`, or
   `Environment.GetEnvironmentVariable`. `"https://api.example.com/talks"`, a
   parameter, a configuration read continued without `/`, and any other computed
   URL report a leading `unknown` segment.
6. **Which operation a file-location route names.** C# declares no routes by
   file location, so the scanner names no operation that way.
7. **Which segments are constrained.** A route constraint makes its parameter
   or catch-all constrained: `{id:int}`, `{id:int?}` and
   `{**path:regex(...)}`. A segment mixing text with placeholders, such as
   `v{version}` or `{id}.{format}`, is one constrained parameter named after its
   first placeholder. A default value or a final `?` makes a parameter optional.
8. **Registration order.** ASP.NET Core prefers the most specific route, so the
   scanner reports no `order`.
