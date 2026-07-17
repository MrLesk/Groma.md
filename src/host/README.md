# Official Host

The official composition root, process lifecycle, and bootstrap integration. The host
assembles explicit capabilities without placing its technology choices in Core.

## Default local plugin profile

`createDefaultBootstrapRegistry` is the official local composition seam. It constructs
eleven explicit built-in plugin registrations and resolves them through Core's
`PluginRuntime`: Phase 0 local resources, configuration discovery, and YAML parsing,
then Phase 1 kernel, Standard Model, canonical persistence, schema migration,
disposable projection, bounded graph query, application/workspace, and surface plugins. These are ordinary
runtime registrations with exact manifests, capability
declarations, dependencies, and start results—the same path available to a third-party
registration. They are not a wrapper around a second private composition path.

Phase 0 starts once as an owned staged graph. The Host reads its replaceable
`groma.resources/v1`, `groma.configuration-discovery/v1`, and
`groma.configuration-parser/v1` capabilities into a typed workspace locator and base
configuration, selects the Host-owned Phase 1 registration set, resolves the complete
graph, and continues without restarting Phase 0. A discovery, parsing, selection, or
continuation failure cleans the Phase 0 providers in dependency-safe order.

The running graph exposes deterministic inspection for conformance and host tests.
Every named `HostComposition` capability is the exact opaque value registered in that
graph: local resources, Standard Model and invariant, Markdown intent store and
transaction provider, Core transaction engine and graph kernel, bounded query
contracts, the replaceable local projection index and bounded graph query engine,
component resource mapper, snapshot decoder, shared application
operations, workspace access, package operations, and the injected surface. A running
surface receives `WorkspaceAccessCapability` plus the narrow scaffold/add/inspect/enable/
disable/remove package capability, not persistence, graph, runtime, or transaction internals.

The complete default graph also runs through the runner-agnostic conformance suite
published at `groma/plugin-sdk/conformance`. The suite exercises deterministic graph
inspection, lifecycle, cancellation, declared provider cardinality, and one
capability-specific behavior check for every built-in provider. Third-party packages
use the same suite and runtime fixture rather than copying Host tests.

The Host conformance adapter maps only the exact wrapper produced by an already-aborted
Phase-0 start to its narrower test diagnostic. It cannot hide an ordinary composition
failure: every other suite case must start the same fixture without cancellation, and
all unmatched Host diagnostics pass through unchanged.

The default profile uses exact capability version `1.0.0` and versioned capability IDs
such as `groma.resources/v1`. Local package declarations use a separate Host package
capability; the legacy `plugins` selector remains limited to official Host registrations.
Package add and inspect read inert static data only. The one dynamic import path is
isolated in the local package manager behind exact manifest/entry locks and a persisted
full-user-permissions grant. A Host embedder that violates the prevalidated official
registration seam receives `host-runtime-registration-invalid`.

Registry construction snapshots the selected coordination root, entropy source,
verification-only resource fault injector, and surface before composition can await.
Later mutation of the caller's options container cannot redirect the assembled host.
The fault injector is an explicit composition seam for real-process durability tests;
the production CLI never supplies one and has no environment-controlled crash path.

The process context supplies one absolute workspace root. The host does not search its
ancestors. The 1A CLI uses its process working directory as that root.

The projection plugin depends only on the Standard Model, canonical transaction
snapshot, and local resources. The application plugin publishes a genuine projection-aware
`TransactionEngine`: every supported direct or application transaction forwards a
confirmed `graph.committed` event after canonical commit, including commits confirmed by
transaction recovery. Projection failure cannot change
or reclassify that already-committed outcome; the next projection load compares the stored
generation and canonical-content fingerprint with current canonical state and rebuilds
safely. The complete `groma.projection-index/v1` capability is exposed as
`HostComposition.projection` for the application transaction engine, but it is not passed
to the terminal surface and is never added to a canonical journal target set.

The separate query-engine plugin depends only on `groma.projection-read/v1` and Core's
bounded-query contracts. It publishes `groma.graph-query/v2`, which the official
Application plugin requires and injects into shared blueprint export, search, and
traversal operations. The engine exposes a construction-captured page bound and requires
the caller to supply one previously captured generation/fingerprint identity to every
data-bearing query. `HostComposition.queryEngine` remains explicit for embedders and
verification, but `HostSurfaceContext` exposes only the shared application operations;
the terminal surface cannot bypass their canonicalization and generation checks.
The official Application plugin publishes its complete shared operation surface only as
`groma.operations/v2`, and official full-workspace and blueprint registrations require
that v2 identity. No v1 operations or graph-query adapters are published. The lifecycle
accepts the exact legacy v1 operations shape only to capture `initialize`; it exposes
only that captured method through the initialization view and cannot treat the legacy
object as v2 workspace or blueprint operations.
The official projection plugin publishes the same object as the complete
`groma.projection-index/v1` reconstructable index and the bounded
`groma.projection-read/v1` partial-read capability; `HostComposition` keeps those
contracts explicit as `projection` and `projectionRead`. The application consumes only
the former ID, while the query plugin receives only the latter semantics:
normal reads consume bounded cache catalogs and path-and-byte-verified shards, while
first-open or stale continuity performs one full validation before anything is served.
An unchanged first-open adopts only a manifest authorized by the durable transaction
checkpoint; checkpoint failure cannot fall back to process-local trust or trigger a
write. The Host configures one public page bound for both the query engine and projection
read provider, while Persistence keeps physical shard sizing private. Application uses
that bound for its internal relationship paging independently of a public component-page
limit. Core's bounded query contracts and the engine also receive the same derived
context and cursor ceilings;
the 2,504-character context and 3,864-character cursor ceilings include worst-case JSON
escaping and nine-character BMP percent encoding so every accepted public search can
produce a resumable page without an internal size contradiction.

## Bootstrap workspace document

The configuration resource is `groma/groma.yaml`. Initialization still writes the
smallest canonical UTF-8 document, preserving every existing workspace:

```yaml
schema: groma/v0.1
```

The bounded schema reserves an optional `plugins` sequence for official Host-profile
selection and an optional `packages` sequence for blueprint package declarations:

```yaml
schema: groma/v0.1
plugins: []
packages: []
```

These three fields are the only keys. Each package declaration contains exactly `name`,
`source`, and sorted `enabled` entry paths. The parser rejects invalid UTF-8, anchors,
aliases, explicit tags, duplicate keys, IDs, package names, or entry paths, non-scalar
entries, unknown keys, non-portable blueprint sources, and configured bounds. Requests
and declarations are sorted by code unit for deterministic selection. The document may
enable at most 53 local package entries in the default profile. That is one shared Host
capacity with enabled personal entries, not an independent per-scope allowance; an
embedder that adds bootstrap registrations reduces the remaining local capacity.
The shipped default CLI has no optional official contributions today. Required built-in
Phase 1 plugins already run; listing one of their IDs is accepted but redundant and adds
nothing. A Host embedder may inject a prevalidated optional official registration. An
official ID unavailable in that Host produces `runtime-plugin-unavailable`. A project ID
still produces `project-plugin-validation-required`; project packages instead cross the
static-manifest, exact-lock, and trust boundary before supplying Phase 1 registrations.

The local discovery provider uses the same provider-relative
`groma/groma.yaml` locator for x64 and arm64 source execution on macOS, Linux, and
Windows. Architecture does not change POSIX or Windows path syntax. Artifact verification
remains limited to the four promised targets: macOS arm64, Linux x64, Windows x64, and
Windows arm64. Core sees neither paths nor YAML.

## Local package boundary

The initial manager supports local paths only. Blueprint packages use portable `./`
sources contained by the workspace and write deterministic declarations to
`groma/groma.yaml` plus exact locks to `groma/packages.lock`. Personal package records
and trust grants use an injected Host user-data root outside the workspace. Remote-like
`npm:`, `git:`, and URL inputs fail before source filesystem access. No operation edits
an observed `package.json`, dependency lock, or dependency tree.

Package-root `groma.package.json` must be strict duplicate-free JSON with exactly the
six public SDK fields. Add reads that inert document; inspect may also hash enabled entry
bytes to report drift, but neither imports code. Enable first checks
an existing exact location-and-integrity-bound grant or requires
`--trust-full-user-permissions`; only then may it import the selected Phase 1 module's
named `plugin` export. The canonical lock records the exact manifest bytes, every
enabled entry module's bytes, and resolved plugin ID. Startup rechecks all three before
import. Supported mutations and startup share one workspace-scoped package-state
coordination lease; direct edits are detected by re-reading canonical configuration,
exact lock, and exact user state after materialization and immediately before each import.
The Host then evaluates an immutable in-memory module made from those already-read entry
bytes instead of reopening the source path.
Manifest and entry paths are canonically checked again after their file descriptor opens;
the open descriptor, current path identity, and package-root containment must still agree.

One executable entry is bounded to 4 MiB and must be bundled or otherwise
self-contained. Bun-compatible TypeScript syntax in that entry and absolute `node:`
built-in imports are supported; relative and bare runtime imports are not. This is an
exact-byte boundary, not a sandbox: trusted code retains full user permissions and may
still load secondary code through absolute URL imports, computed dynamic imports, or
other runtime facilities. Such secondary code is outside the lock, so local-path
packages do not claim to be remotely reproducible complete artifacts.

Persisted trust is currently available only on POSIX. The Host requires the real
user-data root to belong to the current user with mode `0700`; it does not pretend those
mode bits attest Windows ACLs. Without a bounded Windows owner/ACL attestor, Windows
fails `plugin-package-trust-root-unattested` before reading or writing plugin trust or
importing an enabled local entry. Enable applies this check before materializing or
importing the selected entry and before creating a user-data root. A fresh Windows
workspace with no enabled blueprint entry and no plugin user-data root still starts
normally without personal plugins. It may also remove an inert blueprint declaration
without trust pruning, but only after the Host proves that user-data root is absent; an
existing or unclassifiable root still fails closed.

If the observed workspace is the user's home directory, the default `.groma` user-data
path would fall inside that workspace. A missing contained root does not block empty
initialization or startup and is never created as a side effect. Any operation that
would require personal state or persisted trust fails closed before package evaluation,
and an existing contained root is never accepted as plugin state.

An explicit grant for changed exact bytes supersedes older grants for the same scope,
workspace, package location, package name, and entry. Trust state therefore keeps one
current exact grant per logical entry, and reverting to previously trusted bytes requires
explicit trust again. Persisted state containing multiple exact grants for one logical
entry is malformed and cannot authorize execution. Disable retains the unchanged
exact-byte grant; remove is the explicit revocation boundary and prunes grants only after
every package entry is disabled.

Personal entries must provide and require only `groma.presentation.*` capabilities.
This keeps canonical mutation capabilities out of personal runtime resolution; it is
not a security sandbox, because trusted plugins still execute with full user permissions.

The official CLI composes package commands in management-only mode. Existing enabled
entries are not loaded or started while add, inspect, enable, disable, or remove runs;
the selected enable entry is the only code imported, after trust, for bounded registration
validation. This keeps add and inspect inert and leaves disable/remove available when an
ordinary startup fails closed on exact-byte drift.

Before ordinary startup imports any enabled local entry, the Host rejects unsupported
project requests, unavailable official selections, invalid Host registration namespaces,
and selected Host registration defects that adding local providers cannot resolve. Package
loading re-reads the current canonical configuration before resolving the exact lock, so a
selection changed since bootstrap fails before local module evaluation. Enabled entries
across blueprint and personal package state must also have distinct runtime plugin IDs.
Enable checks the selected registration against the complete blueprint-lock and
personal-state union before writing trust or package state; startup rejects duplicate
stored IDs before importing either entry. Startup reads that complete lock even when
canonical configuration declares no blueprint packages, so lock-first recovery state
cannot disappear from revalidation or ID-reservation checks. Local entries are also
rejected before any state write when their ID uses the Host-reserved `official.*`
namespace.
The enable execution boundary performs the same exact configuration, lock, and personal-
state revalidation immediately before importing the selected full-permissions entry.

Every state write is byte-preflighted against its corresponding read bound. Blueprint
publication writes the exact lock before configuration; disable and remove can reconcile
that lock-first state after an interrupted second write, without requiring the package
source to remain available. Disable also clears a configured enabled entry when the
lock file or its package record is missing, then remove can finish the cleanup; neither
recovery path evaluates package code. Unreadable, oversized, unsupported, or failed
lock and personal-state reads cross startup as stable package-store diagnostics without
provider paths or private failure details.

Once the lock replacement commits, any failure publishing configuration or releasing the
coordination lease is reported as indeterminate, because the command has already changed
package state even when the second replacement is known not to have committed. Recovery
reviews `groma/groma.yaml` and `groma/packages.lock`, then uses management-only disable or
remove only when those selections differ. Personal state is verified independently with
personal package inspection. Inspection reports a changed valid manifest as an inert
`manifest-drift` snapshot without resolving entries that the changed manifest no longer
declares; exact-manifest entry drift remains `entry-drift`.

The runtime accepts at most 128 registrations. The default profile reserves its eleven
built-ins and the full 64-entry official-runtime selection bound before admitting local
entries, leaving 53 enabled local entries. Enable and ordinary startup count blueprint
and personal selections together before any local import. Exceeding the remaining
capacity fails closed without changing configuration, lock, or user-state bytes.
Each local registration is preflighted with the same ordinary Host manifest bounds:
at most 16 provided and 16 required capabilities and 128 characters per identity token.

Zero candidates is the typed missing-workspace state. Multiple candidates fail with
`workspace-discovery-conflict`; invalid YAML fails with
`workspace-configuration-malformed`; and competing single-provider Phase 0
capabilities fail with `bootstrap-provider-ambiguous` before any provider starts.
The Host re-reads and compares the canonical configuration immediately before Phase 1;
non-equivalent changes fail with `workspace-configuration-changed` before a selected
optional plugin starts. Workspace inspection repeats the same semantic comparison so a
later change cannot produce a usable mismatched composition. A peer may only move an
initially missing workspace to the same empty canonical configuration. Transient
discovery, parsing, or configuration-access failures retain their infrastructure
diagnostic and are never presented as proven configuration drift.

Discovery is bounded and read-only. A missing marker leaves initialization available
and does not create a journal or canonical intent files. Initialization takes a
same-machine coordination lease, stages copied canonical bytes, publishes atomically,
and preserves incompatible state. Publication is accepted only after the resource
provider returns an exact, structurally valid `committed` outcome and exact marker
readback succeeds. Thrown, malformed, or `committed-indeterminate` outcomes retain the
original staged handle and coordination lease for a later commit retry; marker
visibility alone never promotes the session. A confirmed `not-committed` outcome is
discarded to a confirmed result before the handle is cleared. If exact reinspection then
finds the compatible marker published by a peer, initialization runs the normal recovery
handshake and reports `already-initialized`; missing or conflicting reinspection remains
fail-closed. A compatible marker is idempotent.

Marker reads cross an exact provider boundary before the host inspects diagnostics or
bytes. Only the Local Resource Provider's one canonical `resource-missing` failure means
the marker is absent, and only its canonical bounded `resource-too-large` failure proves
a configuration conflict. Malformed, accessor-bearing, proxied, extra, or secret-bearing
lookalikes are retryable `workspace-configuration-provider-failure` state. Successful
bytes must be an intrinsic, non-proxy `Uint8Array`; the host makes one bounded owned copy
before parsing it through the selected configuration capability. A transient provider failure remains publicly visible
through the existing conflict status shape, but initialize and recover re-run inspection;
a proven byte conflict remains stable and is never overwritten.

Coordination acquisition Results and failure diagnostics are exact-validated before any
publication. A retained lease must have the Local Resource Provider's opaque structural
shape: a frozen, empty, null-prototype, non-proxy object. This proves contract shape, not
provider or security provenance. A valid retained lease is released deterministically;
malformed successes cannot stage configuration. Successful staging Results cross the
same exact boundary. Their provider-owned handles must be non-Promise, non-proxy objects;
the host preserves their identity for commit or discard without imposing the built-in
provider's private representation on replaceable providers.

## Workspace and recovery gate

`HostSurfaceContext.initialization` is a frozen initialization-only view. At composition
time the Host exact-validates either the complete v2 `ApplicationOperations` surface or
the exact legacy v1 initialization-compatibility shape, then captures `initialize` with
its original receiver. A missing-workspace surface can therefore call
`initialization.initialize({})` without receiving any other semantic operation
authority. Only the full v2 surface can be returned as complete workspace operations;
the legacy shape is never promoted beyond this captured initialization view.
`HostSurfaceContext.packages` is a separate frozen five-operation view; it cannot expose
the internal package loader or plugin runtime.

`WorkspaceAccessCapability.requireWorkspace()` is the only gate to the complete
semantic-operation surface provided to surfaces. The lifecycle exact-validates every
gate result and returns a frozen captured-method facade only when the successful value
is the same exact full-v2 source validated at composition; legacy, mismatched, malformed,
Promise-valued, or throwing successes become one path-free capability failure. Native
Promise settlements are observed without waiting so rejected reasons cannot escape the
synchronous gate. Failures retain exactly one allowlisted workspace code (`no-workspace`,
`workspace-configuration-conflict`, `workspace-configuration-provider-failure`, or
`workspace-recovery-required`) with a Host-owned message and no details; unknown,
malformed, or multiple diagnostics collapse to the same capability failure and cannot
choose a surface exit class. The gate opens only after
configuration is compatible and
`transactionProvider.snapshot([])` has completed. Missing configuration returns
`no-workspace`; incompatible configuration returns `workspace-configuration-conflict`;
compatible but unrecovered state returns `workspace-recovery-required`. All host
diagnostics are stable and omit absolute paths and provider details.

Ready startup completes recovery before calling `surface.start`. Missing-workspace
startup dispatches with recovery marked `not-required` so the surface can offer
initialization. Successful initialization performs the same recovery handshake and
promotes the existing workspace session to ready without reconstructing the host.
Provider snapshots are copied once from exact data properties into bounded canonical
state before the host records their generation. Snapshot state containment applies the
configured local depth and value bounds and observes nested native Promises before an
earlier malformed scalar can reject the snapshot. Host recovery and normal application
reads receive the exact same proxy-aware application snapshot-state decoder instance,
including GraphKernel loading, Standard Model parsing, duplicate and endpoint checks,
and final containment invariant validation.

The default `maxEmbeddedItems` bound applies independently to each
component's combined inputs, outputs, and actions, while `maxSnapshotStateValues` bounds
the complete snapshot across all components and relationships. Concurrent initialize and
recover calls reserve one non-rejecting operation tail in invocation order, so
publication handles, leases, status, and generation are never mutated concurrently.
Workspace construction requires factory-owned decoder metadata before it calls a provider,
and the decoder's snapshot depth and value limits must be at least as strict as the local
workspace limits. Marker and lease validation apply that exact decoder proxy policy in
addition to the host's intrinsic proxy detector. Before its first provider await, workspace
construction exact-inspects and snapshots its bounds, operations, and required capability
methods; later container or method mutation cannot redirect calls, which retain their
original receivers.

Resource and transaction-provider callbacks must not reenter `initialize()` or
`recover()` on the same workspace capability. Reentrant calls
fail immediately with `workspace-transition-reentrant` instead of joining their own
tail; calls from unrelated external async contexts retain FIFO behavior. The lifecycle
independently validates the exact recovery `Result` and report at runtime, rejecting
accessors, proxies, extra keys, unsafe generations, and malformed success values before
surface dispatch.

## Lifecycle

`runHost` installs the injected signal source and optional cancellation listener before
composition. The registry receives one frozen host-owned process context that preserves
the selected workspace root and always carries the host controller's signal. Composition
and recovery are safely observed and raced against that signal, so cancellation returns
without waiting for a non-cooperative pending Promise; late resolve, reject, or malformed
results are contained and never dispatch a surface. Only runtime values exactly equal to
`SIGINT` or `SIGTERM` appear in a cancelled outcome. Any other injected signal value
requests generic cancellation without exposing the value.

Cancellation after composition has begun also owns any graph delivered later: the Host
canonicalizes a late valid composition and cancels its plugin graph asynchronously,
while malformed or rejected late values remain contained. During pending recovery,
provider cancellation waits for the recovery Promise to settle. During pending surface
start, it waits for that start to settle and, if a session appears, for its one `stop()`
attempt. These fences prevent providers from disappearing underneath in-flight work
without delaying the initial cancelled return. This deferred cleanup preserves
surface-before-provider ordering and one graph cleanup traversal once the pending
operation settles, but it may complete after `runHost` has returned its cancelled
outcome. If a provider never settles, or the process exits first, that deferred cleanup
cannot be guaranteed; no later public outcome is available to report its failure.

Whenever dependent composition, recovery, and surface-start work has settled—including
normal and failure exits and cancellation after an active surface session exists—the
Host awaits surface cleanup and then the running plugin graph's shutdown or cancellation
before `runHost` returns. The Core runtime supplies the dependency-safe, exactly-once
plugin ordering; the Host only adapts its process cause to `cancel()` or `shutdown()` and
exact-validates the native-Promise result. Failure of this awaited plugin cleanup becomes
the stable `host-plugin-cleanup-failed` surface outcome. External cancellation and
process-signal listener cleanup still run afterward with their existing deterministic
precedence. The deferred late-work cases above retain the same surface-before-provider
ordering but are deliberately contained outside that returned outcome.
The cleanup mode is captured from the lifecycle cause rather than inferred from the
mutable public outcome, so a surface-stop failure after `SIGINT` or `SIGTERM` still
cancels providers instead of converting the traversal into normal shutdown.

Once a surface session exists, normal completion, failure, cancellation, and SIGINT or
SIGTERM all converge on one awaited `stop()` call. Signal and cancellation listeners
are removed on every exit path. The host calls `stop()` exactly once even after natural
completion, so a surface session must tolerate cleanup from that completed state.

The optional external cancellation listener receives one registration attempt and, once
that attempt begins, one matching removal attempt even if registration throws. A setup
fault returns the stable `host-startup-failed` outcome; a removal fault returns
`host-cancellation-cleanup-failed`. Process-signal cleanup still runs afterward, so its
own surfaced failure has deterministic final precedence when both cleanup steps fail.
Listener registration and removal are synchronous `void` contracts: `undefined` is the
only valid return. Any other value is malformed immediately. A safely observable native
Promise is given captured intrinsic settlement handlers before that failure is reported,
but is never awaited, so rejection is contained and resolving or permanently pending
returns cannot delay host shutdown. Hostile `then` and shadowable constructor/species
behavior are not consulted. Proxy-wrapped returns are rejected by the host's intrinsic
proxy detector before Promise observation, so proxy traps cannot run in this validation.

`createProcessSignalSource` is the built-in process adapter used by the CLI. Its SIGINT
and SIGTERM registration is
transactional: a registration failure rolls back every listener that may have been
added. Cleanup attempts both removals independently, records only successful removals,
and leaves failures retryable without removing a successful listener twice. The surface
receives the host cancellation signal. Cancellation races asynchronous surface start,
so a permanently pending start cannot block host return; a valid session that resolves
later is stopped exactly once and late rejection is contained.

Signal-source cleanup may be synchronous or asynchronous. The host invokes it exactly
once and awaits it before returning. A cleanup throw or rejection overrides any prior
completed, cancelled, startup-failure, or surface-failure outcome with the frozen
host-owned `host-signal-cleanup-failed` surface-failure outcome, because deterministic
shutdown was not achieved; external cleanup errors and diagnostics are never retained.

Surface completion, `stop()`, and asynchronous signal cleanup are observed with captured
Promise and reflection intrinsics. For ordinary Promises, Promise subclasses, hostile own
`then` properties, and shadowable constructor/species behavior, the host installs its
settlement handlers without invoking provider accessors, restores the original descriptor,
and exposes only stable host-owned outcomes. A non-configurable, non-writable hostile own
constructor descriptor cannot be safely shadowed or executed; the host fails closed
without invoking it. If trusted plugin code has already returned such a rejected Promise,
JavaScript provides no trap-free way to mark that original rejection handled, so this is
containment rather than a security sandbox and the host does not install a global
`unhandledRejection` interceptor.

The same proxy-first observation helper owns bootstrap composition and workspace recovery
Promises. A proxy-wrapped Promise is rejected before `instanceof` or descriptor inspection,
and fulfilled capability values cross their own exact proxy-aware boundary before use.

A synchronous `surface.start` return is exact-validated directly, without passing the
session through Promise resolution or consulting a session-shaped value's `then` member.
A native Promise return is instead observed with the captured intrinsic path before its
fulfilled session is validated. Host diagnostic boundaries likewise make bounded owned
copies and observe nested native Promises before returning generic host-owned failures.

Registry, recovery, workspace-status, surface, and session values are treated as
hostile runtime input. The host exact-inspects and copies capability shapes once and
returns only stable host-owned failure diagnostics; source paths, resource keys,
provider codes, messages, and tokens are never forwarded.

The build verifies Darwin arm64, Linux x64 baseline, Windows x64 baseline, and Windows
arm64 by cross-compilation. Only the current native target is executed by this workflow;
the other target claims are compilation portability, not native runtime certification.

The Host contains no HTTP server, React bundling, remote package acquisition, project
package-manager invocation, or unvalidated project-code execution. Its single local
dynamic import path is preceded by exact static-document validation, manifest and entry
hash checks, and a trust grant stored outside the repository.

The default Phase 1 graph includes one multiple-provider schema-migrator contribution,
the canonical migration catalog and journal provider, and shared migration operations.
Additional trusted plugins contribute through the same public runtime capability. Normal
startup still performs semantic recovery and rejects older unsupported documents. The CLI
uses a narrow migration-only recovery composition for explicit migrate commands so it can
read structurally compatible legacy configuration/lock schemas, settle the shared journal,
and inspect older bytes without making ordinary application operations available against
an un-migrated semantic snapshot. This read-only compatibility is not enabled for normal
startup, and trusted pinned plugins still load so their schema contributions remain
available.
