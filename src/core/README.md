# Core Graph Kernel

The graph kernel is model-neutral. Entity kinds and relation types are validated
tokens supplied by model plugins; Core does not hard-code groups, components, or any
other standard-model vocabulary.

## Finite observation sessions

`ObservationSession` is Core's technology-neutral boundary between a blind scanner and
later reconciliation. Its exact API generation is `groma.observation/v1`. A Host begins
one session by binding an immutable project ID, versioned source identity, epoch, and a
finite set of source-resource scopes. Observation identity is only the tuple
`(source, scope, key)`. Keys that use canonical `ent_` or `rel_` forms are rejected;
scanners never choose canonical identities, aliases, or bindings.

A bounded atomic batch may contribute any sparse subset of component candidates,
inputs, outputs, actions, relationships, and raw documentation. A candidate may report
only existence, key, and provenance. Component members likewise need not invent a name
or description. Candidate metadata is bounded observed source text, not a prevalidated
canonical Standard Model payload; reconciliation and model policy decide whether and
how it becomes canonical component metadata. Scoped references may be forward or
unresolved because a scanner's contribution is partial evidence, not a complete graph.
Every record has nonempty
fingerprinted resource provenance whose explicit scope matches the record and whose
project-relative resource remains inside that scope's declared resource root.
Optional provenance ranges use zero-based half-open byte offsets into the exact bytes
named by that fingerprint; they are never character, UTF-16, or line positions.

Exact replays are idempotent. Reusing one scoped key for different canonical evidence
is a contradiction, including when the conflicting records occur in one batch. A
rejected batch changes no record, batch, sequence, signal, or retained-character count.
Accepted records are defensively copied and frozen; completed records, coverage, scopes,
and provenance use locale-independent deterministic ordering.

Sessions are finite in records, batches, signals, provenance entries, canonical
characters, and all public string categories. Descriptor-only inspection reads only
known fields and dense numeric array entries, so caller-owned accessors, proxies, extra
keys, and key enumeration cannot become a second semantic path. Unknown fields never
survive the owned canonical copy. Configured limits are also inspected as data
descriptors rather than invoked through getters.
`maxCanonicalCharacters` is the single authoritative canonical-character limit for an
individual record and for all retained records cumulatively; Core does not derive a
smaller hidden record ceiling from the individual text, token, or provenance bounds.

Every accepted transition also has a compact, immutable
`groma.observation-checkpoint/v1` representation owned by Core. A checkpoint records the
exact resolved bounds and canonical begin descriptor, followed by accepted transitions
in signal order. A batch transition retains only records that were newly accepted by
that call; exact replays and accepted empty batches remain as empty transitions so batch,
signal, and sequence accounting can be reconstructed without storing duplicate evidence.
Rejected calls do not change the checkpoint. Checkpoint capture uses only Core-owned
copies produced during the original call and never returns to a caller batch, signal, or
record after acceptance.

Restoration treats the checkpoint as hostile input. Each hostile container is captured
once into bounded, frozen canonical graph data; replay never returns to caller-owned
descriptors or proxies. The envelope and transition variants have exact data-only
shapes, while the ordinary begin, batch, heartbeat, completion, failure, cancellation,
and expiry methods remain the single validators of nested meaning. Restoration never
assigns live session state or trusts persisted counters. It requires the replayed
checkpoint to equal the captured canonical checkpoint exactly, so normalized coverage,
duplicate or previously accepted batch records, mixed replay/new batches, and nested
extra data all fail restoration. Capture character, value-count, and depth budgets are
derived from the checkpoint's resolved bounded profile before begin or transition data
is copied. The resulting inspection and completed snapshot are the same deterministic
Core values as the uninterrupted session. The checkpoint is technology-neutral recovery
evidence: it contains no file locator, journal phase, handoff token, clock, process
identity, canonical blueprint ID, reconciliation result, or presentation state.

The lifecycle is one-way: active sessions accept advancing batches and heartbeats, then
complete, fail, cancel, or expire exactly once. Core never reads a wall clock. Expiry is
an explicit Host decision naming the last heartbeat the Host observed. A final bounded
signal is always reserved for termination. Every later signal receives the stable
`observation-session-terminal` diagnostic before its body is inspected.

Only successful completion creates an evidence snapshot. Completion reports exactly
one `partial` or `complete` coverage entry for every declared scope, including a valid
zero-record scan. Coverage is the scanner's declaration of which record kinds it
inspected in that scope; it does not claim that a record of every listed kind was
emitted. Missing emitted records become evidence of absence only through successful
completion and later reconciliation semantics, never from the coverage list alone.
Failed, cancelled, expired, and still-active sessions return
`observation-session-incomplete`; they never turn missing contributions into evidence
of absence. A bounded source-owned failure reason remains available in session
inspection without leaking arbitrary thrown values.

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

Core accepts a bounded alias table when loading a snapshot. Each sorted record maps one
obsolete entity ID to one later ID; chains must be acyclic and end at exactly one live
entity. A source cannot also be live or occur twice. Exact entity reads, traversal, and
loaded relationship endpoints resolve through this one table, while the survivor's
identity never changes. Core owns these identity invariants but not their storage format;
the official persistence plugin supplies the canonical alias records.

## Query and event contracts

Shared operation and provider boundaries use branded, nonnegative safe graph
generations. Exact reads and bounded pages always identify the generation they came
from. The graph kernel's raw stable-ID pages remain in-process primitives; a surface
or provider uses `BoundedQueryContracts` when a page can cross an operation or process
boundary.

`ProjectionReadCapability` is the smaller storage-neutral partial-index boundary. It
exposes one exact generation/fingerprint identity, exact entity-or-alias reads, exact
live catalog-entry evidence, one bounded ordered batch of known live entities, bounded
stable-ID catalog pages, and bounded per-entity directional relationship pages. It
never exposes a whole projection snapshot. Every data-bearing read echoes the exact
generation/fingerprint identity it served, so a replacement consumer can reject provider
drift before stamping a public result. Core's continuity checkpoint also binds the
current partial-read integrity root to the canonical generation/fingerprint without
making storage proofs part of graph meaning; the paired bounded resource count prevents
the same root proof from being reinterpreted with another tree shape.
Hosts publish this partial-read contract independently from the complete
`ProjectionIndexCapability`; the official Host uses `groma.projection-read/v1` and
`groma.projection-index/v1` respectively, so a query consumer cannot mistake an
index-only provider for a bounded-read provider.
`GraphQueryEngineCapability` builds the public exact, filtered, full-text, and bounded
traversal shapes on those reads and the cursor contracts. A caller first captures one
`ProjectionReadIdentity` through `identity()`, then supplies that exact generation and
fingerprint to every data-bearing query in the logical read. The capability also exposes
one immutable construction-captured `maxPageSize`, so callers can bound internal paging
without learning provider storage details. Query engines never choose a newer identity
inside a data-bearing call: every partial provider read is served under the caller's
selected identity or fails closed. Traversal results describe one discovered relation,
its orientation, the originating entity, reached entity, and breadth-first depth. Core
knows neither an index encoding nor a database API; replaceable providers implement
partial reads while the shared engine owns query semantics.

Every bounded collection or traversal request supplies a positive safe limit no
greater than the configured maximum. Providers remain responsible for executing a
query and returning items in its declared deterministic order. Core canonicalizes the
complete query context and deterministic continuation anchor as `GraphData`, validates
explicit context, anchor, and cursor character budgets, and returns a branded opaque
cursor. The cursor is self-contained so a later short-lived CLI process can continue
the page. It is opaque as an API boundary, not encrypted or secret: callers must not
interpret it, and providers must still treat it as untrusted input.
Generation mismatch takes precedence over query mismatch when both changed; a changed
generation therefore always produces `stale-cursor`, while a wrong query at the same
generation produces `cursor-query-mismatch`.

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
Projection-backed providers include the bounded canonical-content fingerprint in that
query context, so a cursor cannot resume across a same-generation branch or checkout
whose canonical meaning differs. Deterministically recomputed result sets require the
decoded anchor to occur exactly once; absence or duplication returns
`cursor-anchor-mismatch` instead of skipping or restarting a page.
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

Core's projection contract is likewise technology-neutral. A canonical source yields
entities, relationships, aliases, and one exact graph generation; a replaceable index
capability can load the current disposable view, rebuild it, or consume one committed
event. Each view carries a bounded provider-defined canonical-content fingerprint in
addition to its generation; Core prescribes neither a hashing algorithm nor a storage
encoding. The view contains derived searchable text and relation adjacency, but no file
locator, JSON schema, database primitive, layout coordinate, folding state, or theme.
Projection catalog providers keep searchable text within the configured
post-NFKC/lowercase bound; query engines repeat normalization at the replacement-provider
trust boundary instead of assuming the stored representation is already safe.
Missing generations are handled by the event sequencer and require reconstruction;
projection state never participates in a canonical transaction.

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

## Schema migration contracts

Core exposes only the technology-neutral `groma.schema-migration/v1` contribution shape:
bounded schema/version declarations and directed migrator callbacks over owned canonical
bytes. It does not discover resources, choose paths, invoke callbacks, or publish writes.
Those remain Application and provider responsibilities, while plugin delivery uses the
ordinary runtime capability graph through the stable
`canonicalSchemaMigratorCapabilityId` (`groma.schema-migrators/v1`).
