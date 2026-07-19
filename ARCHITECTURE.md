# Groma Architecture

The [Manifesto](MANIFESTO.md) is authoritative. This document describes the architecture that
exists in the repository today. It does not claim that the public scan or visual workflow has
shipped.

## The shortest path

Groma is being built around one local workflow:

```text
groma init -> groma scan -> groma
```

`groma init`, the canonical read/write foundation, and built-in TypeScript/Bun scan reconciliation
exist behind the Host composition. The public `scan` command and visual renderer remain the next
vertical slices.

## Semantic boundary

Groma promises deterministic behavior for bounded local projects and inputs that its scanners can
classify without guessing. Scanner syntax may be reported as partial or unsupported. Groma does not
attempt whole-program alias, mutation, or runtime capability analysis.

The load-bearing invariants are:

- opaque stable identity is independent of names, paths, and layout;
- curated intent and scanner evidence are separate;
- scanners cannot read canonical intent or prior evidence;
- failed, cancelled, incomplete, or ambiguous scans publish no replacement snapshot;
- canonical state is readable, deterministic, locally owned, and atomically published;
- canonical components and relations are separate from disposable visual nodes;
- every read, scan, and projection has explicit bounds;
- source and canonical data stay local unless a future explicit feature says otherwise.

## Dependency direction

```text
Core <- Standard Model <- Application <- Host <- CLI
  ^            ^               ^          ^
  +------ Plugin SDK           +------ Persistence
```

- `src/core` owns identity, bounded graph values, observations, transactions, plugin lifecycle,
  diagnostics, and query contracts. It knows no filesystem, scanner syntax, or presentation.
- `src/standard-model` defines Groma's current component and relationship vocabulary plus the
  transaction invariant for that vocabulary.
- `src/application` composes use cases over capabilities. It does not own storage or UI.
- `src/persistence` provides local resources, readable Markdown intent, aliases, atomic canonical
  transactions, one readable evidence document, and an in-memory disposable projection rebuilt
  from canonical reads.
- `src/plugin-sdk` exposes the blind scanner contract and the Core types needed to implement it.
- `src/host` composes the built-in providers, owns local project/source access, and contains one
  bounded scan run.
- `src/cli` parses and renders the currently supported command surface.

The boundary checker enforces this direction and rejects unverifiable dynamic production imports.

## Canonical state and publication

Canonical intent is stored as human-readable Markdown under `groma/`. Stable IDs determine durable
locations; names and containment do not. Alias records preserve explicit identity continuity.
Application mutations prepare a complete transaction and publish atomically through the local
transaction provider. An uncertain filesystem result is reported as indeterminate rather than
guessed.

Completed observations and their source-owned bindings are stored in one deterministic
`groma/evidence.md` document. Reconciliation creates ordinary canonical automatic components with
opaque IDs, reuses exact source/scope/key bindings across scans, and refreshes an automatic field
only while its current value still equals the prior observation. Curated overrides and conceptual
parents therefore survive later scans. Evidence, component changes, relationships, and projection
notification share one transaction.

Schema migration is intentionally absent before a real incompatible release exists. The current
schema is exact-validated and fails closed when unsupported.

## Blind scanning

The built-in TypeScript/Bun scanner receives only a bounded project resource capability and its
scanner configuration. It cannot read canonical intent, prior evidence, visual state, or another
scanner's output.

One Host scan run creates an in-memory finite observation session. Batches become publishable only
after the scanner completes the session. A completed session may report partial coverage; omissions
remove scanner-owned relationships or mark bindings missing only for the exact scope and record kind
whose coverage is complete. Failure, cancellation, timeout, an incomplete session, or malformed
output produces no completed snapshot and never invokes reconciliation. Provisional batches,
heartbeats, recovery lanes, and observation journals are not durable.

Cancellation is accepted until completed-snapshot publication begins. Once the atomic reconciliation
handoff starts, the run waits for publication and reports its real completed or failed outcome; it
never reports cancellation while a detached write can still commit later.

This is a same-process trusted composition with ordinary boundary validation. Groma does not defend
against a plugin deliberately mutating JavaScript intrinsics or using Proxy traps inside the same
process. Supporting third-party package acquisition or stronger isolation requires an explicit
future product and security decision.

## Disposable projections

The projection index is an in-memory read model reconstructed from a bounded canonical transaction
snapshot. It owns no canonical meaning. On a committed generation it rebuilds deterministic entity,
catalog, relationship, search, and adjacency reads and derives a content fingerprint. It has no
durable chunks, Merkle tree, repair protocol, checkpoint, or second semantic path.

Renderers must consume bounded shared application reads. Layout, folding, focus, zoom, theme, and
visual nodes never enter canonical state.

## Local resource boundary

The local resource provider applies portable locator validation, path containment, explicit byte and
page limits, symlink rejection, and atomic replacement. The canonical transaction journal exists
only to preserve atomic canonical publication and recovery; it is not a general durability framework.

Groma performs no upload by default. Cross-compilation verification checks that target artifacts are
non-empty and executable on the compatible host; it does not maintain custom Mach-O, ELF, or PE
parsers.

## Deliberately absent

The current architecture does not include local plugin package acquisition, scaffolding, trust
ledgers, SDK certification, schema migration catalogs, durable observation recovery, evidence
sharding, persistent projection repair, an automatic-blueprint certification benchmark, or a frozen
self-blueprint fixture. Reintroducing one of these requires evidence from the thin product loop and a
clearer benefit than its maintenance cost.
