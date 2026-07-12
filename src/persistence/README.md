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

Capability methods revalidate branded strings at runtime. Absolute resolved paths
remain private. Resolution walks the workspace-relative chain with `lstat` and
`realpath`, rejects symbolic links and junctions in capability targets, and verifies
that canonical paths remain under the selected workspace. Enumeration may report a
link entry but never traverses it.

Staging owns first-time workspace initialization. It creates a missing parent chain
one segment at a time, handles a concurrent creator through `EEXIST`, and then
revalidates every segment with `lstat` and `realpath` as an in-workspace, non-link
directory. Configuration and canonical stores therefore do not need raw filesystem
bootstrap access.

### Reads

Every read supplies a byte limit within the provider's host-configured maximum. The
provider opens one handle, verifies that it is a regular file, and reads at most one
byte beyond the requested limit. It never allocates from an untrusted file size or
performs an unbounded convenience read. The result distinguishes malformed locator,
missing resource, unreadable resource, unsupported kind, byte overflow, and provider
failure. On POSIX hosts the descriptor is also opened with `O_NOFOLLOW`; pre/post
identity and confinement checks cover platforms whose compatibility layer does not
offer that flag.

### Enumeration

Recursive enumeration requires all three bounds: page size, maximum relative depth,
and maximum entries per directory. Each directory is streamed only up to its explicit
cap before its names are sorted. Traversal order is deterministic and stops after the
page plus one continuation item; it does not load the complete tree. Pages report
depth truncation and use an opaque cursor bound to the locator and every request
bound. Malformed, stale, mismatched, and oversized cursors and directory overflow are
diagnostic outcomes rather than implicit truncation.

Provider-owned `.groma-stage-` siblings count toward the raw per-directory scan cap
but are omitted from public pages. Because the locator parser reserves that namespace
case-insensitively, reads and replacements cannot address a live or orphan stage even
through a forged branded string.

### Atomic replacement

Replacement is deliberately staged and committed in two calls. Staging copies caller
bytes, exclusive-creates a private sibling of the target (therefore on the same
filesystem), completely writes it through a bounded loop, calls `FileHandle.sync`,
and closes the handle. The provider-owned opaque handle contains no path.

Commit revalidates confinement and atomically renames the sibling over the target.
Before that rename, failures are `not-committed`; after a successful rename but lost
acknowledgement, the result is `committed-indeterminate`. The target therefore exposes
only the complete prior bytes or complete replacement bytes. Discard and cleanup are
idempotent. Persistence-local fault injection covers write, flush, rename,
after-rename, and cleanup boundaries without adding test behavior to Core.

Handles are live-operation capabilities, not durable journal records. The transaction
journal implemented by GROM-14 must durably record the target locator and replacement
bytes, then restage after restart. Private orphan discovery and cleanup are likewise a
GROM-14 recovery policy; orphan stages remain invisible and unaddressable through this
public resource capability.

### Local coordination

Coordination is callback-scoped and supports iteration 1A's same-machine local
processes. It uses atomic lock-directory creation in a volatile host directory outside
the canonical workspace, plus an in-process ownership registry. Contention fails
closed. Shared-filesystem and multi-host contexts return
`unsupported-coordination-context`; hosted or network coordination is not inferred.

Stale cleanup is conservative. A malformed, missing, young, permission-denied, live,
or PID-reused owner remains contended. An old owner must be proven dead before cleanup
enters a second atomic reaper directory. Normal acquisition checks that reaper before
and after creating its lock, so it cannot acquire while stale cleanup is in progress.
Volatile owner tokens, PIDs, and times never enter `groma/` or Git state.

## Bun API rationale

Bun documents [`Bun.file` and `Bun.write` as the recommended ordinary file I/O
APIs](https://bun.com/docs/runtime/file-io), and the provider uses `Bun.write` for its
small volatile coordination owner record. The same documentation directs operations
not exposed by those APIs to Bun's `node:fs` compatibility layer. Confined bounded
reads and durable atomic replacement specifically need `FileHandle.read`, exclusive
creation, `FileHandle.sync`, `lstat`, `realpath`, `opendir`, and rename-over-target, so
those operations stay private to the implementation. Bun's current compatibility
table describes [`node:fs` as implemented and covered by its Node compatibility
suite](https://bun.com/docs/runtime/nodejs-compat).

Cross-compilation covers the four promised standalone targets. Runtime tests in this
repository verify the current host only; successful Windows or Linux cross-compilation
is not presented as native runtime verification on macOS.
