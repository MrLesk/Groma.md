# Scanner evidence for relationship inference

This page defines the semantics of the first operation evidence contract and
separates it from later proposed evidence. Implementations use the [scanner authoring guide](creating-a-plugin.md) and
[`@groma/scanner`](../../packages/scanner/src/index.ts). Introduce further exchange fields only as a reviewed example establishes
their need.

The accepted direction is that scanners produce temporary source facts and
core derives architecture relationships. The selection policy belongs in
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

## Vocabulary and introduction order

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
- **Protocol endpoints:** sending or receiving role, application/address
  identity, protocol, method or operation, and route or channel facts.
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
enabled scanner failing to complete: all scanners must succeed before
reconciliation starts. Repeat scans preserve authored relationships and
curated file membership in either observer order. Source offsets, provider
sets, and conflict details stay in memory; they are not new OKF fields or C4
elements. Ordinary Markdown readers retain the existing Code links and
authored relationship meaning. The independent
[composition fixture](../../test/fixtures/scanner-composition/) exercises this
contract; framework extraction has its own scanner fixture.

## Completion, precision, and uncertainty

The current observation's `complete: true` means the scanner successfully
produced its complete declared observation for reconciliation. It is not a
claim that every possible runtime call has been identified.

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
