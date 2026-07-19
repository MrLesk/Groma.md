# Persistence

Persistence implements Groma's local adapters:

- portable bounded workspace resources with path containment and atomic replacement;
- readable deterministic Markdown intent documents;
- stable-ID alias records;
- an atomic local canonical transaction provider and recovery journal;
- an in-memory disposable projection read model.

Canonical Markdown is the user-owned source of truth. Stable IDs determine durable locations while
names, paths, containment, and renderer layout may change. Scanner observations never write directly
to canonical intent.

The transaction journal exists narrowly to make a prepared multi-resource canonical mutation atomic
and recoverable. It does not provide durable scanner sessions, projection checkpoints, or generalized
workflow durability.

The projection index rebuilds from one bounded canonical snapshot. It derives deterministic exact,
catalog, search, relation, and adjacency reads plus a content fingerprint. It has no persistent
chunks, Merkle proofs, repair mode, adoption protocol, or canonical authority.

Schema migrations and evidence sharding are absent until real incompatible data or measured scale
requires them. Unsupported schemas and ambiguous state fail closed rather than being guessed.
