# TASK-173 scanner study

## Decision

The safest tested scanner is the conservative control: treat every recognized TypeScript file as file-level evidence and do not infer multi-file component ownership from imports.

The production follow-up should combine that evidence with curation-preserving batch reconciliation:

1. A TypeScript scan returns one complete snapshot of recognized files and symbols.
2. Existing component membership in architecture Markdown remains authoritative.
3. Reconciliation refreshes the complete snapshot in one batch, preserving curated multi-file components.
4. An unknown file starts as a singleton component until an explicit architecture action groups it.

`(scanner, file)` is an evidence key, not an architecture identity. Import resolution may support placement and relationships, but it must not silently decide ownership.

## Trial result

Both strategies ran five times against the same frozen copies of Groma, Backlog.md, and codex-hackathons. All 30 runs were stable.

| Repository | Control components | Private-callee components | Maximum files in one trial component | Known same-responsibility pairs grouped | Scanner-assigned files |
| --- | ---: | ---: | ---: | ---: | ---: |
| Groma | 53 | 35 | 12 | 2 | 63 / 115 |
| Backlog.md | 56 | 44 | 7 | 0 | 111 / 197 |
| codex-hackathons | 14 | 12 | 3 | 0 | 29 / 535 |

Across the eight same-responsibility examples, the control fragmented two and left six unresolved. Private-callee grouping joined those two Groma examples and left the same six unresolved, so its sampled fragmentation improvement did not extend beyond Groma.

The small frozen expectation list reported no false merge among 12 different-responsibility examples, but 11 were unresolved. Full semantic review found false merges outside that sample:

- Groma merged Accept with Scan reconciler.
- Groma merged terminal Projection with Projection routes.
- A 12-file Render cluster absorbed the separately documented Iso map and Iso camera responsibilities.
- codex-hackathons merged photos, images, and public cache after 1,967 unresolved internal-looking imports hid outside consumers.

Exclusive private-callee grouping is therefore rejected. Import ownership does not reliably mean shared responsibility, and repeated fixpoint merging amplifies an early mistake.

A proposed pure one-target re-export trial was not run because the frozen component candidates contained no qualifying positive pair. It would have reproduced the singleton control without testing grouping behavior.

## Wilderness limits

- TypeScript project resolution can be incomplete when generated configuration is absent. The codex-hackathons snapshot has four missing `.nuxt` project references.
- TypeScript 7 exposes the compiler API used by the trial under unstable entry points. The pinned trial proves repeatability only for this corpus and runtime.
- The expectation list is small and retrospective. The complete output audit, not the sampled score, decides the result.
- The three repositories are useful stress cases, not proof for every TypeScript project.

## Evidence

The deterministic archive in [`evidence/`](evidence/) contains the exact frozen repositories, manifest, 30 raw runs, reports, audits, runner, strategies, expectations, and six required cold review records. It is the reproducible research record; rejected strategy code is intentionally not kept live in the product tree.
