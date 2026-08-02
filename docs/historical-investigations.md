# Historical investigations

These branches preserve disposable investigations that informed Groma's current
plans. They are evidence, not implementation branches, and must never be merged
into `main`.

## Semantic-zoom renderer selection

- Branch: `spike/semantic-zoom-renderer-selection`
- Commit: `54d8fd05b2f7798582456622f14b45c0def8dbff`
- Inspect: `git show 54d8fd0`

This investigation asked which MIT-licensed browser graph renderer could
present one fixed, nested C4 world with continuous camera zoom and global
Context, Containers, Components, and Code emphasis without relayout or geometry
jumps.

Its durable conclusions are:

- interaction must be defined and approved before selecting a renderer;
- C4 levels are views of one fixed world, not separately laid-out diagrams;
- renderer selection must consider interaction fidelity and visual quality
  before isolated benchmark numbers; and
- React Flow reproduced the approved interaction cleanly and gave the smallest
  supported path from the existing viewer.

The branch retains the candidate inventory, comparison implementations,
benchmarks, withdrawn decisions, and disposable proof applications. Revision 04
contains the current intended viewer; none of the branch contents are merge
material.

## OpenTUI viewer

- Branch: `spike/groma-tui`
- Commit: `8b786ed5ac8ad1a5bd2414c9b424511c851e985a`
- Inspect: `git show 8b786ed`

This investigation asked what Groma's architecture navigation becomes in a
terminal where cards cannot scale continuously and pointer-driven camera
controls are inappropriate.

Its durable conclusions are:

- the complete application state can be expressed as `(level, selection)`;
- arrows traverse peers and can escape a boundary by ascending, Enter descends,
  and Backspace or Esc ascends to the parent;
- each element needs a representation ladder selected by its available cell
  budget; and
- terminal rendering should inherit the terminal theme rather than reproduce
  the browser palette.

The branch retains the disposable OpenTUI implementation, verified API notes,
and design learnings. Revision 05 contains the current intended terminal
viewer; the spike must be consulted as evidence and rebuilt rather than merged.

## Availability

No Git remote is configured for this repository. These branch names and exact
commit hashes are therefore local historical references until the repository
is published elsewhere.
