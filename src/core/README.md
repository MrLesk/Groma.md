# Core Graph Kernel

The graph kernel is model-neutral. Entity kinds and relation types are validated
tokens supplied by model plugins; Core does not hard-code groups, components, or any
other standard-model vocabulary.

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
alter accepted envelopes. After decoding, Core reconstructs the complete canonical
state and requires byte-for-byte equality, rejecting whitespace, reordered keys,
alternate number forms, and duplicate JSON keys. Completed pages—including a page
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
