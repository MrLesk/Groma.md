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

Ordinary relationships remain Core `GraphRelation` records with Core-owned stable
identity. The model only derives a read-only semantic view of their description and
namespaced extension data; relationships are never copied into component payloads.

Unknown extension keys use a namespace separator, for example `acme.io/owner` or
`acme:owner`. They are preserved as canonical Core graph data through normalization,
parsing, sparse patches, and serialization. Unknown unnamespaced keys are rejected so
future standard fields cannot silently change meaning.
