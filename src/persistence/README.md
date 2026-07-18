# Persistence

Official local-resource and canonical persistence providers. Technology-specific
implementations satisfy capability contracts and never become authoritative outside
their canonical records.

## Markdown intent store

[`markdown-intent-store.ts`](markdown-intent-store.ts) is the read/codec boundary for
standard-model intent. It stores one component per canonical resource at
`groma/intent/<first-two-identity-hex>/<entity-id>.md`; rename and reparent operations
therefore never change the resource key. Each file owns only that component and its
outgoing relationships. Relationship sources are implicit, while stable relationship
IDs, types, targets, descriptions, and namespaced extensions remain explicit.

The `groma/v0.1` frontmatter contains structural metadata, optional `label`, `summary`,
and `iconDomain` recognition metadata, embedded inputs, outputs, actions, outgoing
relationships, and extensions. Existing documents omit those optional keys without a
schema migration. Supplied values use the Standard Model's strict bounded validation
and a fixed readable key order, while `iconDomain` remains inert text and never causes
network access. For intent-bearing documents, the
closing frontmatter delimiter is followed by one blank line, the exact `# Intent`
heading, another blank line, the reversible prose, and one framing newline. The codec
uses the injected Standard Model capability for every component and relationship
semantic view, canonicalizes ordering and LF framing, rejects unrepresentable Unicode,
aliases, tags, duplicate YAML keys, invalid UTF-8, complete conflict blocks, wrong
schemas and kinds, and hashes the exact UTF-8 bytes as a `sha256:` content revision. It
parses YAML integer lexemes as BigInt first, converts only values represented exactly
by a finite JavaScript number, and rejects inexact integers, non-finite overflow, or
nonzero underflow before Standard Model use. Finite YAML float and exponent scalars
retain the Standard Model's IEEE Number semantics. When serializing an integer-valued
finite Number outside the safe-integer range, the codec forces exponent notation so
its own canonical bytes parse as a float rather than an exact integer lexeme. The store
never writes timestamps, host paths, evidence, bindings, or derived state.

Complete column-zero Git conflict blocks are rejected symmetrically during serialization
and decoding; literal documentation must indent or quote its marker lines. Byte inputs,
including Node Buffers and Uint8Array subclasses, are copied through intrinsic typed-array
metadata and raw buffers without consulting subclass constructors or species. Returned
document bytes are always isolated plain Uint8Array copies, so mutations cannot invalidate
their recorded revision.

Provider-backed `read` and `load` operations are bounded. Whole-store loading follows
provider continuation pages, accepts only the exact shard/file layout, produces stable
document/entity/relation order, and diagnoses misplaced or duplicate identities,
missing parents or relationship targets, and containment cycles. In addition to
per-document and document-count ceilings, exact retained document bytes have a 128 MiB
default and 1 GiB absolute bound. A missing intent root is empty only on the first
enumeration request; disappearance during pagination is an inconsistent load. Non-final
pages must contain progress entries, and total pages cannot exceed the configured
document ceiling plus the 256 possible shard directories and one terminal page. This
API intentionally has no direct write or commit operation; GROM-14 owns transactionally
coordinated replacement.

## Alias store

[`alias-store.ts`](alias-store.ts) stores identity continuity separately at
`groma/aliases.md`. Its exact `groma/aliases/v0.1` Markdown frontmatter contains only a
source-sorted sequence of obsolete `source` IDs and their superseding `target` IDs. It
has no timestamps, names, paths, layout, or component prose. The codec rejects duplicate
sources, self-aliases, cycles, unsupported YAML features, malformed IDs, invalid UTF-8,
and configured byte/item overflows. Missing targets and live-source ambiguity are
validated against the complete intent snapshot before that state becomes readable.
The official Host gives the alias codec, transaction adapter, Standard invariant,
graph, and Markdown whole-graph resolver the same configured component ceiling.

The Markdown store receives the alias set when checking whole-graph parents and
relationship targets. It keeps the original references in their owning intent documents;
alias resolution is a semantic read projection, not a rewrite of unrelated intent. The
transaction adapter loads aliases before intent and materializes an explicit merge as one
journal batch: remove the obsolete component document, re-home its outgoing relationships
in the survivor document when needed, and replace the alias record. Incoming relationships
and child parent references remain untouched and resolve through the same chain after
restart. When a document is newly created, explicitly reparented, or re-homed, that
materialization writes the current live identity instead of adding a new obsolete
reference. The adapter also canonicalizes every endpoint in the post-mutation
relationship set and attributes source-keyed writes to the resolved live component, so
a later write through an obsolete source updates only the survivor document and cannot
recreate the retired document. A write or implicit source-ownership migration must
declare its live owner and relationship in the transaction's affected identities;
under-reported effects fail before journal publication.

## Canonical evidence and binding store

[`evidence-binding-store.ts`](evidence-binding-store.ts) owns the official Markdown codec,
bounded loader, binding resolver, and pure transaction-target planner for committed evidence.
It deliberately has no save or commit method. Reconciliation supplies one completed Core
observation snapshot and one graph generation, then composes the returned exact
`CanonicalTransactionTarget` replacements with the other canonical planes through the shared
local transaction journal. This keeps evidence publication on the same atomic semantic path
without pulling Markdown or filesystem policy into Core.

The source lane is exactly `(projectId, source.id, source.instance)`; scanner version is
provenance and never creates a second lane. A source document lives at
`groma/evidence/sources/<lane-hash-prefix>/<lane-hash>.md` and retains the current scanner
version, declared scopes, complete or partial coverage for every scope, supplied graph
generation, current record count, and a semantic snapshot fingerprint. The fingerprint omits
the operational session epoch, handoff token, checkpoints, clocks, and process paths, so an
equivalent completed snapshot from a new epoch emits no transaction targets and cannot churn
canonical bytes.

Observation identity is the unambiguous SHA-256 framing of project, source ID, source instance,
scope, and source-local key. Evidence records retain the exact Core-owned observation and
provenance, its observation-time scanner version and scope context, and its last observed graph
generation. They are stored in the fixed 256 logical shards
`groma/evidence/shards/00.md` through `ff.md`; empty shards are absent. A later successful
snapshot upserts observations it contains but leaves omitted prior observations at their older
generation. An unavailable or incomplete source supplies no snapshot and therefore causes no
canonical mutation or inference of absence.

Bindings use the matching fixed layout `groma/bindings/shards/00.md` through `ff.md`. Each
identity has a strictly generation-ordered history whose decisions are `automatic`, `explicit`,
`ignored`, or `superseded`. Supersession names another observation identity in the same source
lane and must form one acyclic chain ending in a decision. Component IDs remain byte-stable in
history; reads resolve them through the existing Core component-alias resolver and return both
stored and resolved IDs plus both chains. Missing, cross-lane, cyclic, or ambiguous terminals
fail closed. History is bounded both per binding and across the retained store; the aggregate
defaults to 1,000,000 entries with a 4,000,000-entry absolute ceiling. Generation replay applies
each generation atomically and validates only its changed reverse-reachable region with
memoized iterative traversal.

Every load enforces exact layouts, valid UTF-8, strict YAML without duplicate keys, aliases,
anchors, or tags, safe integer generations, deterministic reserialization, identity and bucket
ownership, source counts and fingerprints, uniqueness, history bounds, and aggregate resource
bounds. The planner returns a fully owned next snapshot, only changed sorted replacement or
deletion targets with current revisions, and all 256 fanout measurements: retained records,
records current in the source generation, distinct source lanes, and exact serialized shard
bytes. Those measurements inform the later fanout decision without changing the initial
256-bucket contract.

## Local observation journal

[`local-observation-journal.ts`](local-observation-journal.ts) makes finite observation
sessions crash-safe without turning provisional scanner output into canonical evidence.
It stores one deterministic whole-file record for each logical
`(projectId, source.id, source.instance)` lane at
`groma/observation-sessions/<sha256>.json`. The hash is only a portable locator; the full
lane identity, source version, epoch, declared scopes, exact Core bounds, and Core-owned
checkpoint remain inside the record and are replay-validated on every read. Source
version deliberately does not create a second lane. The first attempt to begin a newer
epoch durably marks an active predecessor `superseded`, fences its handle, and returns an
actionable retry result; the retry may publish the newer active epoch. A completed
`available` or `pending` predecessor is never overwritten or superseded. The newer begin
remains blocked until downstream acknowledges that exact completion.

These files are bounded operational recovery state, separate from intent, committed
evidence, bindings, transactions, migrations, and disposable projections. They are
canonical JSON with one LF framing byte, but they are not canonical architectural
meaning. They contain no layout, blueprint entity identity, absolute path, PID, host
name, UUID, timestamp, or wall-clock value. Normal abandonment or acknowledged-delivery
cleanup removes the exact lane file, while a process interruption intentionally leaves
the file visible for recovery. Cleanup cannot address another lane or epoch and has no
API that targets intent, prior evidence, transaction state, or projection resources.

The official negotiated session profile keeps Core and the local resource provider on
one bounded whole-file contract: at most 256 scopes, 50,000 records, 2,048 records per
batch, 4,096 batches, 8,192 total signals, and 2,097,152 canonical record characters. The
provider profile uses 16 MiB read and replacement ceilings; the journal refuses a lower
file ceiling than its exported conservative envelope calculation. The character
allowance leaves room for worst-case UTF-8 and JSON-escape expansion of records plus the
bounded begin, scope, transition, coverage, lifecycle, lane, and delivery envelopes.
Recovery enumerates at most 10,000 lanes in pages of at most 1,000 by default. Page
count, continuation progress, file shape, per-directory entries, lane count, file bytes,
and every nested checkpoint value remain explicitly bounded. Recovery also requires the
checkpoint to name this exact official session profile; a Core-valid lane with different
bounds is hostile operational state and fails closed. This is the first-use local profile,
not an extreme-scale chunk or shard format.

Every lane mutation uses an explicit persistent same-machine lease and a monotonically
advancing lane revision. Persistent acquisition uses immediate proven-dead process
recovery, so a crashed process can be recovered without waiting for the callback
coordination stale-age interval; live, reused, or unverifiable ownership remains
contended. Begin is staged, committed, and read back before a durable handle is returned.
An exact duplicate begin is idempotently reclaimable only while the replay-validated lane
remains empty and active. This settles the important case where commit succeeds but its
read-back is unavailable, while acknowledging that durable state cannot distinguish that
retry from an ordinary exact duplicate. Changed begin data, any accepted transition, or a
terminal lifecycle remains ineligible. Duplicate exact handles share the same stored
revision and checkpoint fence, so only one can advance.
Later handle calls first verify the exact lane, epoch, active lifecycle, revision, and
canonical checkpoint fingerprint, then apply the Core method exactly once, stage the
resulting checkpoint, and read back the committed replacement before acknowledging the
caller. Concurrent calls on one handle are rejected; a superseded, divergent, or
cross-process-stale handle is rejected before its signal body is inspected. Persistent
release is retried once. Unresolved release reports whether the coordinated action
completed, and a handle whose Core operation ran is poisoned before any later caller data
is inspected. Synchronous handle inspection exposes only its last durability-confirmed
Core inspection, including while publication is in flight or after poisoning. A retryable
unresolved release retains one opaque lease for that exact lane
inside the journal. The next operation or recovery of that lane atomically settles the old
lease before acquiring a fresh one; it never runs an action under a handle whose release
was unconfirmed. Another lane remains independent, and a concurrent same-lane caller
cannot share settlement or acquisition. A still retryable or thrown settlement returns
without running the action, confirmed release clears the lease, and an invalid or
ownership-lost lease is never retained. If Core has advanced but publication cannot be
confirmed, the same poison rule applies. A restart resolves the durable file instead of
retrying that in-memory Core call.

Cancellation, expiry, scanner failure, contradiction, explicit supersession, and an
active session found during restart are durable abandonment states with stable actionable
diagnostics. They carry no delivery token and can never imply coverage or evidence of
absence. Recovery never resumes scanner execution. It abandons an interrupted active
session, retains already abandoned sessions as ineligible, returns exact acknowledged
lane/epoch cleanup requests instead of an aggregate count, and fails closed without
deletion on a malformed, noncanonical, misnamed, or replay-invalid lane.

Successful completion is the only state that derives a deterministic
`groma-observation-handoff-v1:<sha256>` token and a replay-validated evidence snapshot.
The first offer durably changes `available` to `pending` before returning; retries and
restart return the same token and snapshot. Downstream reconciliation must commit before
acknowledging that token. Acknowledgement is durable and idempotent, and only an exact
acknowledged or abandoned lane/epoch becomes cleanup-eligible. Publication removes
dead-process replacement stages for that known lane before staging, and confirmed
eligible cleanup repeats that bounded stage cleanup after exact file removal. No cleanup
operation enumerates or mutates another lane or canonical plane. This provides
deterministic at-least-once delivery while leaving reconciliation, canonical evidence
publication, scanner execution, CLI orchestration, and external transport to their own
application slices.

## Local transaction journal

[`local-transaction-journal.ts`](local-transaction-journal.ts) implements Core's
model-neutral transaction-provider contract without adding Markdown or filesystem
policy to Core. A persistence-local adapter loads one semantic snapshot and turns an
already validated mutation into an exact, sorted set of canonical replacements and
deletions. The official adapter uses the Standard Model, Markdown intent store, and alias store;
future canonical planes can supply the same small adapter contract.
The journal independently requires those targets to form an exact bijection with the
proposal's expected revisions, including the same resource and expected value. A
faulty adapter therefore cannot add, omit, duplicate, or reclassify an unchecked
resource before journal publication. The fixed transaction-state resource is reserved
for the journal itself and is rejected as a canonical transaction target even when a
proposal and adapter agree on it. Reservation uses the same conservative locator alias
key as local coordination: NFC normalization, case folding, then NFC normalization
through captured string intrinsics. Exact, case-only, and normalization-equivalent
aliases therefore fail before token or prepared-state publication on every platform.

The fixed `groma/transaction-state.json` record is the committed generation marker
and recovery journal. It has deterministic canonical JSON, explicit byte/target
bounds, exact SHA-256 revisions, and a `projectionWatermark` field reserved for the
disposable projection plus its exact bounded `projectionFingerprint`. The pair is
operational continuity metadata and never blueprint meaning. Prepared and committing records contain the base and
target generations, affected identities, expected/result revisions, portable target
locators, and exact replacement bytes. Their token is derived from that canonical
evidence. PIDs, UUIDs, clocks, timestamps, and absolute paths never enter the record.
Idle state retains only the current generation, projection checkpoint, and one bounded
settlement receipt, so repeated recovery returns provider-recorded affected identities
and revisions rather than trusting caller-restored data.

Journal bounds distinguish aggregate replacement bytes from the maximum bytes needed
to classify one existing target. `maxTargetBytes` must cover every canonical resource
that a transaction may replace or delete and cannot be smaller than
`maxReplacementBytes`. Oversized existing targets fail before prepared state is
published; official hosts must align this ceiling with the Markdown store and local
resource provider bounds.

Prepare holds a persistent same-machine lease, writes the complete prepared record,
and stages every replacement before acknowledging the opaque token; canonical targets
remain unchanged. Commit durably changes the phase to `committing`, then applies and
verifies every sorted target. Recovery rolls back only a still-prepared record and
always rolls a committing record forward by classifying each exact current revision as
old, new, or divergent. Cleanup of live and target-specific orphan stages must succeed
while the pending record still retains their locators. Only then is idle state written
with the new generation, making the generation marker the last canonical change.
Read-only snapshots use that publication order as an optimistic persistence-local fence.
When no retained or in-use transaction lease exists, a snapshot accepts an adapter load
only between two idle journal observations with the same generation. A complete
prepared-to-rollback interval is safe at the same generation because prepared state
never publishes a canonical target. Every target publication is instead preceded by a
durable committing record, and successful settlement advances the generation only after
all targets are durable. Any non-idle, changed, malformed, or retained-lease observation
falls back to the existing exclusive settlement and recovery path. This permits
independent readers without adding a shared-lock contract or weakening writer and crash
recovery semantics. A prepared or committing live writer still makes the read fail fast;
the optimistic path serves concurrent readers only while canonical state is settled.
Unknown tokens, malformed state, external divergence, cleanup failure, and lease
release failure stay indeterminate or fail closed.
Replacement handles created during either commit or startup recovery are attached to
their transaction token before the provider commit begins. An unconfirmed target is
discarded through that token record before recovery returns indeterminate, including
the snapshot/startup path. Successfully discarded handle slots are cleared, but the
record survives a cleanup failure for retry; handle-only records are removed after
confirmed cleanup, while lease-bearing records remain until lease release succeeds.
Snapshot/startup coordination and failed prepare cleanup likewise retain an opaque
lease in volatile journal state when pre-move release fails. The next snapshot,
prepare, commit, or recovery entry atomically takes that lease before its first
asynchronous operation and retries release after settlement; a concurrent caller cannot
share the in-flight lease and instead follows normal contended acquisition. Confirmed
release clears the retained lease. Ownership-lost and invalid-handle diagnostics are
terminal instead: the stale handle is discarded and the next entry must acquire and
verify fresh coordination before transaction work. Nothing volatile enters the
deterministic transaction-state record.
Journal publication stages have their own volatile same-process recovery records. A
provider-confirmed pre-move rejection, or a thrown commit whose exact readback is still
the previous state or absence, discards the stage. If discard fails, the next journal
write retries that handle before staging anything new. When thrown or uncertain commit
readback shows the intended bytes, the handle remains commit-pending and is retried to
finish durability; it is never discarded as though rename had not occurred.
Journal publication is accepted only after the resource provider confirms
`committed`; byte readback alone proves visibility, not file and directory durability.
An indeterminate publication is retried on the same staged handle. Restart re-publishes
a visible committing record durably before changing any target, and re-publishes a
visible matching idle settlement before acknowledging it as committed. A failed idle
settlement re-publication remains indeterminate even when the prior settlement bytes
are still readable; a later retry must confirm the required cleanup and publication.
When a fresh process finds replacement bytes already visible at their recorded result
revision, it still re-stages those exact journal bytes and requires a provider-confirmed
commit plus exact readback before advancing the generation. Visibility alone cannot
substitute for reasserting file and parent-directory durability after a post-rename
crash.

Deletion is idempotent. POSIX removals sync an existing containing directory even when
the target is already absent, so recovery can reassert deletion durability. A missing
containing directory fails closed: its disappearance could also hide untargeted sibling
resources, so the provider cannot safely advance the transaction generation from the
target's absence alone. Windows keeps the same exact old/new classification and atomic
file behavior but, like replacement, makes no unsupported power-loss
directory-durability claim. The journal and provider
compile for macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64;
cross-compilation is not a substitute for native permission/durability verification.
Safe remediation is to restore the missing ancestor and any untargeted canonical
siblings from Git or backup, or recreate a parent proven to have contained only the
target, then retry recovery; never delete the journal to force progress.
An indeterminate deletion result is retried and accepted only after the provider
confirms `committed` and exact readback confirms absence; repeated uncertainty leaves
the committing record recoverable.

## Disposable projection index

[`projection-index.ts`](projection-index.ts) is the official local implementation of
Core's replaceable `ProjectionIndexCapability`, published by the official Host as
`groma.projection-index/v1`. Its index is
`.groma-cache/projection-index.json`, outside the canonical `groma/` records and the
Host's personal `.groma` user-data root. A provider-owned `.groma-cache/.gitignore`
marker makes that disposable directory self-ignoring without changing a project's ignore
rules; a current-cache load repairs a missing or changed marker before returning. The exact
`groma.projection-index/v1` JSON stores one canonical generation, sorted entities and
relationships, canonical aliases, deterministic searchable text, and incoming/outgoing
relationship adjacency. It stores no revisions, timestamps, absolute paths, layout, or
presentation state.

The local provider fingerprints bounded canonical JSON for sorted aliases, entities, and
relationships as lowercase SHA-256. Generation is deliberately excluded and compared as
a separate field. A cached view is current only when both generation and content
fingerprint match. A contiguous incremental candidate is published only when its complete
content fingerprint matches the exact current canonical snapshot; otherwise the provider
reconstructs instead of trusting a cache left by another checkout or branch.

The transaction projection source obtains one complete semantic snapshot and generation
from `TransactionProvider.snapshot([])`, validates it with the Standard Model, resolves
aliased containment and relationship endpoints, and never writes through that provider. Rebuild derives
the complete index deterministically. A contiguous `graph.committed` event replaces or
removes its affected entity and relationship records, refreshes aliases and every
alias-resolved containment or relationship endpoint, and re-derives adjacency; a missed, reversed,
duplicate, absent, corrupt, or stale projection
rebuilds from the current exact canonical snapshot instead of guessing across a gap.

Publication holds a projection-local same-machine lease and uses the local resource
provider's staged atomic replacement. Confirmed indeterminate publication is accepted
only after exact-byte readback. Canonical source, coordination, read, size, and publication
failures collapse to the stable `projection-index-unavailable` diagnostic. Deleting or
damaging the self-ignored `.groma-cache` can therefore affect only query availability or rebuild cost;
the projection provider has no canonical replacement target and cannot change intent or
aliases.
An oversized regular projection file is disposable corruption and is atomically replaced;
provider failures that do not prove a replaceable regular cache still fail closed.

The full JSON is only the reconstruction and incremental-materialization boundary.
Normal graph queries use [`projection-read-index.ts`](projection-read-index.ts), which
implements the distinct `ProjectionReadCapability` published by the official Host as
`groma.projection-read/v1` and
publishes immutable generation-and-fingerprint bundles under
`.groma-cache/projection-reads/`. Each bundle contains bounded catalog chunks, exact
entity/relation resources, bounded alias chunks, and bounded per-entity
incoming/outgoing adjacency chunks. Every immutable resource has a bounded Merkle proof
whose leaf hashes its stable logical path and exact bytes. The small
`.groma-cache/projection-read-current.json` manifest carries the root and resource count
and is replaced only
after all referenced resources are durable. Partial publication is inert; old bundle
files are cleaned only after the new manifest and checkpoint are current, with a bounded
best-effort pass whose failure affects only disk use. It first enumerates at most 10,000
bundle-root entries without descending into the current bundle, then spends a separate
10,000-entry stale-subtree budget while collecting at most 10,000 stale files or 4 MiB of
locator text. It deletes only after enumeration, and still removes everything collected
before a bound is reached. Directory requests are clamped to the official local provider's
10,000-entry default, so larger projection bounds do not make cleanup itself invalid. It
does not yet reclaim empty provider namespaces or legacy directories; that disk-hygiene
validation remains deferred to GROM-53.

The tracked transaction journal stores a projection fingerprint, partial-read integrity
root, and resource count beside its reserved generation watermark. All four fields are
operational continuity metadata, never canonical graph state. Canonical prepare,
rollback, commit, and recovery retain the prior checkpoint; the projection provider records it only
after manifest publication for the current
settled generation. A legacy marker without a fingerprint becomes unverified, marker
lag forces validation/rebuild, and a same-generation branch fingerprint mismatch cannot
authorize an ignored cache. The first partial read in each Host process performs one
full canonical validation, so a fresh Host catches first-open, legacy, branch-switch,
and out-of-band Markdown edits before serving. Later exact/page/search/traversal calls
read only bounded projection resources and verify each resource's path-and-byte
inclusion before decoding it. Direct Markdown mutation behind an already
running Host is not a supported concurrent write path; supported edits use Host
transactions, and reopening validates direct file edits.

After that fresh canonical validation, an unchanged complete index adopts an existing
partial bundle without rewriting it only when the current manifest and durable journal
checkpoint agree exactly on generation, fingerprint, integrity root, and resource count.
A warmed read reaches that adoption path without coordination when two idle journal
observations fence the canonical snapshot and two idle observations return the same
checkpoint. The projection rechecks the exact current manifest, continuity checkpoint,
and provider-owned ignore marker before committing process-local adoption. Each selected
chunk remains independently authenticated by logical path, exact bytes, and Merkle proof.
This read-only path never repairs or publishes; any unstable observation, incomplete
index, missing hygiene, or continuity mismatch falls back to the existing coordinated
repair path.
When a loader that cannot complete that read-only adoption fence loses the projection-local
lease to another publisher or repairer, it enters an iterative cancellation-aware retry
instead of guessing a safe publication timeout. Before every coordination attempt it checks
its optional local cancellation predicate and tries the complete adoption fence again. Only
one exact
`resource-coordination-contended` diagnostic authorizes another iteration; action,
release, mixed-diagnostic, and provider failures return immediately. Retry waits start at
20 milliseconds and use capped exponential backoff up to 500 milliseconds, with no total
elapsed-time limit.
Before waiting after that exact callback contention, `load()` makes one direct acquisition
of the same projection lease. That acquisition uses persistent coordination's immediate
double proof of a dead PID, so a cold reader can recover a crashed publisher without
weakening callback coordination's stale-age policy. Live, PID-reused, malformed, and
otherwise ambiguous owners remain contended. If the direct acquisition succeeds, the load
action runs at most once and the lease is always released; one cleanup retry is bounded,
and any release uncertainty withholds the action result even when that retry removes the
lease. `rebuild()` and incremental updates remain callback-only and fail fast on
contention.
If the completed publication becomes adoptable, the waiter returns without reacquiring or
writing. If it acquires the lease first, it becomes the coordinated repairer and may
replace only reconstructable projection resources, partial bundles, continuity metadata,
and cache ignore state through the existing publication path. It never targets canonical
intent, evidence, alias, or generation resources. The official Host connects plugin
cancellation to this local wait; a direct local caller that supplies no cancellation
predicate may wait indefinitely behind permanent exact contention. Cancellation may win
one final check after direct acquisition succeeds and before the publication action begins;
the acquired lease is still released. Once the action begins, it runs to settlement.
A missing, oversized, malformed, or semantically mismatched current manifest is
replaceable disposable state. A missing or mismatched valid checkpoint republishes;
manifest-provider or checkpoint I/O failure fails closed without publication, and a warm
partial read does not force a canonical reload. Adoption authorizes the root, not every
file eagerly: a missing, corrupt, or unauthenticated shard invokes a separate forced
reconstruction once and never loops through the adoption path.

Stable idle checkpoint reads are optimistic and read-only: they accept only two exact
idle observations with the same generation, projection identity, integrity root,
resource count, and watermark. A changing or non-idle journal retries through the
transaction's exclusive fail-fast lease, so prepared state and recovery retain the prior
fail-closed behavior. Checkpoint recording remains an exclusive mutation. Lease release
throws and failure results are contained as `projection-checkpoint-unavailable` after
successful coordinated checkpoint work; an earlier validation or generation-mismatch
diagnostic is preserved unchanged.

## Projection query engine

[`projection-query-engine.ts`](projection-query-engine.ts) implements Core's bounded
graph-query capability over `ProjectionReadCapability` alone. It never imports or reads
Markdown stores, resource locators, canonical component documents, or complete
projection snapshots. Construction copies and validates its bounds, captures the partial
provider receiver and methods once, and publishes a frozen capability whose
`maxPageSize` cannot drift with caller-owned option objects. Construction rejects an
advertised page maximum that the injected genuine Core bounded-query contracts do not
accept, so `maxPageSize` always describes a usable public limit. A logical caller flow
reads one frozen generation/fingerprint through `identity()` and passes it explicitly to
every exact, entity-page, search, and traversal call. Data-bearing methods never call
`identity()` internally; every partial provider access receives the copied expected
identity, and every response must echo it exactly. Exact reads resolve both live IDs and
canonical alias chains, while a replacement provider that answers under another
generation or same-generation fingerprint fails closed before a public result is
stamped.
Entity pages scan bounded stable-ID catalog chunks, then fetch selected live records in
one same-identity bounded batch; `kind: component` is the Standard Model component page.
On resume, one exact live catalog entry proves that the cursor anchor still satisfies the
exact filter or search predicate before catalog paging starts after that anchor, so prior
prefixes are not rescanned. The local provider aggregates across private fixed-size
storage chunks to satisfy the caller page limit; chunk size never enters Core or cursor
semantics. Full-text search owns
per-string NFKC/lowercase normalization even for replacement providers. The official
publisher applies that normalization before charging the accumulated character bound, so
no official catalog becomes unreadable through compatibility expansion; replacement
providers satisfy the same post-normalization bound. Search treats normalized
whitespace-separated terms as an order-independent conjunction, and fetches only the
selected stable-ID page.

Relationship traversal requests bounded incoming/outgoing adjacency pages for each
expanded entity. It performs a deterministic breadth-first walk, sorts each frontier and
discovered edge by stable identity, emits each relation once, and separately bounds
depth, visited entities, emitted relations, every examined edge (including type-filtered
nonmatches), provider page size, payload complexity, catalog scans, query text, terms,
tokens, and cursor bytes before unbounded work.
Cycles therefore close as finite relation hits rather than re-expanding entities. A page
cursor binds the operation, normalized filters, exact graph generation, and provider-
defined canonical fingerprint, while its small anchor is the last stable entity or
relation ID. Resumption deterministically recomputes the bounded order and requires the
anchor exactly once; `cursor-anchor-mismatch`, `cursor-query-mismatch`, and
`stale-cursor` fail closed rather than guessing. Generation mismatch wins when both the
generation and fingerprint changed, while same-generation fingerprint or query drift
remains `cursor-query-mismatch`. Entity and search pages remain ordered by stable entity
identity; traversal pages remain ordered by breadth-first depth and then stable relation
identity, independent of provider chunking.

Core's query contracts and the official engine share derived context and cursor ceilings
of 2,504 and 3,864 characters. The cursor derivation includes the exact worst case where
one literal BMP code unit becomes three percent-encoded UTF-8 triplets (nine characters),
while term boundaries replace one raw whitespace character at the same encoded cost.
Consequently every accepted kind, search text, term set, and bounded fingerprint can be
represented in query context and, when a next page exists, resumed with its opaque cursor.
If an embedder supplies a Core cursor contract with a larger budget than the engine, the
engine fails the page instead of emitting a cursor above its own accepted bound.

Invalid search input is rejected before projection catalog reads. Raw input or NFKC-expanded
text beyond the configured character bound returns `invalid-search-text` with only
`maximumCharacters`; excessive normalized terms return the same code with only
`maximumTerms`. Both maxima are positive safe integers owned by the query engine. Non-string,
empty, or whitespace-only text remains a generic `invalid-search-text`, while normalization
faults remain contained as query unavailability.

A positive safe traversal depth above the configured engine bound is likewise rejected before
identity or projection reads as `invalid-traversal-depth` with the frozen positive safe-integer
`maximumDepth`. Malformed, fractional, or nonpositive depth remains the same generic diagnostic
without synthesized details.

The engine receives the projection and Core bounded-query contracts by capability. Its
callers and Core never learn whether the projection is JSON, an in-memory fixture, or a
future database. Rebuild and incremental projection paths therefore share one query
implementation and return semantically identical pages when they represent the same
fingerprint and generation.

## Local resource capability

[`contracts.ts`](contracts.ts) defines the provider-neutral boundary used by
configuration and canonical stores. Callers never pass absolute filesystem paths or
use Bun file APIs. They parse or construct a branded `WorkspaceResourceLocator` and
call a capability method. The host supplies the one absolute workspace root only when
constructing [`local-resource-provider.ts`](local-resource-provider.ts).

Portable locators use `/` as a provider-neutral separator and `.` as the one canonical
root token. Individual segments accept Unicode but reject:

- empty, `.` and `..` traversal segments;
- absolute, drive-qualified, and UNC paths;
- `/` or `\` separator injection;
- Windows alternate-data-stream colons, reserved device names, trailing dots/spaces,
  control characters, and other non-portable filename characters;
- the case-insensitive `.groma-stage-` provider namespace in every segment;
- segments and complete locators beyond their explicit UTF-8 budgets.

Obviously impossible UTF-16 lengths are rejected before UTF-8 encoding, and the
segment factory enforces an incremental total before joining. Inputs within those
conservative preflights still receive the exact UTF-8 validation.

Capability methods revalidate branded strings at runtime. Absolute resolved paths
remain private. Resolution walks the workspace-relative chain with `lstat` and
`realpath`, rejects symbolic links and junctions in capability targets, and verifies
that canonical paths remain under the selected workspace. Enumeration may report a
link entry but never traverses it.

A Host may additionally supply one absolute `confinementRoot`; construction then rejects
a canonical provider root outside that ancestor before exposing the capability. A bounded
data-only list of top-level exclusions creates a case-insensitive virtual view without
rewriting locators: excluded roots cannot be read, enumerated, staged, removed, cleaned, or
used as coordination lanes, and recursive enumeration never descends into them. These are
Host authority controls rather than canonical resource semantics.

Enumeration re-resolves the expected directory at every recursive walk entry before
opening it. These checks narrow, but portable Bun/Node APIs cannot fully close, the
`lstat`-to-`opendir` enumeration window or the resolve-to-`rename` replacement window
without directory-handle-relative `openat`/`O_NOFOLLOW` operations. The provider rejects
observed links and revalidates before sensitive operations; it assumes no hostile
process is concurrently mutating the workspace filesystem namespace.

Staging owns first-time workspace initialization. It creates a missing parent chain
one segment at a time, handles a concurrent creator through `EEXIST`, and then
revalidates every segment with `lstat` and `realpath` as an in-workspace, non-link
directory. On POSIX, every validated ancestor has its containing directory synced in
top-down order. A newly created POSIX parent also has owner read, write, and search
permissions restored before the provider descends further; this ORs `0700` into the
actual permission bits and preserves any group or other access allowed by the caller's
umask. This makes newly or concurrently created entries durable and retries a prior
failed sync even when `mkdir` later reports `EEXIST`. Syncing only the eventual target
parent after file rename is insufficient when one or more ancestor directory entries
were also created for the first time. Windows skips POSIX mode repair and unsupported
directory sync, retaining only the documented atomic-rename/process-crash guarantee.
Configuration and canonical stores therefore do not need raw filesystem bootstrap
access.

### Reads

Every read supplies a byte limit within the provider's host-configured maximum. The
provider opens one handle, verifies that it is a regular file, and reads at most one
byte beyond the requested limit. It never allocates from an untrusted file size or
performs an unbounded convenience read. The result distinguishes malformed locator,
missing resource, unreadable resource, unsupported kind, byte overflow, and provider
failure. On POSIX hosts the descriptor is also opened with `O_NOFOLLOW`; pre/post
identity and confinement checks cover platforms whose compatibility layer does not
offer that flag.

Provider configuration has absolute ceilings so a trusted host typo cannot turn a
bounded operation into an unsafe allocation. Read and replacement limits default to
16 MiB and cannot exceed 64 MiB. Page size cannot exceed 10,000, entries per directory
cannot exceed 100,000, recursion depth cannot exceed 256, cursors cannot exceed 64
KiB and default to 16 KiB so two maximum-length locator fields plus cursor framing fit,
and stale-lock duration cannot exceed 24 hours. Invalid configuration is rejected during
provider construction. All read buffers reserve at most one additional byte under those
ceilings.

### Enumeration

Recursive enumeration requires all three bounds: page size, maximum relative depth,
and maximum entries per directory. Each directory is streamed only up to its explicit
cap before its names are sorted. Traversal order is deterministic and stops after the
page plus one continuation item; it does not load the complete tree. Pages report
depth truncation and use an opaque cursor bound to the locator and every request
bound. Malformed, stale, mismatched, and oversized cursors and directory overflow are
diagnostic outcomes rather than implicit truncation. A directory entry at the requested
depth conservatively marks the page as depth-truncated without opening that directory,
so unreadable contents beyond the caller's bound cannot fail the parent enumeration.

Provider-owned `.groma-stage-` siblings count toward the raw per-directory scan cap
but are omitted from public pages. Because the locator parser reserves that namespace
case-insensitively, reads and replacements cannot address a live or orphan stage even
through a forged branded string.

### Atomic replacement

Replacement is deliberately staged and committed in two calls. Staging copies caller
bytes, exclusive-creates a private sibling of the target (therefore on the same
filesystem), completely writes it through a bounded loop, calls `FileHandle.sync`,
forces mode `0600` through the already-open handle so a restrictive process umask cannot
remove owner access, and closes the handle. The sibling remains mode `0600` while it
awaits commit. The provider-owned opaque handle contains no path.

Commit revalidates confinement and the current target, records the existing target's
POSIX permission and executable bits, and atomically renames the still-`0600` sibling
over the target. A missing target records normal file-creation policy: mode `0666`
masked by the process umask. Keeping the sibling private through rename avoids exposing
uncommitted bytes if the process crashes before publication.

Before rename, failures are `not-committed`. After rename, finalization opens the
target, applies the recorded mode, syncs the file, and on POSIX syncs the target parent
directory before acknowledging `committed`. Windows receives the corresponding
Bun/Node `chmod` behavior but no ACL-preservation claim, skips unsupported directory
sync, and makes no power-loss directory-durability claim. Mode, file-sync, parent-sync,
or acknowledgement failure is `committed-indeterminate`, and a repeated commit on the
same handle retries finalization without renaming again. If target-file sync fails after
mode application, the live replacement record retains the already-open target handle so
retry can sync even when the restored mode is read-only; successful sync closes that
handle. Once target mode and file sync succeed, that substep is recorded so later
directory or acknowledgement retries do not reopen a now-read-only target. The target
therefore exposes only complete prior or replacement bytes. Discard before rename
removes the private stage. Discard after rename cannot undo publication: it closes any
retained finalization handle, records finalization as abandoned, and makes every later
commit return the same committed-indeterminate abandonment diagnostic without reopening
the target. Repeated discard remains idempotent. Commit and discard mutations on the
same live staged handle are serialized in invocation order. Concurrent duplicate commits
therefore observe the first operation's resulting state, while commit/discard overlap
cannot delete a replacement whose earlier commit is already publishing or publish a
stage whose earlier discard is already removing it.
Persistence-local fault injection carries the portable target locator and covers
write, flush, rename, post-rename mode
finalization, target-file sync, parent creation and target-parent directory sync,
after-rename, and cleanup boundaries without adding test behavior to Core.

Handles are live-operation capabilities, not durable journal records. The transaction
journal durably records the target locator and replacement bytes, then restages after
restart. Stage names contain a full target-locator hash, a private PID, and a UUID.
Target-specific cleanup is bounded by the provider's per-directory entry ceiling and
removes only stages whose owner process is known dead. A live or PID-reused owner is
retained conservatively; cleanup never guesses. Orphan stages remain invisible and
unaddressable through public resource locators.
Persistent lease release is retryable. A failure before the canonical lock is moved
retains both the provider's same-process guard and the journal's live lease; recovery
through the same journal retries release. Callback coordination performs one bounded
release retry because it cannot return the opaque lease handle to its caller.

Replacement bytes are runtime-validated through captured intrinsic TypedArray
getters, without `instanceof` or caller property reads. Genuine `Uint8Array` instances
and subclasses are snapshotted; proxies, `DataView`, and other typed arrays are
rejected without invoking their traps. Oversized input returns
`replacement-too-large`, and snapshot/allocation failures remain typed results rather
than rejected promises.

### Local coordination

Coordination supports both callback-scoped actions and explicit persistent leases used
from transaction prepare through commit. Both cover iteration 1A's same-machine local
processes. Leases are opaque, provider-owned capabilities with idempotent confirmed release;
they never contain or expose the filesystem owner record. Lock identity conservatively
NFC-normalizes and case-folds the canonical
workspace root plus absolute resource identity on every platform. Aliases therefore
over-contend safely even on case-sensitive filesystems. Shared-filesystem and
multi-host contexts return
`unsupported-coordination-context`; hosted or network coordination is not inferred.

The canonical lock directory is never constructed in place. The provider creates a
unique candidate, exclusive-writes and syncs its owner record, closes the owner
handle, and atomically renames the populated directory to the canonical lock name. On
POSIX, it explicitly restores candidate mode `0700` and owner mode `0600` after
umask-filtered creation, then opens and syncs the candidate directory before
publication. Windows retains per-user temporary-directory and ACL behavior and
deliberately does not attempt unsupported read-only directory-handle flushes.
A populated reaping claim serializes stale recovery. An old owner
must be proven dead twice before its lock is atomically moved to a unique quarantine,
freeing the canonical name before best-effort cleanup. Release uses the same
move-before-cleanup rule, so cleanup failure can leave only ignored unique artifacts
and cannot strand contention. Malformed, young, permission-denied, live, or PID-reused
owners remain contended. Stale replacement reacquisition is capped; repeated namespace
replacement returns `resource-coordination-retry-exhausted` instead of recursing
without bound. Owner tokens must match the exact lowercase UUID v4 shape emitted by
`randomUUID`; looser hyphenated strings are treated as malformed and remain contended.
The `.lock` or `.reaping` artifact containing `owner.json` must itself be a real,
non-link directory; symlink and junction artifacts remain contended and are never
accepted as stale ownership evidence. The documented namespace race assumption still
applies between artifact `lstat` and bounded owner-file read.

If the callback throws, coordination returns `coordination-action-failed`. If release
then fails, `coordination-release-failed` includes `details.actionCompleted`: `true`
means the callback completed successfully and its value is withheld under fail-closed
semantics, while `false` means the callback also failed. Underlying release diagnostics
follow that summary diagnostic. A caller must not blindly retry when
`actionCompleted` is `true`, because the coordinated side effects have already run.

The coordination root is outside canonical contents and cannot itself be a symlink or
junction. Before creating it, the provider canonicalizes its existing parent and rejects
a resulting candidate inside the workspace; custom missing roots therefore require an
existing parent. The final canonical root is checked again after creation. POSIX roots
must be owned by the current user, grant owner write and search, and grant no group/other
bits; the provider securely tightens its own user-scoped default to mode `0700`. A custom
coordination root observed as missing is likewise repaired to mode `0700` after creation,
while a pre-existing custom root is validated without mutation. A custom coordination
root is a POSIX-only host option. Windows rejects that option before any filesystem
access and always uses the provider-created default beneath its per-user temporary
directory and platform ACL behavior. Cross-compilation is not a claim of native Windows
permission verification. Volatile claims, quarantines, owner tokens, PIDs, and times
never enter `groma/` or Git state.

The coordination guarantee covers process crashes and same-machine concurrency. On
Windows, atomic publication begins at the rename of the already complete candidate;
the provider does not claim power-loss directory durability without a supported
directory flush primitive.

Persistent transaction leases recover immediately after an owner is proven dead:
the provider reads one exact valid owner, wins the atomic reaping claim, then
revalidates the same token and proves the PID dead again before quarantine. A live or
PID-reused owner remains contended. Ordinary callback coordination keeps the older
stale-age threshold in addition to the same double proof, avoiding a behavior change
for short scoped locks while allowing transaction startup to settle a crashed writer
without a five-minute default delay.

## Canonical schema migration

The local migration catalog recognizes configuration, package lock, aliases, stable-ID
intent shards, exact source/evidence/binding layouts, and flat plugin-owned records beneath
`groma/records/<plugin-id>/`. It
rejects malformed canonical-plane layouts and links instead of silently omitting them,
while excluding `transaction-state.json` and unrelated workspace files. Discovery reads
the three exact root records and enumerates only the bounded `groma/intent`, `groma/evidence`,
`groma/bindings`, and `groma/records` planes, so unrelated directory depth or size never
consumes canonical bounds. Every resource is read with per-document, count, directory, and
aggregate byte bounds and receives the same exact SHA-256 revision used by canonical
transactions.

`createCanonicalMigrationTransactionAdapter` is a raw-byte adapter for a separate
`LocalTransactionJournal` instance over the same durable protocol and transaction-state
resource. The complete catalog is an optimistic read set, every replacement is an exact
target, and prepare re-enumerates that exact set so additions, removals, partial targets,
and unrelated targets fail closed. Recovery uses only the journal's stored
locators/revisions/bytes. A restarted ordinary or migration journal can therefore settle
an interrupted batch without running a migrator again.

## Bun API rationale

Bun documents [`Bun.file` and `Bun.write` as the recommended ordinary file I/O
APIs](https://bun.com/docs/runtime/file-io). The same documentation directs operations
not exposed by those APIs to Bun's `node:fs` compatibility layer. Confined bounded
reads, durable atomic replacement, and populated coordination claims specifically need
`FileHandle.read`, exclusive creation, complete writes, `FileHandle.sync`, POSIX
directory sync, `lstat`, `realpath`, `opendir`, permissions, and atomic rename, so those
operations stay private to the implementation. Bun's current compatibility table
describes [`node:fs` as implemented and covered by its Node compatibility
suite](https://bun.com/docs/runtime/nodejs-compat).

Cross-compilation covers the four promised standalone targets. Runtime tests in this
repository verify the current host only; successful Windows or Linux cross-compilation
is not presented as native runtime verification on macOS.
