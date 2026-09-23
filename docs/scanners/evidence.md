# Scanner evidence

This page defines the semantics of the first operation evidence contract and
separates it from later proposed evidence. Implementations use the [scanner authoring guide](creating-a-plugin.md) and
[`@groma/scanner`](../../packages/scanner/src/index.ts). Introduce further exchange fields only as a reviewed example establishes
their need.

The accepted direction is that scanners produce temporary source facts and
core derives architecture boundaries and relationships. Relationship selection belongs in
[Deriving architecture relationships](../relationship-inference.md), shared
by every language plugin.

## Boundary for plugin authors

A scanner understands its language, module system, project configuration, and
the framework constructs it explicitly supports. It may use a compiler API or
another analyzer to establish source facts. It does not read component
descriptions, assign C4 IDs, choose important relationships, or write
architecture Markdown.

Core receives facts independent of the extraction tool. It maps source
locations to architectural ownership, reasons about the reported alternatives,
joins supported communication evidence, and applies the common interpretation
rules. TypeScript, Roslyn, and any other analyzer's internal objects must not
be required to understand these facts.

| Question | Scanner reports | Core decides |
| --- | --- | --- |
| What is called? | Invocation and canonical operation candidates | Which component owns each candidate |
| How is a receiver supplied? | Supported value origins and bindings | Whether the alternatives establish a provider owner |
| Which callback is dispatched? | Binding, receiver or slot identity, and invocation | Interaction direction and whether a statement is supported |
| Where does a request go? | Protocol operation, endpoint, and known address/configuration facts | Whether sender and receiver match across runtime boundaries |
| What remains unknown? | Unresolved alternatives and limits relevant to the facts | Whether to abstain from deriving a relationship |

Extraction can be sophisticated while remaining architecture-unaware. A
language-level method target is not automatically the concrete runtime
implementation. An interface declaration alone does not identify the object
supplied to a parameter.

## Execution entries and container placement

`entryPoints` is optional, temporary source evidence. Each fact contains:

| Field | Meaning |
| --- | --- |
| `file` | Exact repository-relative physical source entry. It identifies the same entry across scanners and declarations. |
| `declaration` | Source or configuration file that declares execution. Excluding it removes the fact. |
| `name` | Name from the source declaration, target or command; a starting title, never an architecture ID. |
| `files` | Analyzed files in this entry's own compilation or local module unit, excluding separately declared dependency units. |

A framework observer may report only some members. Every fact must include its
physical entry in both its member list and that observer's file inventory. Every
other member must also be in the inventory. Core merges
facts with the same `file`; another declaration or scanner does not create another
application. Missing facts mean unsupported or unknown, not proof of absence.
Source units here describe compilation or module input, not runtime ownership.

Core owns the application profile rule: a positive execution entry can establish a
C4 container within one known system. It reuses the entry's existing container or
creates one when there are unassigned components to place. It never creates an
empty container. Each entry identifies its own source; other sources reported by
multiple entries remain ambiguous. A whole component moves only when all its Code
files identify the same entry. Core does not split curated components or replace
existing container assignments. Shared libraries and unresolved placement stay
under their known system. Roots, directory names, imports and dependency closure
alone cannot establish a container.

The same rule runs after file reconciliation on first scans and rescans. A
component directly under a system can gain its container while keeping its ID,
source ownership and authored meaning. The existing curation writer moves its
Markdown and rebases links. Existing container identities survive title or ID
curation through their source owners. Scanning never accepts a draft.

The official producers currently recognize these source forms:

| Producer | Execution evidence | Source membership |
| --- | --- | --- |
| C# | Roslyn entry in an executable project, including supported Web/Worker defaults | That project's compiled sources; no referenced projects |
| Go | `main` in package `main` | That package and the module packages it imports, directly or indirectly |
| Rust | Cargo binary targets | That binary crate's modules; no library or dependency crates |
| Java | `public static void main(String[])`, including varargs | That project's compiler source set |
| Python | Module execution guard, `__main__.py`, or `project.scripts` | Resolved local imports within the declared project |
| JavaScript, TypeScript, React, Vue, Angular | Source-backed package commands/bins, HTML script entries, Angular build entry declarations, and readable Bun browser/compiled build entries | Resolved local modules within the declared package; framework companion files join their source unit |
| PHP | Source-backed Composer bins and literal PHP script commands | Explicitly included local sources within that Composer package |
| Swift | `@main`, `@UIApplicationMain` or `@NSApplicationMain` type, or `main.swift` top-level code | Its source file; project target membership is not analyzed |

These are declared extraction limits, not separate C4 policies. Dynamic build
configuration, unresolved launch commands and unobserved members remain unknown.
All twelve official scanners emit the same evidence contract, with no C4 kinds,
container IDs, architecture parents or ownership choices.

In OKF, the result remains ordinary typed Markdown concepts and links; the facts
are not stored as new knowledge concepts or metadata. An ordinary reader can read
the existing container and component documents and follow their links. In C4,
the result uses the existing container level. Groma interprets the temporary facts
and its application profile decides placement; neither OKF nor C4 mandates this
automatic inference rule.

## Vocabulary and introduction order

### Explicit multi-file source units

A scanner can report a primary source file and the files explicitly associated
with it by a supported language or framework declaration. Core creates one
component for an unambiguous unit and attaches unowned members to its existing
owner. Identical proposals from overlapping scanners do not create extra
components. Intersecting different units and different established owners
produce review diagnostics; core does not merge or reassign those files.

Associations remain temporary. The durable result is ordinary component Code
references, not another C4 level or stored association history. A component
may own files that no current unit covers, such as a human-curated combine or
a unit whose declaration was removed; core retains that ownership without a
diagnostic. Existing missing-file and incomplete-scanner retention rules still
apply.

An **operation** is executable work: a function, method, constructor, or
executable module initializer. An import spelling, namespace, interface type,
or file is not itself an operation. A file can contain several operations.

A **canonical provider** is the operation's implementation after resolving
identity-preserving aliases. A candidate provider is a possible target under
the supported analysis, not proof that the invocation executes at runtime.

For the first example, the necessary facts are:

| Fact | Required meaning |
| --- | --- |
| Operation identity | Identifies a declaration within the observation, independent of aliases used by callers |
| Source location | Exact repository-relative file and the location needed to identify the declaration or use |
| Normalized body tokens | Optional binding-normalized token sequence of the operation body, with source range |
| Invocation | A call or construction made by an operation, with its source location |
| Provider alternatives | Canonical operations that the supported analysis identifies as possible targets |
| Unresolved information | Whether additional or unknown targets remain possible within the reported analysis scope |

Operation IDs are opaque and scoped to one observation; they are never
parsed for architecture meaning. The executable fields are specified in the
[plugin guide](creating-a-plugin.md). Core
must not infer semantics by parsing a compiler's symbol name. Evidence IDs are
not architecture IDs, and the analysis records do not become durable concepts.
Core may compare body tokens as [architecture findings](../architecture-findings.md).
That comparison is not a relationship and not a required refactor.

The following facts require later examples before joining the shared exchange:

- **Additional value origins:** construction, mutable fields, and supported
  returns. The current contract already supports concrete argument/parameter
  bindings through the scanner's declared immutable value paths.
- **Registration and dispatch contracts:** event-bus or framework registration
  beyond the current concretely supplied named callback. An event key alone is
  insufficient.
- **Protocol endpoints beyond HTTP:** sending or receiving role,
  application/address identity, protocol, operation, and channel facts.
  [HTTP endpoints and requests](#http-endpoints-and-requests) are defined below.
- **Operation effects:** observed state/resource accesses and owner-local calls,
  with unknown effects preserved. No observed effect does not prove purity.

This is an introduction order, not a requirement that every plugin implement
every analysis. Unsupported evidence must not be represented as proof of
absence. The first contract should serve the first example, rather than encode
all possible languages and frameworks in advance.

## Overlapping observations

Two scanners may inspect the same source file with different compiler instances.
The exact repository-relative file path identifies that source. Core keeps one
curated owner and retains each scanner's Code contribution on that owner.
Scanner identity and compiler IDs do not create another owner. Existing
uncurated placement still follows the scan lifecycle; there is no new ranking
policy for competing initial scope suggestions. Curated membership is authoritative.

For claims that can be compared across scanners, operations and invocations
provide `position`: a zero-based UTF-16 source offset, excluding leading trivia.
An operation is identified by its file and declaration position. A claim is
identified by that operation, the invocation position, the named member, and
the concrete binding's file and position. A binding without source positions
cannot be compared across compilers. Operation IDs remain local links, never
source identities. Positions are independent of optional body tokens.

For the same claim, certain provider sets must agree after resolving providers
to their source positions. Different certain sets produce a
`conflicting-providers` diagnostic and none of those disputed claims establishes
a derived relationship, even when their targets share one curated owner.
Equal sets are one observation of the interaction, not extra votes. Different
concrete binding contexts remain separate. Evidence without the positions
needed for comparison is interpreted only within its observation.

An unresolved observation does not contradict a certain supported claim from
another scanner. This includes the narrow Angular example: a named output is
bound to a handler at a concrete template location, while the embedded
TypeScript scanner cannot resolve that binding. The existing supplied named
callback rule can use the Angular contribution. This does not enable ordinary
service calls or injected class-receiver inference.

Conflicts are successful scan results, reported through
`ScanSummary.evidenceConflicts` and the scan report. They are distinct from an
enabled scanner failing to complete: failed scanners contribute no fresh
observation, while successful scanners reconcile. Stored Code references and
relationships that depend on a failed scanner are retained. Repeat scans preserve authored relationships and
curated file membership in either observer order. Source offsets, provider
sets, and conflict details stay in memory; they are not new OKF fields or C4
elements. Ordinary Markdown readers retain the existing Code links and
authored relationship meaning. The independent
[composition fixture](../../test/fixtures/scanner-composition/) exercises this
contract; framework extraction has its own scanner fixture.

## HTTP endpoints and requests

A scanner that recognizes its ecosystem's routing and HTTP clients reports
the endpoints the application serves and the requests it sends. It never
refers to another scanner. Core joins the facts of every observation with the
[HTTP request rule](../relationship-inference.md#http-requests).

An **endpoint** is a method, a path, and the operation that handles it. Only a
server handler that answers HTTP requests is an endpoint. A client-side router
route, middleware, an interceptor, a proxy rule, and a security matcher such as
`/api/**` are not endpoints, even though they are written as path patterns;
reporting one would claim an answer nothing serves, or hide a real provider.
The method is `*` when the endpoint accepts every method. The path is the
complete path the application serves, with every prefix the source declares,
such as class-level prefixes, route groups, and mounted routers. Each segment
is one of:

| Segment | Matches |
| --- | --- |
| Literal | Exactly its text |
| Parameter | One segment with any text |
| Optional parameter | One such segment, or none |
| Catch-all | The remaining segments, at least one; always last |
| Optional catch-all | The remaining segments, possibly none; always last |

A parameter or catch-all is **constrained** when the application accepts only
some of the values its kind allows. A typed or pattern-restricted parameter,
such as `{id:int}`, `<int:id>` or `{id<\d+>}`, is a constrained parameter, and
so is one segment that mixes literal text with a placeholder, such as
`talk-{id}`. A pattern that may span segments, or that the format cannot state
otherwise, becomes a constrained optional catch-all in its place, and the rest
of the route is dropped. A constrained segment is never widened to a plain one
and its endpoint is never omitted: widening lets a request the application
rejects reach the endpoint, and omitting it lets another file's route take the
requests it serves. The
[HTTP request rule](../relationship-inference.md#http-requests) states how core
matches constrained segments.

A router that tries routes in the order they were registered and takes the
first match, such as Express or Django, gives each endpoint an `order`: the
`application`, which is the repository-relative path of the file that creates
the application, or of the file that declares the route when the scanner cannot
identify that file, and the endpoint's `position` in that application's
registration sequence. A smaller position is tried first. Endpoints whose
relative order the scanner cannot prove share one position, so one position for
every endpoint of an application is always safe. A router that prefers the most
specific route omits `order`. The
[HTTP request rule](../relationship-inference.md#http-requests) states how core
ranks by position.

An endpoint declared by file location uses the same shape. The scanner
translates the location into segments and reports the operation that the
location designates, such as an exported handler or the file's module
initializer. An optional literal or segment group becomes one endpoint for each
variant.

A **request** is a method, a URL, and the operation that supplies the URL. The
fact states which parts the source proves:

| Part | Reported as |
| --- | --- |
| Method | A known method, or omitted |
| Path segment | A literal, a dynamic segment, or unknown text |
| `configured` | Set when the path follows a configuration value |

Decide what precedes the path by what the scanner can see, with no
framework-specific rule:

- Nothing precedes a root-relative path: report the segments alone.
- The scanner resolves the base to literal text without a scheme or authority:
  report its path as ordinary literal segments.
- The scanner cannot see the value, such as a named configuration or
  environment setting or a constant defined elsewhere: set `configured` and
  report the path that follows it. The base's own content is not part of the
  path.
- The base states a host, or the scanner cannot resolve it at all: report a
  leading `unknown` segment instead. Core then derives nothing, and the fact
  still records what the scanner saw.

The [HTTP request rule](../relationship-inference.md#http-requests) states
which requests core compares, when a comparable request derives a row, and the
accepted limit of a configured base.

The path ends before the query and fragment, which are ignored even when they
are computed. Literal text uses URL path characters; percent-encode anything
else.

A computed value that fills one whole segment is dynamic; other computed text is
unknown, which covers a partly known segment and an unknown remainder. Literals
and values the scanner proves constant are literal text. A request made through
a local helper counts only when the scanner proves that the helper passes the
URL and method to a recognized client unchanged. The request is then reported at
the helper's caller. A helper that prepends a configured base value still passes
a known path. Any other transformation, an unrecognized client, or unresolved
helper callers leave the request unknown. A declarative client that shares
annotations with server routes reports requests, never endpoints. Scanners that
inspect the same file may report the same fact without creating ambiguity, and
an unknown request does not veto another scanner's known one.

The facts are temporary evidence. They add no OKF field or stored route and do
not become C4 elements. A derived row is an ordinary relationship between the
requesting and providing files, so a Markdown reader sees a linked statement
such as `Calls HTTP endpoint: GET /talks/:id`.

### Producer checklist

Every scanner decides the same eight questions. Each scanner page answers them
in this order, with its ecosystem's constructs:

1. **Which prefixes belong in the path.** Include every prefix the source
   declares: a class-level or controller prefix, a mounted group's prefix, and a
   router's own path. A Spring `@RequestMapping("/api")` class with
   `@GetMapping("/talks")` reports `/api/talks`. When a group's prefix is not
   literal, report one blocker in place of its routes: the prefix's readable
   literal part followed by a constrained optional catch-all, with method `*`.
   Report the spelling the source uses, including a name a template generates
   such as `/api/Talks`; the
   [HTTP request rule](../relationship-inference.md#http-requests) compares
   literal text without regard to case.
2. **Whether the construct is an endpoint.** Only a handler that answers HTTP
   requests is. A client-side router route, middleware, an interceptor, a proxy
   rule, and a security matcher such as `/api/**` are not. A declarative client
   that shares the server's annotations reports requests.
3. **Dynamic or unknown.** A value that stands between two slashes, or between
   a slash and the end of the path, is dynamic: `` `/talks/${id}` ``. A value
   sharing its segment with other text is unknown:
   `` `/talks/${id}-${slug}` ``, as is a path built from a value the scanner
   cannot resolve. Do not ask whether a dynamic value could contain a slash at
   runtime; the segment it is written in decides.
4. **The local helper.** `get('/talks')` calling a local
   `get(path) { return fetch(base + path) }` reports one request at the caller,
   because the URL and method reach the client unchanged. A helper that edits
   the path, chooses the method, or reaches an unrecognized client reports
   nothing.
5. **The base.** `fetch('/api/talks')` has no base. `fetch(API_URL + '/talks')`
   with `API_URL` read from configuration sets `configured`.
   `fetch('https://api.example.com/talks')` and `fetch(buildUrl(x))` report a
   leading `unknown` segment.
6. **Which operation a file-location route names.** The operation the location
   designates: the exported handler for that method, or the file's module
   initializer when the file exports no such handler. `app/api/talks/route.ts`
   with an exported `GET` names that function.
7. **Which segments are constrained.** A typed, pattern-restricted or
   mixed-text segment is a constrained parameter: `{id:int}` reports
   `{ kind: 'parameter', name: 'id', constrained: true }`. A pattern that may
   span segments is a constrained optional catch-all that replaces the rest of
   the route: `^files/(?P<path>[a-z/]+)\.txt$` reports `files` and then
   `{ kind: 'catch-all', name: 'path', optional: true, constrained: true }`.
8. **Registration order.** A router that takes the first registered match
   reports `order` on every endpoint. In a root URLconf `mysite/urls.py`, a
   Django `path('<name>/', ...)` followed by `path('talks/', ...)` reports
   `{ application: 'mysite/urls.py', position: 0 }` and then position `1`.
   Number the sequence the scanner proves, such as one URLconf and its
   includes, or one file's mounts and each mounted router's source order;
   endpoints whose relative order it cannot prove share one position. When
   the scanner cannot identify the file that creates the application,
   `application` is the file that declares the route. A fallback the framework
   always tries last, such as Laravel's `Route::fallback`, takes the largest
   position. A route the scanner sees but cannot read, such as one with an
   unknown handler or an unresolved include or mount, is reported at its
   position as its readable literal prefix followed by a constrained optional
   catch-all, with method `*`, so no request under that prefix derives a row
   to a route registered at or after it in that application. A router that
   prefers the most specific route, such as Spring or ASP.NET Core, omits
   `order`.

## Completion, precision, and uncertainty

Returning an observation means the scanner successfully produced its declared
analysis for reconciliation. Failure throws; there is no `complete` flag.
Success does not claim that every possible runtime call has been identified.

A successful operation analysis can contain unresolved targets. Distinguish a
known provider set from whether that set may be incomplete. A single target
left after truncating a larger set is not an unambiguous provider.

Bounded analysis must use declared, deterministic limits. If a propagation
limit is reached, affected facts remain unresolved. Elapsed time must not
silently choose the emitted architecture. An externally stopped experiment
produces partial research output, not a complete production observation.

Reports must not turn type compatibility into implementation identity, or
unsupported dynamic behavior into an empty, supposedly complete target set.
Core may establish an owner-level interaction from several known targets only
when all share one owner and unresolved alternatives do not undermine it.

Repeated observations of the same use are not independent votes. An imported
binding, its invocation, and its receiver provenance explain one interaction;
their presence must not inflate a confidence score.

## First example: canonical provider

**Status:** implemented and checked with the minimal
[operation-wiring fixture](../../test/fixtures/operation-wiring/).

**Entry and outcome:** scanning invokes a reconciliation operation through a
re-export. The scanner identifies the actual provider. Core sees that caller
and provider have the same owner and produces no cross-component relationship
for that invocation.

The motivating Groma source is:

- [`src/scanner.ts`](../../src/scanner.ts) invokes `reconcileScanObservations`.
- [`src/core.ts`](../../src/core.ts) re-exports that operation.
- [`src/scan-reconciler.ts`](../../src/scan-reconciler.ts) implements it.

The caller and implementation belong to Scan lifecycle. The re-export file
belongs to World loader. These names explain the repository example; they
must not become extractor rules or test expectations.

A minimum language-neutral example has this structure:

```text
caller file:     run invokes imported reconcile
API file:        exports the provider's reconcile without implementing a wrapper
provider file:   implements reconcile

ownership:       caller + provider → component A
                API file          → component B
```

Expected scanner facts identify `run`, the implemented `reconcile`, and the
invocation from one to the other. The re-export declaration does not introduce
an executable intermediary. Resolution can use import and alias evidence
internally; core's provider must be the implementation, not the API file.

| Variant | Expected result |
| --- | --- |
| Rename the imported binding | Same canonical provider and owner-level result |
| Add or remove an identity-preserving re-export | Same canonical provider and owner-level result |
| Repeat the invocation | No new component relationship for the same-owner interaction |
| Split implementation code into files owned by A | Same owner-level result |
| Replace the re-export with a function in B that calls the provider | Report calls through the active wrapper; do not collapse it as an alias |
| Provider resolution is unsupported or incomplete | Report the limitation; do not assert that the sole visible declaration is the implementation |

The active-wrapper variant establishes operation candidates involving B; it
does not settle whether those candidates belong on the map. That remains a
core selection decision. Likewise, changing the provider's owner creates a
cross-owner candidate, not automatic proof of architectural importance.

Future automated checks should use a minimal fixture under `test/fixtures/`,
not load the live Groma architecture. Language-specific examples must satisfy
the same fact semantics: for example, TypeScript resolves module aliases while
C# resolves language symbols and retains uncertainty about virtual dispatch.
Neither plugin decides component ownership.

## Bounded Jelly comparison

**Status:** completed for the alias control and Groma initialization callback.
The [recorded comparison](../relationship-inference.md#first-implementation-and-jelly-comparison)
includes results, limits, and costs. Jelly is not a production dependency.

Question: can [Jelly](https://github.com/cs-au-dk/jelly) identify useful provider
or callback wiring that the existing TypeScript analysis misses, at a cost
appropriate for an interactive scan?

First establish the canonical-provider example above as a control. Then inspect
one Groma callback: the CLI supplies `openViewer` to `runInitCommand`, which
invokes it after initialization. The source is
[`src/cli.ts`](../../src/cli.ts) and
[`src/init-command.ts`](../../src/init-command.ts). Review the actual binding
and targets before judging either analyzer's output.

Record the exact source snapshot, explicit owned-file manifest, analyzer
versions, commands, dependency scope, and deterministic analysis bounds. Use
the same source set for both analyzers; directory-discovery heuristics must not
quietly change the comparison. Run static analysis only and distinguish a
completed result from partial output.

Compare correctly established targets, incorrect targets, and unresolved cases
against the reviewed source witnesses. Also record elapsed time and peak
process memory. Additional edges alone are not an improvement. Do not combine
analyzer outputs by union and call the result verified.

Jelly targets JavaScript/TypeScript on Node.js, documents incomplete modeling,
and treats Node standard-library code as unknown. Its support claim does not
establish Bun-specific communication semantics. Check the installed version's
actual command options and limits before running; do not copy a time limit
into production as an architecture-selection rule.

The decision is whether to reuse Jelly, reproduce a small useful extraction
technique with the existing compiler, or retain the limitation. Useful output
must fit the language-neutral evidence semantics. A tool-specific result must
not dictate the shared contract.

After human review of the Groma result, freeze the first rule before
checking Backlog's constructor-injected task handler. Record the result and
decision in the [inference document](../relationship-inference.md#evaluation-and-recording-decisions)
before extending the experiment. Do not expand into more frameworks or global
analysis to improve a graph count.


## Concrete binding scope

A callback may have different implementations in different callers. Report one
invocation alternative set per concrete argument binding. For example, if one
caller supplies a viewer callback and another supplies a no-op, those are two
binding-scoped observations. A conditional expression within one supplied
argument instead retains all its known alternatives and its unresolved bit.
Core must not split that uncertain set to manufacture a unique target.

A binding's file and line locate the supplying call. `member` names the invoked
source-language member; it is evidence, not an architectural role. The current
rule uses that name in a literal callback statement without inventing domain
meaning. The binding records and operation graph disappear after core writes
the selected relationship rows.

The TypeScript implementation follows source functions, immutable aliases,
relative re-exports, object-literal members, and arguments forwarded through
parameters. It bounds each resolution path at eight steps and each parameter's
known callers at 32. Reaching a bound remains unresolved. Dynamic values,
unsupported returns, object spreads, and observed receiver-member writes do
not establish a complete provider. Interface signatures alone do not identify
an implementation. These limits are extraction scope, not architecture policy;
another language plugin can establish the same facts with different machinery.
