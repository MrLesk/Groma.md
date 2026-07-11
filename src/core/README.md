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

Aliases are intentionally not persisted here. The Iteration 1B Alias Store will add
continuity resolution without changing exact graph identity.
