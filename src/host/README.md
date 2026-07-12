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
and preserves incompatible state. A compatible marker is idempotent.

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

## Lifecycle

`runHost` installs the injected signal source and optional cancellation listener before
composition. Cancellation during composition or recovery prevents surface dispatch.
Once a surface session exists, normal completion, failure, cancellation, and SIGINT or
SIGTERM all converge on one awaited `stop()` call. Signal and cancellation listeners
are removed on every exit path. `createProcessSignalSource` is the built-in process
adapter; the CLI is not wired to it in 1A.

The 1A host contains no HTTP server, React bundling, project plugin discovery, dynamic
project imports, or untrusted project-code execution.
