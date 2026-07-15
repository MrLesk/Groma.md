# Core Graph Kernel

The graph kernel is model-neutral. Entity kinds and relation types are validated
tokens supplied by model plugins; Core does not hard-code groups, components, or any
other standard-model vocabulary.

## Phased plugin runtime

`PluginRuntime` is Core's technology-neutral composition and lifecycle service. It
accepts bounded, exact plugin registrations, resolves Phase 0 and Phase 1 into one
immutable graph, and only then invokes plugin start callbacks. Core knows nothing about
filesystems, configuration formats, package acquisition, module loading, process
signals, or surfaces; a host constructs registrations and adapts its own cancellation
mechanism to the small `PluginCancellation` contract.

The first runtime API is deliberately narrow:

- the exact API token is `groma.plugin/v1`;
- plugin and capability versions use exact `major.minor.patch` values;
- capability IDs carry their contract generation, such as `groma.graph/v1`;
- a requirement matches only an identical capability ID and identical capability
  version—there is no semver range solver;
- every capability declares `single` or `multiple` provider cardinality, and the
  requirement must agree with its providers.

`single` reserves one system-wide provider role for a capability ID across all exact
versions. Registering two providers for that ID is therefore a collision even when their
versions differ; this version-blind collision is intentional. Once the sole role is
unambiguous, exact version matching verifies that a requirement targets precisely the
contract version that provider implements.

This keeps incompatibility diagnostics deterministic while the contract is still
small. A Phase 0 plugin may depend only on Phase 0 providers. A Phase 1 plugin may
depend on either phase. Independent Phase 0 plugins start before independent Phase 1
plugins, and ties use plugin ID order. Requirements on a `multiple` capability receive
every exact-version provider in plugin ID order. Missing providers, exact-version
mismatches, cardinality disagreement, single-provider collisions, phase inversion,
duplicate plugins, and dependency cycles all fail resolution before any plugin starts.
Every runtime ordering uses locale-independent Unicode code-unit comparison. If an ID is
registered more than once, every registration with that ID is excluded from the candidate
graph; registration order can never choose a first winner or leak one duplicate's
capabilities into dependency resolution.

The internal bootstrap path may start the resolved Phase 0 prefix with
`startPhaseZero()`, inspect its explicit capabilities, resolve a later graph whose Phase
1 membership came from Host configuration, and continue it exactly once. Continuation
requires the exact same Phase 0 registration objects and manifests, so configuration
cannot swap a provider that has already executed. The staged prefix owns its providers:
failure before continuation shuts them down, a Phase 1 startup failure rolls every
started plugin back in dependency order, and successful continuation transfers their
lifecycle into the complete running graph. This is a reusable internal Core primitive,
not the supported third-party API; its staged handle is nominally distinct from a
complete running graph. The public SDK owns third-party authoring ergonomics.

The supported authoring façade is now `groma/plugin-sdk`. It exposes manifest,
capability, and lifecycle contracts without staged continuation. Reusable verification
lives only at `groma/plugin-sdk/conformance`; Core retains the Host-only bootstrap
primitive.

Start contexts expose only the resolved requirement values and the technology-neutral
cancellation check. Start results must return every declared capability exactly once;
opaque capability values retain their identity. Resolved and running graph inspection
is copied and frozen and contains only manifests, dependencies, phases, lifecycle
states, and provider IDs—not layout or host configuration.
The resolved graph is a reusable immutable template rather than a running singleton.
Each `start()` call creates an independent running graph with its own callback results,
capability values, lifecycle state, and cleanup traversal.

Start proceeds in dependency order. A thrown, rejected, or malformed start rolls back
already-started plugins in reverse order. Normal shutdown and cancellation use the
same dependent-before-provider ordering, cache one cleanup Promise, and invoke every
plugin cleanup at most once even if callers repeat or race lifecycle requests. Cleanup
reserves that Promise and its first requested mode before invoking any callback, so a
reentrant lifecycle request observes the same traversal and cannot replace its reason.
Cleanup continues after a stop failure and reports stable plugin-owned diagnostics without
leaking thrown values. Promise-returning lifecycle callbacks cross the same native
Promise containment used by the application and Host boundaries.

Entity and relation IDs contain 128 opaque entropy bits. Core formats and validates
IDs while an injected capability supplies entropy, keeping crypto and host technology
outside Core. Names and paths belong only in model payloads.

Graph mutations return new opaque snapshots. Reads are either exact stable-ID
resolution or explicitly bounded entity, relation, and traversal pages. Duplicate
identities are rejected while loading, so an ambiguous graph never becomes readable.

Payloads are canonical graph data: `null`, booleans, finite numbers, strings, arrays,
and plain string-keyed records recursively containing only those values. Core copies,
key-orders, and deeply freezes payloads before they enter a snapshot. Cycles, sparse
or extended arrays, accessors, symbol properties, class instances, custom prototypes,
non-finite numbers, `undefined`, bigints, symbols, and functions are rejected with an
`unsupported-payload` diagnostic. This JSON-compatible contract keeps semantic data
portable across hosts and canonical persistence providers without admitting mutable
caller aliases or behavior-bearing objects.

Aliases are intentionally not persisted here. The Iteration 1B Alias Store will add
continuity resolution without changing exact graph identity.

## Query and event contracts

Shared operation and provider boundaries use branded, nonnegative safe graph
generations. Exact reads and bounded pages always identify the generation they came
from. The graph kernel's raw stable-ID pages remain in-process primitives; a surface
or provider uses `BoundedQueryContracts` when a page can cross an operation or process
boundary.

Every bounded collection or traversal request supplies a positive safe limit no
greater than the configured maximum. Providers remain responsible for executing a
query and returning items in its declared deterministic order. Core canonicalizes the
complete query context and deterministic continuation anchor as `GraphData`, validates
explicit context, anchor, and cursor character budgets, and returns a branded opaque
cursor. The cursor is self-contained so a later short-lived CLI process can continue
the page. It is opaque as an API boundary, not encrypted or secret: callers must not
interpret it, and providers must still treat it as untrusted input.

Canonical JSON is emitted directly from descriptors during the same traversal that
copies and freezes query data. Character budgets reduce recursively for punctuation,
sorted keys, and values, so copying stops before inspecting later data once the bound
is exceeded. The serializer never consults object or array `toJSON` hooks—including
polluted inherited hooks—and page length is preflighted before any item is traversed.
The shared payload walker has a separate copy-only mode for graph and model data; it
performs the same validation and freezing without constructing or discarding JSON.
Array minimum sizes and cursor envelope sizes are checked before key enumeration or
percent encoding when the result cannot fit. The exact encoded cursor length remains
the final authority because Unicode and reserved JSON punctuation expand during
encoding.

Exact-read items and page items also cross this boundary as canonical `GraphData`.
Core defensively copies and deeply freezes them, normalizes negative zero to zero, and
rejects accessors, `toJSON` hooks, custom collections, iterable or length spoofs, and
other behavior-bearing values. Requests, prepared query values, page state, events,
and affected-identity arrays are descriptor-validated at runtime even when their
TypeScript types were forged. The public success types preserve useful record and
array shapes while exposing every accepted item as recursively readonly canonical
query data. Structurally data-only interfaces such as Core's `GraphEntity` and
`GraphRelation` are accepted without requiring an artificial string index signature,
while mutable results, callable objects, behavior-bearing fields, and noncanonical
primitive fields are rejected at compile time. Sparse typed records may use optional
canonical fields; explicit `undefined` in either required or optional field types is
still noncanonical.

Cursors carry their format version, graph generation, canonical query context, and
continuation anchor. Decoding is fail-closed and rejects malformed or unsupported
formats, noncanonical percent encoding, changed query context, and stale generations.
URI encoding and decoding use captured intrinsics, so later global mutation cannot
alter accepted envelopes. Prefix checking and suffix extraction likewise use captured
string intrinsics. After decoding, Core reconstructs the complete canonical state and
requires byte-for-byte equality, rejecting whitespace, reordered keys, alternate
number forms, and duplicate JSON keys. Completed pages—including a page
whose item count exactly equals its limit—have no cursor unless the provider explicitly
knows that more results exist. A continued page cannot issue a cursor with an anchor
canonically equal to its previous anchor; providers must advance or return an explicit
failure instead of creating an infinite continuation loop. Invalid page state and
invalid continuation anchors are rejected before item contents are traversed.

`graph.committed` events contain only the resulting generation and sorted,
deduplicated stable entity and relation identities. Event consumers accept exactly
the next generation. A missed, duplicate, or reversed event yields an explicit
`refetch-required` result; consumers never infer changes across a generation gap.
Forged events whose affected arrays are valid but unsorted or duplicated are rejected
rather than normalized during consumption.
Provider-specific storage, projection, or transport details do not enter these
contracts.

## Transaction contracts

`TransactionEngine` is the single Core coordination path for semantic writes. A
request carries one canonical mutation, expected content revisions (including
explicit expected absence), affected graph identities, and technology-neutral
context such as ownership. The provider supplies a consistent prior semantic state,
current revisions, and base graph generation. Core copies and deeply freezes all of
those values into one complete proposal.

The engine requires explicit positive structural limits for total affected
identities, request data depth and value occurrences, and provider snapshot-state
depth and value occurrences. Context and mutation share one request counter, while
snapshot state has an independently configurable counter so hosts can size it for
representative projects. Every scalar and container counts once per output path; a
shared input object reached through two paths therefore counts twice. Dense arrays
whose immediate children cannot fit are rejected from their length descriptor before
their keys or values are traversed. These limits bound defensive copying without
changing the unbounded-by-default graph/model payload helpers used elsewhere in Core.

Registered invariants run synchronously in deterministic registration order. Every
invariant receives the same proposal object, including prior state and ownership
context, and all diagnostics are aggregated before provider preparation begins. An
invariant cannot begin provider preparation or commit through the proposal, and a
failing or throwing invariant does not short-circuit later invariants. A provider's
`prepare` capability stages the complete proposal without changing canonical state
and must atomically recheck both the base generation and every expected revision.
This second check, rather than the preliminary snapshot alone, closes the
concurrent-writer window.

Commit results distinguish validation rejection, optimistic conflict, provider
failure known not to have committed, and an indeterminate result that requires
recovery. Once commit has begun, a throw, malformed provider response, or explicit
uncertainty is never interpreted as rollback. The serializable recovery receipt
contains only the provider's opaque preparation token and independently verifiable
generation/resource bounds. A committed recovery result supplies affected identities
from the provider's durable preparation evidence; caller-restored data cannot choose
the event contents.

Provider result variants are exact: `not-committed` and `indeterminate` carry only
their status, while `committed` carries its generation, resulting revisions, and
durably recorded affected identities. Fields from one variant cannot be combined
with another status.

Confirmed durable success advances exactly one generation and returns one canonical
`graph.committed` event value plus the resulting content revisions. Core publishes
the event in the committed outcome but does not dispatch it through a transport,
keeping transport failures outside the durability decision. Provider recovery is
idempotent and may classify repeated calls with the same committed result; the
application or durable journal settles that result and routes its single event once.
Filesystems, Markdown, journals, and surface concerns remain provider or application
responsibilities.
