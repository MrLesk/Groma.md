# Persistence

Official local-resource and canonical persistence providers. Technology-specific
implementations satisfy capability contracts and never become authoritative outside
their canonical records.

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
top-down order. This makes newly or concurrently created entries durable and retries a
prior failed sync even when `mkdir` later reports `EEXIST`. Syncing only the eventual
target parent after file rename is insufficient when one or more ancestor directory
entries were also created for the first time. Windows skips unsupported directory sync
and retains only the documented atomic-rename/process-crash guarantee. Configuration
and canonical stores therefore do not need raw filesystem bootstrap access.

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
therefore exposes only complete prior or replacement bytes. Discard and cleanup are
idempotent.
Persistence-local fault injection covers write, flush, rename, post-rename mode
finalization, target-file sync, parent creation and target-parent directory sync,
after-rename, and cleanup boundaries without adding test behavior to Core.

Handles are live-operation capabilities, not durable journal records. The transaction
journal implemented by GROM-14 must durably record the target locator and replacement
bytes, then restage after restart. Private orphan discovery and cleanup are likewise a
GROM-14 recovery policy; orphan stages remain invisible and unaddressable through this
public resource capability.

Replacement bytes are runtime-validated through captured intrinsic TypedArray
getters, without `instanceof` or caller property reads. Genuine `Uint8Array` instances
and subclasses are snapshotted; proxies, `DataView`, and other typed arrays are
rejected without invoking their traps. Oversized input returns
`replacement-too-large`, and snapshot/allocation failures remain typed results rather
than rejected promises.

### Local coordination

Coordination is callback-scoped and supports iteration 1A's same-machine local
processes. Lock identity conservatively NFC-normalizes and case-folds the canonical
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
coordination root is a POSIX-only host option. Windows rejects that option before any
filesystem access and always uses the provider-created default beneath its per-user
temporary directory and platform ACL behavior. Cross-compilation is not a claim of
native Windows permission verification. Volatile claims, quarantines, owner tokens,
PIDs, and times never enter `groma/` or Git state.

The coordination guarantee covers process crashes and same-machine concurrency. On
Windows, atomic publication begins at the rename of the already complete candidate;
the provider does not claim power-loss directory durability without a supported
directory flush primitive.

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
