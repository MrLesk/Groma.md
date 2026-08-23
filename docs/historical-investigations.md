# Historical investigations

These branches preserve disposable investigations that informed Groma's current
plans. They are evidence, not implementation branches, and must never be merged
into `main`.

## Semantic-zoom renderer selection

- Branch: `spike/semantic-zoom-renderer-selection`
- Commit: `54d8fd05b2f7798582456622f14b45c0def8dbff`

This investigation asked which MIT-licensed browser graph renderer could
present one fixed, nested C4 world with continuous camera zoom and global
Context, Containers, Components, and Code emphasis without relayout or geometry
jumps.

Its durable conclusions are:

- Interaction must be defined and approved before selecting a renderer.
- C4 levels are views of one fixed world, not separately laid-out diagrams.
- Renderer selection must consider interaction fidelity and visual quality
  before isolated benchmark numbers.
- One candidate reproduced the approved interaction and was the smallest
  step from the web viewer of that time; that direction was abandoned.

The branch retains the candidate inventory, comparison implementations,
benchmarks, withdrawn decisions, and disposable proof applications. It records
an abandoned web-viewer direction; none of the branch contents are merge
material.

## OpenTUI viewer

- Branch: `spike/groma-tui`
- Commit: `8b786ed5ac8ad1a5bd2414c9b424511c851e985a`

This investigation asked what Groma's architecture navigation becomes in a
terminal where cards cannot scale continuously and pointer-driven camera
controls are inappropriate.

Its durable conclusions are:

- The complete application state can be expressed as `(level, selection)`.
- Arrows traverse peers and can escape a boundary by ascending, Enter descends,
  and Backspace ascends to the parent.
- Same-level arrows pan just enough to keep the selection visible and do not
  change zoom. Leaving a boundary *is* zooming out.
- Each element needs a representation ladder selected by its available cell
  budget.
- Terminal rendering should inherit the terminal theme rather than reproduce
  the browser palette.

The branch retains the disposable OpenTUI implementation, verified API notes,
and design learnings. The [TUI viewer page](viewers/tui/index.md) describes
the interaction that survived review; the spike is evidence and was rebuilt,
not merged.

## Semantic-zoom viewer rebuild

- Branch: `wip/semantic-zoom-viewer`
- Commit: `8a7daca48e19ca59357cda9771e62734c68c6f3c`

A snapshot, committed on 2026-08-02, of an in-flight semantic-zoom web
viewer rebuild and its evidence: 111 files of candidate proofs, benchmarks,
tests, and viewer changes. It is evidence only and is not merge material.
