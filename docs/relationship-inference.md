# Deriving architecture relationships

Groma should automatically describe collaborations that it can support with
source evidence. People and coding agents author interactions whose meaning
cannot be established automatically. A useful result explains responsibilities
and their interactions; its quality is not determined by its relationship count.

This page records the implemented rules, their limits, and the research
needed to extend them. The
[Markdown contract](component-markdown.md) describes current storage, and the
[scanner authoring guide](scanners/creating-a-plugin.md) describes the executable
plugin API. Evidence semantics live in
[Scanner evidence](scanners/evidence.md).

## Ownership of the work

```text
source → scanner facts (temporary) → core interpretation → relationships in Markdown
```

Scanners are language-aware and architecture-unaware. They identify operations,
resolve source-language bindings, and report wiring and analysis limitations.
They do not decide which dependencies deserve architecture relationships.

Core maps those facts to the existing component ownership, interprets supported
interaction patterns, and selects statements it can justify. The architecture
writer persists those relationships alongside human- and agent-authored ones.
Viewers consume the resulting architecture, not the analysis graph.

Raw dependency graphs, call sites, value-flow records, feature vectors, and
scores remain temporary. Existing source-file ownership is still durable
architecture knowledge; it is not the raw dependency evidence being removed
from storage. A successful derivation refreshes core-owned relationships and
preserves authored ones. Scan failure does not establish that a relationship
disappeared: the existing complete-observation boundary remains authoritative.

The relationship document has separate derived, current authored, and draft
sections. A scan replaces the derived section. Current authored text takes
precedence for the same exact file pair; a draft remains separate. Editing a
derived row takes authorship. This precedence does not verify the authored
statement or accept a draft.

## OKF and C4

Operations, calls, bindings, and HTTP endpoint and request facts are supporting
source facts. They do not become C4 components, containers, or another viewer
level, and they are not stored. A selected relationship connects existing
architectural responsibilities. File ownership is an input; scanning a
dependency does not change that ownership.

Ordinary Markdown and OKF readers should understand the persisted statement
through its linked endpoints, description, and mechanism. OKF provides the
portable document structure. C4 provides architecture levels and boundaries.
Groma's application profile owns inference and selection; neither standard
defines an automatic importance test for source dependencies.

A C4 container is a runtime boundary, not merely a package or folder. A source
reference across assigned containers can indicate shared code or unsuitable
ownership. It does not prove network or inter-process communication. See the
[C4 container](https://c4model.com/abstractions/container) and
[component](https://c4model.com/abstractions/component) definitions.

## Three judgments

| Judgment | Required support | What it does not establish |
| --- | --- | --- |
| A source dependency exists | A resolved use, invocation, binding, or access | That it is important to the architecture |
| The provider or communication path is known | Canonical targets or concrete wiring, with unresolved alternatives reported | That the interaction executes in every run |
| The interaction belongs on the map | A reviewed interpretation rule and a supportable statement | That all other interactions are irrelevant |

These judgments must not be collapsed into a numeric confidence score. A single
well-supported interaction may be sufficient. Many weak observations cannot
compensate for an unknown provider or missing communication path.

Core must be able to decline to emit a relationship. This is *abstention*: an
unresolved interpretation remains available for human or agent authoring rather
than becoming an automatic claim. It does not mean that no interaction exists.

## Current inference rule

Core derives a **supplied named callback** interaction when an invocation has
a concrete source binding, a named member, at least one canonical target,
no unresolved alternative, and one provider owner distinct from its caller's
owner. The caller is the operation that invokes the callback, not the code
that supplies it. Each concrete binding is checked separately. Alternatives
inside one binding must agree on the provider owner.

Core first [combines overlapping observations](scanners/evidence.md#overlapping-observations)
at the same operation, invocation, and concrete binding location. Certain
provider sets must agree; disputed claims cannot establish a derived row.
An unresolved scanner contribution does not veto another scanner's supported
binding. The binding may be a supplied object argument or the supported
Angular named output-to-handler template binding. This evidence remains
temporary and does not alter authored relationship meaning.

The stored statement is `Invokes supplied callback: <member>`, with the scanner
language as its mechanism. Several callbacks for one ordered file pair share
one statement, such as `Invokes supplied callbacks: cancelled, error, merged`.
Distinct names are sorted and included once, independently of scanner and
invocation order. This is a source-supported possible interaction, not a promise
that a branch runs in every execution. It does not classify a callback as an
event. The statement remains visible after component, container, and system
projection and in ordinary Markdown. Authored descriptions remain unchanged.
Several derived interactions for one ordered file pair share one row: their
statements are joined with a semicolon, and the mechanism lists every
contributing scanner.

The callback rule does not classify ordinary direct calls as architectural work.
Neither rule infers event-bus, class-receiver, or service-operation meaning.
Bare callbacks supplied to generic functions also remain evidence. The rule
covers named capabilities supplied through concrete object arguments, starting
with Groma's initialization and viewer callbacks. Its coverage is intentionally
limited; authored relationships still carry domain meaning not established by
this rule. No score, name keyword, authored-pair match, or import threshold is
used to select a relationship.

### HTTP requests

Scanners report the HTTP endpoints an application serves and the requests it
sends as [HTTP facts](scanners/evidence.md#http-endpoints-and-requests). Core
joins the facts of every observation. A derived row cannot be deleted, because
the next scan restores it, while a missing row can still be authored. Core
therefore derives a row only when all of these hold:

1. The request method is known and equals the endpoint method, or the endpoint
   accepts every method.
2. The request path is comparable: no segment is unknown, and a path that
   follows a configured base starts with a literal segment. A base stating a
   host, an unresolvable base, and partly known text arrive as unknown
   segments, which produce no row.
3. The request reaches the endpoint. Each request segment reaches the endpoint
   segment in its position as the table shows. A request that reaches every
   segment certainly reaches the endpoint certainly; one that reaches some
   segment only possibly reaches the endpoint possibly. An optional parameter
   may be absent. A catch-all takes the remaining segments, at least one unless
   it is optional.

   | Endpoint segment | Request literal | Request dynamic segment |
   | --- | --- | --- |
   | Literal | Certainly when the text is equal, ignoring case | Possibly |
   | Parameter | Certainly | Certainly |
   | Constrained parameter | Possibly | Certainly |
   | Catch-all | Certainly | Certainly |
   | Constrained catch-all | Possibly | Possibly |

   The request may also reach the endpoint after one leading literal that only
   one side states, such as `/api` or a deployment path, is removed. The
   endpoint must then continue with a literal that the request's next segment
   reaches, or with a constrained catch-all, which is reached only possibly.
   Removing no segment, and removing each segment, assume different
   deployments.
4. Three filters then remove matches that cannot decide the row:
   1. An endpoint whose path is one catch-all, such as a fallback or a route a
      scanner could not read at the root, speaks for its own application only,
      that is its scanner and its registration application. It drops out when
      endpoints of other applications reach the request without their
      catch-all taking part of it, and none of its own application's do.
   2. A match that removed the literal before a constrained catch-all fits any
      request, so it counts only when another match removes the same segment.
   3. An endpoint reached certainly without removing a segment, and without its
      catch-all taking part of the request, shows that the paths compare as
      written. Every match that needed a segment removed then drops out, and
      one reached certainly only by removing a segment counts as possibly
      reached.
5. One preference ranks what remains:
   - Specificity, when no endpoint carries a registration order and every match
     assumes the same deployment. The paths are compared segment by segment: a
     literal before a parameter before a catch-all, a path that has ended before
     one continuing with an optional parameter or catch-all it does not use,
     and the first position that differs decides.
   - Registration position, when every endpoint carries a registration order in
     one application as one scanner reports it and every match assumes the same
     deployment. The smaller position wins, whatever the specificity; equal
     positions have an unknown order.
   - None, in every other case: every remaining endpoint ranks the same.
6. The row follows this checklist:
   1. The chosen endpoints are those reached certainly with the best rank. At
      least one must exist.
   2. An endpoint competes with them when it is reached, possibly or certainly,
      with a rank at least as good. Under specificity, an endpoint with a
      constrained segment also competes when it ranks lower, because routers
      rank constraints against parameters by their own rules, unless the chosen
      endpoint has a literal where their segments first differ and no
      constrained segment comes before that position: every router prefers a
      literal.
   3. When a chosen endpoint has a constrained segment, every remaining
      endpoint competes, because values the constraint rejects go elsewhere.
   4. No competing endpoint ends in a constrained catch-all, which may stand
      for routes whose handler files the scanner could not tell.
   5. The chosen and competing endpoints belong to one file.
   6. Unless specificity ranked them, exactly one distinct endpoint is chosen,
      because the router's choice among several is unknown.
7. The requesting and providing files have different owners.

The row runs from the requesting file to the providing file. Its statement
lists each chosen endpoint with the request method, such as
`Calls HTTP endpoint: GET /talks/:id`. `:id?` marks an optional parameter;
`:path+` and `:path*` mark catch-alls that require or allow a remainder.
The mechanism lists the contributing scanners, as for other derived rows.

`{}` is a dynamic request segment, `!` marks a constrained segment, and a
number is a registration position in one application. Files are A and B.

| Request | Endpoints | Result |
| --- | --- | --- |
| `GET /api/talks` | A `/api/:section`, B `/talks` | A: the exact path hides `/talks` |
| `GET /api/talks` | A `/:rest*`, B `/talks`, one application | No row: two deployments |
| `GET /api/account` | A `/api/account`, B `/:first/:second` | A: a literal is more specific |
| `GET /talks` | A `/talks`, B `/talks/:page?` | A: a path that has ended is more specific |
| `GET /talks/` | A `<name>/` at 0, B `talks/` at 1 | A: registered first |
| `GET /api/talks/{}` | A `/api/talks/:id` at 0, B `/:rest*` at 1 | A: the fallback is registered later |
| `GET /talks/{}` | A `/talks/:id`, B `/talks/archive` | No row: `archive` may reach B |
| `GET /talks/{}` | A `/talks/:id` and `/talks/archive` | A, `GET /talks/:id` |
| `GET /talks/{}` | A `/talks/:id!`, B `/talks/:rest+` | No row: rejected values reach B |
| `GET /files/a/report.json` | A `/files/:dir/:name`, B `/files/:path*!` | No row: B's router may rank it first |
| `GET /api/account` | A `/api/account`, B `/:path1!/:path2!` | A: every router prefers the literal |
| `GET /api/talks` | A `/api/:rest*!` at 0 and `/:rest*` at 1 | No row: A's first route stands for unknown files |
| Configured `GET /talks` | A `/api/:rest*!` at 0, B `/api/talks` at 1 | No row: A is registered first |

Tolerating one leading segment is an accepted trade-off that is expected to be
right in most repositories. Requiring a shared literal after the removed
segment keeps a prefix from pairing with an unrelated parameter. The rule does
not model hosts, ports, or deployments beyond one removed segment. A configured
base is assumed to address a server in this repository, so a configuration
value that points at a third-party service can produce a wrong row; that is an
accepted limit. Scanners decide what a base is from what they can see, as
[scanner evidence](scanners/evidence.md#http-endpoints-and-requests) describes.
Literal text is compared without regard to case, because some frameworks route
case-insensitively and generate a path from a class or controller name. Where
two endpoints differ only in case, they either share a file or the one-file
check already abstains. A row keeps the endpoint's own spelling.

## Provider rules and later candidates

Provider rules P1 to P3 are implemented for the supported extraction below. P4
is implemented for HTTP requests. P5 is enabled only for concretely supplied
named callbacks. P6 remains a proposal.

- **P1.** Resolve identity-preserving aliases and re-exports to their canonical
  operation before applying ownership. A call whose caller and provider share
  an owner produces no cross-component relationship.
- **P2.** Preserve active intermediaries. If A calls B and B calls C, retain
  those operation edges. Even a small forwarding function is executable
  behavior, not a symbol alias. Do not invent a direct A-to-C collaboration.
- **P3.** For a call with several possible targets, an owner-level claim is
  possible only if all supported alternatives have that owner and none are
  unresolved. Do not name one implementation when only the owner is
  established.
- **P4.** Match protocol interactions using protocol, method, and endpoint
  information. Scanners recognize source constructs; core joins the reported
  facts, as [HTTP requests](#http-requests) describes.
- **P5.** For callbacks, require a concrete binding and an invocation or
  supported dispatch contract. Registration and dispatch have different
  directions. Passing a function does not by itself establish that it is
  called.
- **P6.** Trial service-operation selection separately. State access, resource
  use, orchestration, and participation in an entry operation may help, but
  none independently distinguishes domain work from supporting functionality.

Every emitted description must stay within the established evidence. Resolving
an operation does not authorize inventing its business purpose. The main open
question is which service-operation patterns support useful descriptions
without additional domain interpretation.

## Counterexamples that constrain the rules

| Case | Lesson |
| --- | --- |
| A task handler receives a server through a type annotation and invokes its methods | Follow the supplied receiver; do not exclude interactions based on type-import syntax |
| A browser imports server-owned record types | Shared data definitions do not establish a request to the server |
| Scanning uses a name formatter owned by Draft | Correct provider ownership does not prove collaboration with the Draft responsibility |
| A pure pricing rule and a generic formatter both transform arguments | Purity does not determine architectural importance |
| A cached formatter and a repository both access state | Statefulness does not determine architectural importance |
| A central service and a common helper both have many callers | Popularity is not a reason to include or exclude either |

Unsuitable ownership may need correction through normal curation. Core must
not silently assign a more convenient owner to make a relationship look useful.

## Recorded exploratory findings

These findings were recorded on 6 September 2026 from an uncommitted working
tree. They are investigation evidence, not a reproducible benchmark tied to
the published main branch, a complete reference, or regression-test targets.

Groma's 99 authored directed pairs overlapped with 66 of 330 automatically
projected source pairs. A temporary local-workspace resolver recovered nine
additional authored pairs and seven other pairs: 346 candidates, with 75
authored matches. Matching endpoints does not validate the relationship text.

Of the original 264 additional pairs, 77 had type-use evidence only, 185 had
calls or other value use, and two had re-export evidence only. Removing type
references would leave most additions and lose some useful interactions.

| Experimental selection | Pairs retained | Authored pairs matched |
| --- | ---: | ---: |
| Any distinct used import binding | 346 | 75 |
| At least three distinct used import bindings | 144 | 32 |
| At least five distinct used import bindings | 73 | 17 |
| Different assigned containers | 169 | 37 |

A binding was counted once per source file, target file, and imported local
name; repeated uses did not increase its count. A small combined-score trial
selected four of 68 held-out candidates, including three of the 15 authored
pairs in that set. The other selected pair was unlabeled, not a confirmed error.
These results do not establish architectural precision or calibrated confidence.
That evaluation set has informed the design and is no longer a blind holdout.

Backlog's observed 212-file, 774-pair graph largely assigned one file to each
component. Requiring two distinct file pairs per component pair removed every
relationship. Counts are sensitive to ownership granularity and file structure.

The durable conclusions are to improve provider and wiring evidence, keep
strength metrics diagnostic initially, and review architectural meaning
separately. The existing 99 statements are useful examples, not a count to fit.

## Evaluation and recording decisions

Start with the [canonical-provider example](scanners/evidence.md#first-example-canonical-provider)
before extending extraction. For subsequent selection examples, review the
endpoints, direction, and statement against source and component responsibility:

- **Include:** the complete statement belongs on the map.
- **Exclude as support:** the dependency is real but does not describe the
  architectural collaboration being represented.
- **Uncertain:** provider, wiring, ownership, or relevance remains unresolved.

Unlisted pairs are not negative examples. Measure provider/path correctness,
statement correctness, map-selection correctness, and coverage separately.
Report uncertain emissions explicitly. For counts of included, excluded, and
uncertain emissions I, X, and U, report both I/(I+X), when defined, and the
verified fraction I/(I+X+U). Neither number replaces the uncertainty count.

Develop one rule on a small Groma example, review it, then freeze it before
evaluating other components and Backlog. Examples used to revise a rule become
development data. Do not use component names, path keywords, repository names,
or authored membership as selection signals.

Check that alias spelling, barrels, repeated calls, and splitting files within
one owner do not change the selected component relationships. These checks
preserve architectural meaning; they do not require identical analysis records.

Before the next experiment, record its question, expected example, exact source
revision or snapshot, file manifest, analyzer version, commands, and limits.
Afterward, record observed and expected results, unresolved cases, elapsed time,
peak process memory, and the resulting decision. A failed experiment can reject
a technique without reversing the accepted product principles. Keep reusable
conclusions here; do not replace the manual with a conversation transcript.

The complete-startup targets are under one second for Groma and approximately
three to five seconds for an OpenClaw-sized repository, within ordinary
developer-machine memory. Measure extraction costs separately and include
them in the complete flow before adopting an analyzer. The clean-repository
measurements below cover the current callback rule.

## Research supporting the direction

- [Software Reflexion Models](https://www.cs.ubc.ca/~murphy/papers/rm/fse95.html)
  maps a high-level model to source and exposes agreement and differences. It
  does not automatically classify every additional dependency as a mistake.
- [CodeQL call-graph analysis](https://codeql.github.com/docs/codeql-language-guides/codeql-library-for-javascript/#call-graph)
  distinguishes incomplete and imprecise target information.
  [Type tracking](https://codeql.github.com/docs/codeql-language-guides/using-type-tracking-for-api-modeling/)
  provides examples of following API objects and callbacks.
- [Method stereotypes](https://www.cs.kent.edu/~jmaletic/papers/ICSM06.pdf)
  investigates lightweight operation roles in C++. Applying those roles to
  Groma's map selection is a hypothesis, not a result established by that work.
- [Lattix dependency strength](https://docs.lattix.com/lattix/userGuide/Filtering_and_Configuring_Dependencies_and_Subsystems.html)
  distinguishes ways to count coupling. Counts do not establish architectural
  meaning. [Graph backbone filtering](https://arxiv.org/abs/0904.2389) measures
  significance under a network model, not confidence in a C4 statement.

The next analyzer experiment is specified in
[Scanner evidence](scanners/evidence.md#bounded-jelly-comparison).


## First implementation and Jelly comparison

On 6 September 2026, the four-file alias control resolved the caller directly
to the provider with both Jelly and the compiler. Both retained the executable
wrapper's call to that provider. On Groma, both found two implementations for
`actions.openViewer` in `offerFirstScan`: the CLI callback and the separate
no-op callback supplied by `ensureInitialized`. The compiler keeps their
argument bindings separate, so the CLI binding supports `init-command` →
`commands`; the no-op binding remains internal to initialization.

The comparison used a copied, explicitly enumerated 219-file Groma ownership
snapshot. Its manifest SHA-256 was
`4c6e92068ed4ed2645ace2037b55d14f69389dccb20b280dca11c22da89077d4`.
This was an uncommitted source snapshot, not the published main branch. The
reusable behavioral control is now [operation-wiring](../test/fixtures/operation-wiring/)
and its [checks](../test-bun/source-relationships.test.ts); the full snapshot
measurements are research observations, not a reproducible release benchmark.

| Analyzer | Whole command | Maximum child-process RSS | Result on the reviewed callback |
| --- | ---: | ---: | --- |
| Jelly 0.13.0, Node 24.13.0 | 1.68 s | 565 MB | Both implementations, merged at the invocation |
| TypeScript 7.1.0-dev.20260905.1, Bun 1.4.1 | 0.44 s | 313 MB | Both implementations, separate concrete bindings |

RSS is operating-system resident memory; this measurement does not establish
simultaneous aggregate memory of every process. These are extraction commands,
not complete viewer startup times. The compiler's measured analysis alone was
approximately 0.35 seconds. Jelly reported 2,766 functions, 3,548 call-to-function
edges, 530 warnings, zero errors, no timeout, and no aborted propagation.
Unknown dependencies and unsupported features still limit that result.

Jelly ran static analysis only, with explicit entry files, `--ignore-dependencies`,
`--max-indirections 8`, `--no-patch-escaping`, `--no-callgraph-external`,
`--no-callgraph-native`, and `--no-callgraph-require`. The same owned source
manifest was passed to the compiler. Neither analyzer executed application
code. No dynamic or approximate interpretation was enabled.

The decision is to keep Jelly as an offline comparison tool and use the existing
compiler for the first production rule. Jelly is not a Groma dependency. Its
additional edges were not accepted as verified architecture. On this snapshot,
the supplied-operation rule selected 15 file pairs; this is coverage evidence,
not a precision score or a target relationship count. Direct service calls and
protocol matching remain open work, and Backlog's injected receiver example
still needs its own reviewed extraction step.

## Clean repository validation

On 6 September 2026, clean Backlog.md and OpenClaw scans retained every
supported source file with exactly one owner. A second scan produced identical
Markdown in both repositories. These raw scans contain no authored statements.

| Project | Source files | Elements | Relationships | CLI launch to painted map |
| --- | ---: | ---: | ---: | ---: |
| Curated Groma | 220 | 83 | 113: 99 authored, 14 derived | 0.59 s |
| Raw Backlog.md | 212 | 275 | 4 derived | 0.72 s |
| Raw OpenClaw | 3,164 | 3,200 | 220 derived | 4.59 s |

These are individual local measurements using Bun 1.4.1 and TypeScript
7.1.0-dev.20260905.1. A local timing harness launched the real CLI, forwarded
its HTTP responses, and waited for every building and route to enter the DOM,
two animation frames, and a browser paint event. The times include scanning,
model loading, placement, routing, browser rendering, and the harness overhead.
They are measurements of this relationship set, not a latency guarantee for
broader inference.

OpenClaw exposed repeated expansion of identical callback bindings through
forwarding functions. The resolver now reuses parameter results at the same
depth, removes identical binding alternatives without losing uncertainty, and
resolves call sites in bounded batches. Its distinct operation facts match the
previous implementation on Groma and Backlog. OpenClaw's complete initial scan
took 2.70 seconds and its refresh took 2.97 seconds. During complete web startup,
sampled peak resident memory was 3.50 GiB across the CLI and compiler, with
3.05 GiB remaining in the CLI after startup. The router still allocates a
Cartesian coordinate grid; reducing that workspace remains open work.

Backlog's four relationships cover UI callbacks and configuration-change
notifications. They do not describe its complete architecture. OpenClaw's
results include supplied reply, message, reload, and channel callbacks. Direct
service calls, injected class receivers, and protocol interactions remain
outside the current rule. These counts establish coverage of that rule, not
architectural completeness or a precision score.
