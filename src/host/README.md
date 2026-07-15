# Official Host

The official composition root, process lifecycle, and bootstrap integration. The host
assembles explicit capabilities without placing its technology choices in Core.

## Default local plugin profile

`createDefaultBootstrapRegistry` is the official local composition seam. It constructs
eight explicit built-in plugin registrations and resolves them through Core's
`PluginRuntime`: Phase 0 local resources, configuration discovery, and YAML parsing,
then Phase 1 kernel, Standard Model, persistence, application/workspace, and surface
plugins. These are ordinary runtime
registrations with exact manifests, capability declarations, dependencies, and start
results—the same path available to a third-party registration. They are not a wrapper
around a second private composition path.

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
contracts, component resource mapper, snapshot decoder, shared application
operations, workspace access, and the injected surface. A running surface still
receives only `WorkspaceAccessCapability`, not persistence, graph, runtime, or
transaction internals.

The default profile uses exact capability version `1.0.0` and versioned capability IDs
such as `groma.resources/v1`. It has no package acquisition, dynamic import, trust
prompt, or project-code execution path. Optional registration inputs are explicitly
Host-owned and already validated; configuration that requests any non-official plugin
fails with `project-plugin-validation-required` before those inputs are inspected.
GROM-24 owns package and trust validation and must cross that fence before it may supply
a project registration.

Registry construction snapshots the selected coordination root, entropy source,
verification-only resource fault injector, and surface before composition can await.
Later mutation of the caller's options container cannot redirect the assembled host.
The fault injector is an explicit composition seam for real-process durability tests;
the production CLI never supplies one and has no environment-controlled crash path.

The process context supplies one absolute workspace root. The host does not search its
ancestors. The 1A CLI uses its process working directory as that root.

## Bootstrap workspace document

The configuration resource is `groma/groma.yaml`. Initialization still writes the
smallest canonical UTF-8 document, preserving every existing workspace:

```yaml
schema: groma/v0.1
```

The bounded 1B schema also accepts one optional `plugins` sequence of unique plugin IDs:

```yaml
schema: groma/v0.1
plugins:
  - official.optional
```

`schema` and `plugins` are the only keys. The parser rejects invalid UTF-8, aliases,
custom tags, duplicate keys or plugin IDs, non-scalar entries, unknown keys, and more
than 64 requests. Requests are sorted by code unit for deterministic selection. Built-in
Phase 1 plugins remain the required local profile; requested Host-owned official plugins
are added when available. An unavailable official ID produces
`runtime-plugin-unavailable`. A project ID produces `project-plugin-validation-required`
and executes no project code.

The local discovery provider uses the same provider-relative
`groma/groma.yaml` locator on macOS arm64, Linux x64, Windows x64, and Windows arm64.
Pure target-convention validation uses POSIX paths for macOS/Linux and Windows path
rules for both Windows architectures, while Core sees neither paths nor YAML.

Zero candidates is the typed missing-workspace state. Multiple candidates fail with
`workspace-discovery-conflict`; invalid YAML fails with
`workspace-configuration-malformed`; and competing single-provider Phase 0
capabilities fail with `bootstrap-provider-ambiguous` before any provider starts.

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

`HostSurfaceContext.initialization` is a frozen initialization-only view of the shared
`ApplicationOperations` instance. The host exact-validates the complete application
surface and captures `initialize` with its original receiver at composition time, so a
missing-workspace surface can call `initialization.initialize({})` without receiving any
other operation authority.

`WorkspaceAccessCapability.requireWorkspace()` is the only gate to the complete
semantic-operation surface provided to surfaces. It returns the shared
`ApplicationOperations` instance only after configuration is compatible and
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

The Host contains no HTTP server, React bundling, dynamic project import, package
acquisition, trust storage, or unvalidated project-code execution.
