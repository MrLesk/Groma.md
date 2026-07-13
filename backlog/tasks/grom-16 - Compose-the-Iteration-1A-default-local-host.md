---
id: GROM-16
title: Compose the Iteration 1A default local host
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-11 17:35'
updated_date: '2026-07-13 02:27'
labels:
  - host
  - bootstrap
milestone: m-1
dependencies:
  - GROM-5
  - GROM-12
  - GROM-15
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the official 1A composition root for the compiled local executable. It selects the workspace context, assembles built-in capabilities explicitly, performs journal recovery before reads or mutations, dispatches a selected surface, and shuts down cleanly. Full two-phase plugin discovery remains 1B.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The host can start without an initialized workspace so the initialization operation remains available
- [ ] #2 Commands requiring a workspace receive a typed no-workspace diagnostic rather than an implicit empty graph or filesystem error
- [ ] #3 The 1A graph, model, invariants, resources, store, journal, query adapter, operations, and surface are composed through explicit capability interfaces rather than hidden global singletons
- [ ] #4 Startup completes or reports transaction-journal recovery before serving any semantic read or mutation
- [ ] #5 Built-in composition is isolated behind a bootstrap registry that can be replaced by the 1B plugin runtime without changing Core or application operation contracts
- [ ] #6 Cancellation and process signals stop active host work and release local coordination resources deterministically
- [ ] #7 The 1A host does not start an HTTP server, bundle React, discover project plugins, or load untrusted project code
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define host-only process context, typed startup/workspace diagnostics, workspace-access, recovery-report, surface-session, signal-source, and bootstrap-registry contracts without changing Core or shared application contracts.
2. Implement the 1A local workspace capability at groma/groma.yaml with one canonical minimal groma/v0.1 workspace document, bounded strict discovery, same-machine coordination, atomic staged initialization, compatible idempotence, conflicting-state preservation, and no project-plugin loading.
3. Build an explicit default bootstrap registry that wires the Local Resource Provider, Standard Model, Markdown store/adapter, local transaction journal, TransactionEngine plus Standard invariant, GraphKernel with host entropy, bounded queries, resource mapper, shared application operations, workspace capability, and injected surface through named capability fields and aligned bounds.
4. Gate semantic workspace access through a typed requireWorkspace result. Missing configuration returns no-workspace; incompatible configuration returns workspace-configuration-conflict. Initialization remains available and promotes the same session only after configuration establishment plus journal snapshot/recovery succeeds.
5. Run journal snapshot/recovery to completion before dispatching any ready-workspace surface, surface recovery status explicitly, and fail closed without dispatch on malformed state, recovery failure, or cancellation during startup.
6. Implement cancellation and process-signal coordination around an explicit running-surface session. Stop exactly once on normal completion, cancellation, signal, or failure; await deterministic cleanup; unsubscribe handlers in every exit path.
7. Add host-boundary tests for missing, initialized, idempotent, conflicting and malformed workspaces; no-workspace gating; initialization promotion; strict recovery-before-dispatch; recovery failure; explicit capability composition; normal/signal/cancellation shutdown; coordination release; and forbidden HTTP/React/plugin-loading behavior.
8. Document the 1A configuration, composition, lifecycle, and 1B replacement seam; run focused/full checks and four targets, independent specification and quality reviews, then publish a ready task-linked PR and complete Claude, Codex, and CI gates before finalization and merge.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter classification: L2 host lifecycle and composition boundary. Discovery will trace workspace selection, local resource/store/journal composition, shared application operations, recovery ordering, cancellation and signal ownership, and the 1B plugin-runtime insertion point before freezing the plan.

Frozen 1A decisions: process context supplies one absolute workspace root (the CLI may choose cwd in GROM-17); discovery does not search ancestors in this task. The only initialization marker is groma/groma.yaml with a minimal strict groma/v0.1 workspace document. No plugin/package fields are interpreted or executed in 1A. A successful initializer establishes or recognizes that marker and completes the journal snapshot/recovery handshake before the host exposes semantic operations, allowing safe same-session promotion without treating a missing workspace as an empty graph.

Implemented and focused-tested the strict local workspace capability: exact one-line groma/v0.1 discovery, path-free typed missing/conflict/recovery diagnostics, same-machine staged atomic initialization, idempotent same-session recovery promotion, bounded malformed recovery rejection, and deterministic coordination release on failure.

Moved the real local application stack into the default bootstrap registry and migrated the existing application conformance/restart test onto it. The registry exposes named, frozen capability identities; aligns graph/query/model/store/journal/application bounds; injects host entropy and the selected surface; and keeps application/Core contracts unchanged. Strengthened snapshot recovery validation against malformed or structurally unbounded provider state.

Implemented the injected host lifecycle: cancellation/signals are installed before composition; ready workspaces recover before dispatch; missing workspaces dispatch only the workspace gate; active sessions stop exactly once with awaited cleanup; listeners unsubscribe on all exits. Deterministic tests cover normal, signal, startup cancellation, recovery cancellation/failure, surface failure, malformed capabilities, interrupted initialization publication, bounded hostile recovery, and forbidden server/React/plugin-loading paths. Documented the exact 1A marker, registry seam, workspace gate, and lifecycle.

Self-review closed the retryable coordination-release edge: initialization now retains an opaque lease after release failure, blocks promotion, and retries release before later recovery/initialization. Fault-injection proves the diagnostic stays path-free and the same session reaches ready after deterministic release.

Specification-review correction: initialization publication now validates exact replacement outcomes and provider diagnostics, retains the original handle plus coordination lease across thrown, malformed, indeterminate, or unconfirmed-readback outcomes, retries that handle from initialize/recover, and confirms discard before clearing not-committed state. Snapshot input and lifecycle recovery Results/reports are copied from exact bounded data properties into frozen canonical values; hostile accessors, proxies, extra keys, unsafe generations, and malformed successes fail closed before readiness or dispatch. A real replacement-parent-directory-sync fault regression proves same-handle retry and delayed recovery promotion.

Independent quality review hardened the host boundary before handoff: startup and surface diagnostics are now host-owned and path/secret-free; registry, composition, workspace status, recovery, signal cleanup, and surface-session values are exact-inspected without invoking accessors or proxy traps; cancellation is passed into surfaces and races asynchronous start with contained late cleanup. Local initialize/recover calls now serialize in invocation order. Host recovery and application reads share one bounded snapshot-state decoder with GraphKernel, Standard Model, relationship, and containment validation. Windows fixtures omit unsupported custom coordination roots. Focused tests, the full 338-test check, four-target standalone verification, and direct host/application entry compilation for all four supported targets pass.

Specification re-review correction: when cancellation wins while surface.start remains pending, any later valid session now has its completion promise observed immediately before exact-once stop. The detached start observer also contains late malformed/start rejection and stop failure, preventing late secret-bearing completion failures from reaching unhandledRejection. A deterministic regression covers both rejecting and resolving late completion with zero process unhandled-rejection events.

Final quality re-review correction: HostSignalSource cleanup now supports synchronous or asynchronous release, is invoked exactly once, immediately promise-assimilated, awaited before return, and overrides prior outcomes with a frozen host-owned host-signal-cleanup-failed surface failure on throw/rejection. Local workspace transitions now use an active AsyncLocalStorage token to reject same-transition provider reentrancy immediately with workspace-transition-reentrant while preserving FIFO for unrelated external callers. Deterministic tests cover cleanup success/failure/precedence/secrecy/zero-unhandled-rejection, commit and snapshot reentrancy across async boundaries, unpoisoned later calls, and existing overlap behavior.

Claude PR review corrections: all workspace statuses, diagnostics, access failures, initialization outcomes, and recovery reports are now frozen host-owned snapshots; recovery generations use GraphGeneration without casts. ApplicationOperationsOptions now requires one explicit snapshot-state decoder, operations reuse that instance, and the default host shares the exact proxy-aware decoder with workspace recovery and composition; decoder invariant construction is one-time. Confirmed not-committed publication now recognizes a compatible peer marker, runs unlocked recovery, and returns already-initialized. HostSurfaceSession documents exact-once stop after natural completion, and createProcessSignalSource has a process-like injection seam with direct forwarding/idempotent-unsubscribe tests. Focused and full tests, four-target verification, and direct host/application target compilation pass.

Final quality-review correction: application operations now accept only the exact frozen decoder returned by createApplicationSnapshotStateDecoder, verify GraphKernel and Standard Model identity plus exact component, embedded-item, relationship, snapshot-depth, and snapshot-value bounds before provider access, and contain unexpected decoder faults or malformed results behind stable secret-free diagnostics. The decoder owns immutable proxy-policy provenance and enforces embedded-item bounds while loading snapshot state. The process signal adapter now rolls back partial SIGINT/SIGTERM registration and independently tracks successful cleanup so failures remain retryable without duplicate removal. Deterministic regressions cover forged, wrapped, proxied, throwing, and incompatible decoders plus first/second registration and removal faults. Focused application/host tests pass (63 tests, 375 assertions); the full check passes (352 tests, 1941 assertions); four-target standalone verification and direct application/host compilation on all four targets pass.

Specification-review correction after e5095f7: application construction now captures every option field once, validates decoder compatibility and bounds, then freezes an application-owned options snapshot and copied bounds so later caller mutation cannot redirect decoder, graph, model, queries, mapper, initialization, transaction provider/execution, retry count, or limits. Decoder provenance storage and its non-exported recorder now live beside the factory in snapshot-state.ts; only frozen read-only metadata is exported, and the obsolete callable registrar module was removed. The full decode call/result/diagnostic/state canonicalization path is exception-contained, uses decoder-owned proxy policy, bounded dense arrays, and a fixed own-data-descriptor detail allowlist, returning frozen secret-free failures without retaining aliases. Regressions cover option TOCTOU, deep-module registrar absence, hostile proxy/accessor/array/mutable model diagnostics, zero getter/forged-capability invocation, and secret containment. Focused application/host tests pass (66 tests, 402 assertions); the full check passes (355 tests, 1968 assertions); four-target standalone verification and direct application/host compilation on all four supported targets pass.

Specification re-review correction after 03e24a4: the application snapshot decoder now treats every Standard Model success as hostile. A focused public-value validator exact-inspects component, item, extension, and relationship shapes; rejects proxies before reflection; validates IDs, kinds, open tokens, relation types, and graph-bound endpoints; enforces aggregate embedded-item and structural budgets; then runs the complete public envelope through Core graph-data copying so only deeply frozen application-owned values escape. Safe exact model failure diagnostics remain sanitized and useful, deterministic embedded overflows retain application-bound-exceeded, and thrown, malformed, hostile, or promise-backed successes become stable frozen application-snapshot-decode-failed results without secret leakage. Operations additionally require private canonical component/relationship provenance and frozen entries. Regressions cover proxy/accessor/wrong/missing/extra components, nested proxy items/extensions, mutable alias changes, proxy/malformed/mismatched relationships, nested relationship extensions, aggregate limits, and rejecting promise successes; the existing rich-extension and full restart paths remain green. Focused application/host tests pass (70 tests, 460 assertions); the full check passes (359 tests, 2026 assertions); four-target standalone verification and direct application/host compilation on all four supported targets pass.

Final quality-review correction after 28bbeb8: snapshot-state captures the native Promise constructor and Promise.prototype.then at module initialization. Genuine Promise model results and nested success values are now rejected only after immediate observation through Reflect.apply of the captured intrinsic with a non-throwing rejection handler; hostile own or inherited then accessors are never read, and apply failures remain contained behind the frozen application-snapshot-decode-failed result. Deterministic regressions cover rejected parse and relationships results, a rejected success-value Promise subclass with inherited then override, an own throwing then accessor, and a non-native Promise-shaped malformed value, proving zero getter calls, zero unhandledRejection events, and no HOSTILE_UNHANDLED or private secret leakage. Focused application/host tests pass (71 tests, 478 assertions); the full check passes (360 tests, 2044 assertions); four-target standalone verification and direct application/host compilation on all four supported targets pass.
<!-- SECTION:NOTES:END -->
