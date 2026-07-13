# Official Host

The official composition root, process lifecycle, and bootstrap integration. The host
assembles explicit capabilities without placing its technology choices in Core.

## Iteration 1A local profile

`createDefaultBootstrapRegistry` is the replaceable 1A composition seam. It explicitly
assembles the local resource provider, Standard Model and invariant, Markdown intent
store and transaction adapter, local transaction journal, Core transaction engine and
graph kernel, bounded query contracts, component resource mapper, shared application
operations, workspace access capability, and an injected surface. The returned named
capabilities exist for conformance and host tests; a running surface receives only
`WorkspaceAccessCapability`, not persistence or transaction internals. Iteration 1B can
replace this registry with the plugin runtime without changing Core or application
operation contracts.

The process context supplies one absolute workspace root. The host does not search its
ancestors. GROM-17 will decide how the CLI chooses that root.

## Minimal workspace document

The only 1A marker is `groma/groma.yaml`, and its complete canonical UTF-8 content is:

```yaml
schema: groma/v0.1
```

This intentionally minimal schema has exactly one field and one trailing newline.
Different bytes, extra fields, aliases, package declarations, and plugin declarations
are configuration conflicts in 1A and are never overwritten. Package and plugin
configuration belongs to the 1B bootstrap schema and runtime path; the 1A host neither
interprets nor executes it.

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
before comparing the exact marker. A transient provider failure remains publicly visible
through the existing conflict status shape, but initialize and recover re-run inspection;
a proven byte conflict remains stable and is never overwritten.

Coordination acquisition Results and failure diagnostics are exact-validated before any
publication. A retained lease must have the Local Resource Provider's opaque structural
shape: a frozen, empty, null-prototype, non-proxy object. This proves contract shape, not
provider or security provenance. A valid retained lease is released deterministically;
malformed successes cannot stage configuration.

## Workspace and recovery gate

`WorkspaceAccessCapability.requireWorkspace()` is the only semantic-operation gate
provided to surfaces. It returns the shared `ApplicationOperations` instance only
after configuration is compatible and `transactionProvider.snapshot([])` has
completed. Missing configuration returns `no-workspace`; incompatible configuration
returns `workspace-configuration-conflict`; compatible but unrecovered state returns
`workspace-recovery-required`. All host diagnostics are stable and omit absolute paths
and provider details.

Ready startup completes recovery before calling `surface.start`. Missing-workspace
startup dispatches with recovery marked `not-required` so the surface can offer
initialization. Successful initialization performs the same recovery handshake and
promotes the existing workspace session to ready without reconstructing the host.
Provider snapshots are copied once from exact data properties into bounded canonical
state before the host records their generation. Host recovery and normal application
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

Once a surface session exists, normal completion, failure, cancellation, and SIGINT or
SIGTERM all converge on one awaited `stop()` call. Signal and cancellation listeners
are removed on every exit path. The host calls `stop()` exactly once even after natural
completion, so a surface session must tolerate cleanup from that completed state.

The optional external cancellation listener receives one registration attempt and, once
that attempt begins, one matching removal attempt even if registration throws. A setup
fault returns the stable `host-startup-failed` outcome; a removal fault returns
`host-cancellation-cleanup-failed`. Process-signal cleanup still runs afterward, so its
own surfaced failure has deterministic final precedence when both cleanup steps fail.

`createProcessSignalSource` is the built-in process adapter; the CLI is not wired to it
in 1A. Its SIGINT and SIGTERM registration is
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

Registry, recovery, workspace-status, surface, and session values are treated as
hostile runtime input. The host exact-inspects and copies capability shapes once and
returns only stable host-owned failure diagnostics; source paths, resource keys,
provider codes, messages, and tokens are never forwarded.

The build verifies Darwin arm64, Linux x64 baseline, Windows x64 baseline, and Windows
arm64 by cross-compilation. Only the current native target is executed by this workflow;
the other target claims are compilation portability, not native runtime certification.

The 1A host contains no HTTP server, React bundling, project plugin discovery, dynamic
project imports, or untrusted project-code execution.
