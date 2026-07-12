---
id: GROM-16
title: Compose the Iteration 1A default local host
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-11 17:35'
updated_date: '2026-07-12 23:03'
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
<!-- SECTION:NOTES:END -->
