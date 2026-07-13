# Application Operations

Presentation-neutral semantic operations shared by CLI, service, and web surfaces.
Operations depend on capabilities and never call storage implementations directly.

`createApplicationOperations` is the shared entry point. Its read surface currently
provides atomic workspace initialization, exact component reads with bounded outgoing
relationships, and deterministic bounded pages for all components, roots, and direct
children. Every page is bound to a graph generation and query context through Core's
opaque continuation cursor contract.

Application code sees stable component identities and content revisions, but never a
canonical resource locator. A host injects the transaction snapshot, transaction
execution, resource-mapping, graph, query, Standard Model, and workspace-initializer
capabilities. Page reads confirm resource revisions in a second snapshot and retry a
configured number of times if the generation changes; empty canonical state remains a
valid empty graph because bootstrap representation belongs to the host.

`createApplicationSnapshotStateDecoder` is the single application-boundary decoder for
provider snapshot state. `ApplicationOperationsOptions` requires that explicit
capability, and every read reuses the injected instance. Operations accept only the
frozen decoder object returned by that factory; forged, wrapped, and proxied lookalikes
are rejected during construction before provider access. Decoder provenance registration
is private to the factory module; consumers can read compatibility metadata but cannot
brand another object. Its GraphKernel and Standard Model identities and its component,
diagnostic, embedded-item, relationship, snapshot-depth, and snapshot-value bounds must exactly match
the application composition. The decoder owns its immutable runtime proxy-detection
policy; the default host shares that exact proxy-aware instance with application reads
and startup recovery, so
bounded copying, GraphKernel loading, Standard Model parsing, relationship endpoints,
duplicates, and containment invariants cannot drift. Its deterministic Standard Model
invariant is constructed once with the decoder rather than per read. Decoder results are
exact-inspected and copied inside one exception boundary. Diagnostic arrays, records, and
details are copied only from bounded own data descriptors, and unexpected decoder faults
or malformed results become one frozen `application-snapshot-decode-failed` diagnostic
without retaining error data. Construction also snapshots and freezes every injected
capability reference, scalar, and bound, so later caller mutation cannot change an
operation instance's composition.

The same factory-owned decoder boundary owns every Standard Model call used by
mutations: normalization, patching, parsing, and relationship viewing. It copies model
inputs before invocation, contains thrown, malformed, and native-Promise results, applies
decoder-owned proxy detection before reflection, and copies complete model outputs under
the snapshot depth and value bounds. Normalization binds both the expected presence and
value of a caller-supplied identity before graph, provider, resource-mapping, or execution
work; patching binds the target identity and canonicalizes the full merged entity through
the same parse boundary. Only frozen application-owned drafts, entities, canonical
components, and canonical relationships escape. Relationship inputs are copied and
deeply frozen before model viewing, and transaction upserts are rebuilt only from the
decoder-returned canonical relationship, so model mutation cannot alter the executed
payload. Every decoder method also limits failure diagnostics to the configured
application count; oversized or malformed model diagnostics collapse to one stable
generic failure. Create and sparse-update operations do not call Standard Model
capabilities directly.

Standard Model capability successes are also untrusted boundary values. The snapshot
decoder exact-inspects component, item, extension, and relationship records; binds their
identities, kinds, types, and endpoints back to the resolved graph; rejects proxies before
reflection; applies the embedded-item bound independently to each component across its
combined inputs, outputs, and actions; and retains one aggregate structural budget over
the complete snapshot and canonical model-success envelope. It then uses
Core's graph-data copier to create the only values that may escape, with every nested
array, item, extension, component, and relationship application-owned and frozen.
Malformed native-Promise model outputs are observed with module-captured Promise and
reflection intrinsics. Observation temporarily shadows and then exactly restores a safe
own constructor descriptor using a private frozen species carrier, so hostile own or
inherited `then`, `constructor`, and subclass species accessors cannot leak late
rejections. A fixed own constructor pointing at the captured Promise is observed only
while its species descriptor still exactly matches the module-initial intrinsic;
other non-shadowable constructors fail closed.
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
Resource mapping is also a containment boundary: mapper failures become one generic
component-scoped diagnostic, and mapper messages, details, locators, and keys never
reach application callers.

Each composition supplies explicit application bounds for component and relationship
state, relationship mutations, embedded items, diagnostics, request-data structural
depth and values, and snapshot structural depth and values. Create and update mutation
data—including component items and extensions plus outgoing relationship descriptions
and extensions—is copied within one total request budget before model, identity, graph,
provider, or transaction work. `maxEmbeddedItems` limits each component's combined
inputs, outputs, and actions on both writes and reads; `maxSnapshotStateValues` remains
the aggregate whole-snapshot structural bound. Sparse updates retain the early raw-patch
preflight before provider access and validate the final model-merged component again
before relationship planning or transaction execution, so omitted arrays cannot bypass
the combined per-component bound. Construction also enforces absolute ceilings
(including snapshot retry count), so hostile arrays and payloads fail before unbounded
copying, identity minting, graph loading, or transaction execution.
Auto-generated component IDs are minted against the validated current graph, and
committed outcomes are accepted only when their affected identity sets exactly match the
submitted transaction.
