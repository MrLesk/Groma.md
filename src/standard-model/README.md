# Standard Model

The official minimal blueprint model is an explicit capability over Core. Every
architectural node is a Core entity of kind `component`; its payload may contain
`name`, an open `type`, one optional structural `parent`, `intent`, stable-ID
`inputs`, `outputs`, and `actions`, plus open `lifecycle` and `desired` tokens.
Omitted fields stay omitted, so sparse scanner and user contributions remain valid.
Sparse patches preserve omitted fields; `null` clears a known optional field while
extension values (including `null`) remain ordinary canonical graph data.

A missing `parent` makes a component a root. The capability derives deterministic
direct-child views from a caller-provided, bounded entity collection. Parent
existence, single-parent transaction guarantees, and cycle prevention belong to the
separately registered model invariants rather than parsing or Core.
The bounded collection may be a heterogeneous Core page: non-component entities are
ignored, while malformed entities that claim the `component` kind are diagnosed.

Ordinary relationships remain Core `GraphRelation` records with Core-owned stable
identity. The model only derives a read-only semantic view of their description and
namespaced extension data; relationships are never copied into component payloads.

Unknown extension keys use a namespace separator, for example `acme.io/owner` or
`acme:owner`. They are preserved as canonical Core graph data through normalization,
parsing, sparse patches, and serialization. Unknown unnamespaced keys are rejected so
future standard fields cannot silently change meaning.

Parsed values expose extensions as nested read-only maps. Serialization validates
those public values before flattening extensions back into graph payloads, so an
extension cannot replace component identity or standard component and item fields.

`createStandardModelInvariant` is the single Standard Model transaction boundary for
direct callers and host surfaces. It receives exact, bounded records for the complete
prior component/relationship state, one complete mutation batch, and ownership plus
pinned conceptual-boundary context. It applies the whole batch before validating
parents, cycles, and relationship endpoints, which makes reparenting and coordinated
removal atomic while preserving omitted fields through the model's sparse patch.

The invariant factory requires explicit collection and owner-string bounds so a host
can align model work with its `TransactionEngine` request and snapshot budgets.
Every create, patch, remove, relationship upsert, and relationship remove target must
also appear in the Core transaction's matching `affected` identity collection. The
collection may contain additional identities for provider-owned side effects, and an
empty model batch may therefore still declare affected identities.

Invariant diagnostics preserve stable Standard Model codes while adapting unsafe
model prose to Core's exported transaction diagnostic limit. They expose bounded
envelope paths, stable IDs when available, and length/type metadata instead of
copying untrusted oversized identifiers, tokens, kinds, or extension keys. Final
parent, cycle, and relationship checks run in stable identity order; a containment
cycle is represented by its smallest stable ID.

Pinned component IDs are validated, sorted, unique, and resolvable in the prior or
proposed graph in 1A, but do not yet change mutation authority. Evidence ownership
and pinned-boundary protection policy begin with reconciliation; retaining this
context now lets that policy use the same transaction path later without adding
scanner behavior to the model.
