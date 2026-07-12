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
