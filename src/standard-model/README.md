# Standard Model

The official minimal blueprint model is an explicit capability over Core. Every
architectural component is a Core entity of kind `component`; its payload may contain
`name`, optional recognition metadata (`label`, `summary`, and `iconDomain`), an open
`type`, one optional structural `parent`, `intent`, stable-ID
`inputs`, `outputs`, and `actions`, plus open `lifecycle` and `desired` tokens.
Omitted fields stay omitted, so sparse scanner and user contributions remain valid.
Sparse patches preserve omitted fields; `null` clears a known optional field while
extension values (including `null`) remain ordinary canonical graph data.

Recognition metadata stays deliberately small. `label` is a trimmed, non-empty,
control-free single-line value of at most 80 Unicode code points. `summary` uses the
same canonical line rules with a 280-code-point limit; “one sentence” is an authoring
constraint, not language-specific punctuation parsing. The limits count Unicode code
points rather than UTF-16 code units or grapheme clusters. Emoji, ZWJ sequences, and
ordinary interior spaces remain valid; C0 controls (`U+0000`–`U+001F`), C1 controls
(`U+007F`–`U+009F`), lone surrogate halves, and Unicode line or paragraph separators
are rejected. Inputs outside these constraints are rejected, not trimmed or rewritten.
A projection node representing one component uses `label`, then `name`, then the stable
component ID as its display text. This fallback is exposed by
`standardComponentDisplayText` and does not create a canonical node entity.

`iconDomain` is a lowercase ASCII DNS hostname with at least two labels, no trailing
dot, at most 253 characters and 63 characters per label. DNS labels may use letters,
digits, and interior hyphens, so canonical punycode labels remain valid; IP-shaped
values made of two to four decimal or `0x` IPv4-number labels and any scheme,
credentials, port, path, query, fragment, or whitespace are rejected. A `0x` number
label denotes zero when bare or a hexadecimal value when followed by hexadecimal digits. Ordinary domains may still
use numeric or `0x`-looking labels when the complete hostname is not an IPv4 number
shape. The value is only a recognition hint. It never affects stable
identity, evidence matching, trust, or network access, and the Standard Model provides
no favicon fetcher or icon-resolution capability.

The `type` token remains open. `external` is a conventional value for an
architecturally relevant system outside the blueprint's ownership, not an enum member
or special entity kind. Layout coordinates, colors, themes, folds, zoom state, and
other renderer choices are not Standard Model fields.

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
envelope paths, safe model field paths, stable IDs when available, and length/type
metadata instead of copying untrusted oversized identifiers, tokens, kinds, or
extension keys. Final parent, cycle, and relationship checks run in stable identity
order; a containment cycle is represented by its smallest stable ID.

Pinned component IDs are validated, sorted, unique, and resolvable in the prior or
proposed graph in 1A, but do not yet change mutation authority. Evidence ownership
and pinned-boundary protection policy begin with reconciliation; retaining this
context now lets that policy use the same transaction path later without adding
scanner behavior to the model.
