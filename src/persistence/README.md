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

The `groma/v0.1` frontmatter contains structural metadata, embedded inputs, outputs,
actions, outgoing relationships, and extensions. For intent-bearing documents, the
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

## Local transaction journal

[`local-transaction-journal.ts`](local-transaction-journal.ts) implements Core's
model-neutral transaction-provider contract without adding Markdown or filesystem
policy to Core. A persistence-local adapter loads one semantic snapshot and turns an
already validated mutation into an exact, sorted set of canonical replacements and
deletions. The official adapter uses the Standard Model and Markdown intent store;
future canonical planes can supply the same small adapter contract.
The journal independently requires those targets to form an exact bijection with the
proposal's expected revisions, including the same resource and expected value. A
faulty adapter therefore cannot add, omit, duplicate, or reclassify an unchecked
resource before journal publication.

The fixed `groma/transaction-state.json` record is the committed generation marker
and recovery journal. It has deterministic canonical JSON, explicit byte/target
bounds, exact SHA-256 revisions, and a `projectionWatermark` field reserved for the
future disposable projection. Prepared and committing records contain the base and
target generations, affected identities, expected/result revisions, portable target
locators, and exact replacement bytes. Their token is derived from that canonical
evidence. PIDs, UUIDs, clocks, timestamps, and absolute paths never enter the record.
Idle state retains only the current generation, projection watermark, and one bounded
settlement receipt, so repeated recovery returns provider-recorded affected identities
and revisions rather than trusting caller-restored data.

Prepare holds a persistent same-machine lease, writes the complete prepared record,
and stages every replacement before acknowledging the opaque token; canonical targets
remain unchanged. Commit durably changes the phase to `committing`, then applies and
verifies every sorted target. Recovery rolls back only a still-prepared record and
always rolls a committing record forward by classifying each exact current revision as
old, new, or divergent. Cleanup of live and target-specific orphan stages must succeed
while the pending record still retains their locators. Only then is idle state written
with the new generation, making the generation marker the last canonical change.
Unknown tokens, malformed state, external divergence, cleanup failure, and lease
release failure stay indeterminate or fail closed.

Deletion is idempotent. POSIX removals sync the containing directory even when the
target is already absent, so recovery can reassert deletion durability. Windows keeps
the same exact old/new classification and atomic file behavior but, like replacement,
makes no unsupported power-loss directory-durability claim. The journal and provider
compile for macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64;
cross-compilation is not a substitute for native permission/durability verification.
An indeterminate deletion result is retried and accepted only after the provider
confirms `committed` and exact readback confirms absence; repeated uncertainty leaves
the committing record recoverable.

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
