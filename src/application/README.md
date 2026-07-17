# Application Operations

Presentation-neutral semantic operations shared by CLI, service, and web surfaces.
Operations depend on capabilities and never call storage implementations directly.

`createApplicationOperations` is the shared entry point. Its read surface provides
atomic workspace initialization, exact canonical component reads with bounded outgoing
relationships, deterministic bounded pages for all components, roots, and direct
children, plus projection-backed blueprint export, search, and directional traversal.
Every page is bound to a graph generation and query context through Core's opaque
continuation cursor contract.

Application code sees stable component identities and content revisions, but never a
canonical resource locator. A host injects the transaction snapshot, transaction
execution, resource-mapping, graph, bounded-query, graph-query, Standard Model, and
workspace-initializer capabilities. Canonical page reads confirm resource revisions in a second snapshot and retry a
configured number of times if the generation changes; empty canonical state remains a
valid empty graph because bootstrap representation belongs to the host.

`exportBlueprint`, `searchBlueprint`, and `traverseBlueprint` consume only the injected
`groma.graph-query/v2` capability. Application captures its receiver, methods, and
immutable public page bound once,
settles and contains each untrusted result, retains only allowlisted diagnostics with
application-owned messages, validates page and traversal invariants, and canonicalizes
every entity and relation through the same snapshot-state decoder used by canonical
reads. Each logical operation captures exactly one frozen generation/fingerprint
identity and supplies it explicitly to every data-bearing query. The fingerprint remains
an internal continuity proof and never enters the public Application result. The
component page's generation, `hasMore`, and opaque cursor are preserved
exactly; Application does not wrap them in another cursor or open a canonical snapshot
to answer the projection-backed read.

Every `exportBlueprint` item contains one canonical component plus every canonical
outgoing depth-1 relationship whose source is that component. Application gathers the
required traversal pages sequentially inside the same export operation, requires every
internal page to match the component page generation, rejects duplicate or non-advancing
relationship pages, and caps the page-wide relationship aggregate at the configured
relationship bound. Each internal relationship request uses the smaller of the query
engine's immutable page bound and the remaining relationship budget; it is independent
of the caller's component-page limit. One incremental structural-value budget also
covers the complete export page across its components and accumulated relationships. The
internal traversal cursor never escapes. A complete current blueprint therefore requires
only paging `exportBlueprint` through its fingerprint-bound component cursor; a stale
generation or same-generation projection mismatch requires restarting the export. Public
search and traversal remain independent one-page exploration operations and never follow
their surface cursors implicitly.

Every final export, search, and traversal page also crosses the provider-neutral
`maxBlueprintPageBytes` and `maxBlueprintPageDepth` bounds before Application returns
success. A descriptor-based counter measures exact canonical-JSON UTF-8 bytes and depth
without invoking getters, iterators, `toJSON`, or prototype behavior and without
constructing a second serialized page. These bounds apply only to the final owned result;
export's internal traversal pages remain governed by the query engine and export
aggregate checks.

Proven page-wide relationship, structural-value, UTF-8 byte, or canonical-JSON depth
exhaustion returns an application-owned semantic diagnostic with the exhausted bound and
maximum. Export uses `blueprint-export-page-bound-exceeded`; search and traversal use
`blueprint-search-page-bound-exceeded` and `blueprint-traverse-page-bound-exceeded` for
their byte or depth bounds. Callers can retry with a smaller page limit. Failure at limit
one means one self-contained export item, search component, or traversal hit exceeds the
local page bound. Ordering, duplicate, malformed, proxy, detector, provider, and other
invalid-query failures remain `graph-query-unavailable` and never receive capacity retry
guidance.

For `invalid-search-text`, Application replaces provider wording with its stable message and
accepts either no details for a generic invalid search or one exact typed detail shape: a
positive safe-integer `maximumCharacters` or `maximumTerms`. Present details with extra keys,
accessors, proxies, non-integers, or other malformed values fail closed as
`graph-query-unavailable`; other allowlisted graph-query diagnostics retain their existing
bounded detail handling.

`invalid-traversal-depth` follows the same optional-enrichment rule: omitted or explicit-
undefined details remain semantic, while one exact positive safe-integer `maximumDepth` is
copied and frozen. Any other present traversal-depth detail shape fails closed as
`graph-query-unavailable`. Application retains its provider-neutral `maxComponents` request
guard and does not import or duplicate the Persistence engine bound.

Projection-backed component and export pages are ordered by ascending stable component
identity. Traversal pages preserve deterministic breadth-first depth and then stable
relationship identity. Application validates that order rather than introducing a
second presentation-specific ordering rule.

`createApplicationSnapshotStateDecoder` is the single application-boundary decoder for
provider snapshot state. `ApplicationOperationsOptions` requires that explicit
capability, and every read reuses the injected instance. Operations accept only the
frozen decoder object returned by that factory; forged, wrapped, and proxied lookalikes
are rejected during construction before provider access. Decoder provenance registration
is private to the factory module; consumers can read compatibility metadata but cannot
brand another object.

Its GraphKernel and Standard Model identities and its component, diagnostic,
embedded-item, relationship, snapshot-depth, and snapshot-value bounds must exactly
match the application composition. The decoder owns its immutable runtime proxy-detection
policy. Construction requires an explicit callable detector; compositions that
deliberately do not recognize proxies must still inject that policy, while malformed
construction values and detector faults fail closed. The default host shares that exact
proxy-aware instance with application reads and startup recovery, so bounded copying,
GraphKernel loading, Standard Model parsing, relationship endpoints, duplicates, and
containment invariants cannot drift. Its deterministic Standard Model invariant is
constructed once with the decoder rather than per read. Decoder results are
exact-inspected and copied inside one exception boundary. Diagnostic arrays, records, and
details are copied only from bounded own data descriptors, and unexpected decoder faults
or malformed results become one frozen `application-snapshot-decode-failed` diagnostic
without retaining error data. Construction also snapshots and freezes every injected
capability reference, scalar, and bound, so later caller mutation cannot change an
operation instance's composition.

The same factory-owned decoder boundary owns every Standard Model call used by
mutations: normalization, patching, parsing, and relationship viewing. It copies model
inputs before invocation, captures each method with its original receiver during decoder
construction, contains thrown, malformed, and native-Promise results, applies decoder-owned
proxy detection before reflection, and copies complete model outputs under the snapshot
depth and value bounds. Later mutation of the Standard Model object cannot redirect an
existing decoder. Normalization binds both the expected presence and value of a
caller-supplied identity before graph, provider, resource-mapping, or execution work;
patching binds the target identity and canonicalizes the full merged entity through the
same parse boundary. Only frozen application-owned drafts, entities, canonical components,
and canonical relationships escape. Relationship inputs are copied and deeply frozen
before model viewing, and transaction upserts are rebuilt only from the decoder-returned
canonical relationship, so model mutation cannot alter the executed payload. Every
decoder method also limits failure diagnostics to the configured application count;
oversized or malformed model diagnostics collapse to one stable generic failure. Create
and sparse-update operations do not call Standard Model capabilities directly.

Standard Model capability successes are also untrusted boundary values. The snapshot
decoder exact-inspects component, item, extension, and relationship records; binds their
identities, kinds, types, and endpoints back to the resolved graph; rejects proxies before
reflection; applies the embedded-item bound independently to each component across its
combined inputs, outputs, and actions. The complete raw snapshot and final canonical
model-success envelope each cross the configured aggregate structural copy budget.
Model-success structural preflight additionally uses one shared value counter across every
component, item, and relationship in a full decode, so no nested extension can obtain a
fresh budget from its containing item or component. Each mutation canonicalization
boundary starts with its own fresh counter. Nested component, item, and relationship
extension values are copied immediately after that preflight, before payload equality
checks or any later model capability call can mutate a retained alias. It then uses Core's
graph-data copier to create the only values that may escape, with every nested array, item,
extension, component, and relationship application-owned and frozen.
Malformed native-Promise model outputs are observed with module-captured Promise and
reflection intrinsics. Observation temporarily shadows and then exactly restores a safe
own constructor descriptor using a private frozen species carrier, so hostile own or
inherited `then`, `constructor`, and subclass species accessors cannot leak late
rejections. A fixed own constructor pointing at the captured Promise is observed only
while its species descriptor still exactly matches the module-initial intrinsic;
other non-shadowable constructors fail closed. Native Promises nested in inspected model
records, items, and extension graphs are observed during those existing bounded validation
passes, without adding a separate per-model structural traversal.

The injected initializer is responsible for atomically establishing that minimal
canonical workspace, recognizing compatible prior initialization, and preserving any
conflicting existing state without overwrite.

Mutations use the same injected transaction execution capability. Component creation
supports supplied or minted identities and outgoing ordinary relationships; updates
are sparse and may explicitly upsert or remove only relationships owned by their
source component. Reparenting is a separate operation, and removal fails closed until
children and every incident relationship have been handled explicitly. Mutation
outcomes retain semantic generations, affected stable identities, and component
revisions while omitting transaction resource keys and provider recovery secrets.
Updates, reparenting, and removal require the caller's current component revision;
stale revisions return an explicit conflict without guessing or overwriting. All
validation and transaction diagnostics are copied into presentation-neutral outcomes
with canonical resource details removed. Capability-supplied diagnostic codes are
exposed only when they are bounded lowercase kebab-case tokens; unsafe codes are
replaced with application-owned category codes.

`mergeComponent` is the only component operation that creates an alias. It requires the
obsolete component's current revision, resolves the requested survivor to its final live
identity, leaves that survivor's component content and ID unchanged, and submits obsolete
removal, outgoing-relationship re-homing, and alias publication through one transaction.
Reads by any obsolete ID return the live survivor and its revision; component parents and
relationship endpoints use the same deterministic chain resolution. Self, missing,
cyclic, already-superseded, and otherwise ambiguous requests are rejected before
execution. New and explicitly reparented components serialize a supplied obsolete parent
as its live identity, and merge re-homing does the same for relationship endpoints in the
touched survivor document. A survivor referenced by an alias must be merged onward rather
than removed directly. Ordinary update and reparent operations never manufacture
continuity records.

Resource mapping is also a containment boundary: mapper failures become one generic
component-scoped diagnostic, and mapper messages, details, locators, and keys never
reach application callers.

Initializer, snapshot-provider, transaction-executor, bounded-query, and mapper return
values cross one application-owned containment boundary before semantic inspection. It
uses the validated snapshot decoder's exact proxy policy before every nested reflection,
accepts only intrinsic dense arrays and plain records made entirely of enumerable data
properties, applies the configured structural and collection bounds, and produces deeply
frozen owned copies. Genuine native Promise returns are observed through captured
intrinsics, then the decoder proxy policy is applied again to the fulfilled value before
containment or reflection; plain thenables and result-shaped values with `then` accessors
are inspected synchronously and rejected without reading or awaiting `then`.
Capability methods and their receivers are captured during construction, so later mutation
cannot redirect an operation instance. Query failures retain only bounded codes,
allowlisted details, and application-owned messages; successful pages and exact reads are
accepted only when generation and semantic items match the application-owned inputs, then
reconstructed with validated cursor metadata.

The query capability is Core's concrete `BoundedQueryContracts`: application construction
rejects recognized proxies and receivers without its genuine private brand. Core captures
the exact `prepare`, `page`, and `exact` methods when its query module initializes and
exposes narrow direct-module invocation bindings to Application without adding them to the
public Core barrel. The bindings apply those captured methods to the explicitly injected
receiver, preserving its configured private bounds while bypassing later prototype,
instance, or subclass overrides. Cursor generation and validation therefore share one
independent Core authority rather than trusting query methods to self-attest one another.

Canonical Standard Model component and relationship views are also bound back to their
copied graph payloads. Every component field, embedded item, namespaced extension,
relationship description, and relationship extension must have exactly the same presence
and deep canonical value; object key order is irrelevant. A model cannot substitute
semantic meaning and still receive canonical provenance or reach transaction execution.
This includes optional `label`, `summary`, and `iconDomain` recognition metadata: all
three travel through the same create, sparse-update, exact-read, and paged-read path as
the rest of the canonical component, while renderer state remains outside application
mutations.

Each composition supplies explicit application bounds for component and relationship
state, relationship mutations, embedded items, diagnostics, request-data structural
depth and values, snapshot structural depth and values, and final blueprint-page
canonical-JSON UTF-8 bytes and depth. Create and update mutation data—including component
items and extensions plus outgoing relationship descriptions and extensions—is copied
within one total request budget before model, identity, graph, provider, or transaction
work. `maxEmbeddedItems`
limits each component's combined inputs, outputs, and actions on both writes and reads;
`maxSnapshotStateValues` remains the aggregate whole-snapshot structural bound, while
`maxBlueprintPageBytes` and `maxBlueprintPageDepth` are independent of provider storage
technology and canonical state. Sparse updates retain the early raw-patch
preflight before provider access and validate the final model-merged component again
before relationship planning or transaction execution, so omitted arrays cannot bypass
the combined per-component bound. Construction also enforces absolute ceilings
(including snapshot retry count), so hostile arrays and payloads fail before unbounded
copying, identity minting, graph loading, or transaction execution.

Auto-generated component IDs are minted against the validated current graph, and
committed outcomes are accepted only when their affected identity sets exactly match the
submitted transaction.

## Explicit schema migration

`createSchemaMigrationOperations` is the shared status, preview, and apply surface. It
canonicalizes runtime plugin contributions, reports every resource's exact schema/version
and unique bounded path, and derives floor/mixed/completeness without invoking migrators.
Preview invokes the selected transforms twice over fresh byte copies and writes nothing.
Apply rebuilds that plan, requires deterministic bytes whose declared target schema can be
re-inspected, and submits every catalog resource/revision as one transaction read/write
set. Path expansion, individual outputs, and retained aggregate bytes have independent
bounds; exhaustion fails closed before callbacks or transaction preparation can grow work
without limit. Transient catalog provider failures retain the transaction surface's
provider-failure classification, while path and migrator defects remain semantic
validation rejection. Component operations never call this capability implicitly.
