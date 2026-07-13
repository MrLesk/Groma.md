---
id: GROM-18
title: Verify and package the complete Iteration 1A walking skeleton
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-11 17:35'
updated_date: '2026-07-13 14:00'
labels:
  - integration
  - verification
  - release
milestone: m-1
dependencies:
  - GROM-6
  - GROM-17
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Close Iteration 1A with a black-box correctness and durability suite over the compiled executable. Prove the complete initialize, mutate, persist, restart, query, conflict, recovery, and terminal-view path from a clean checkout without relying on Bun or internal modules at runtime.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 From a clean checkout, the documented command produces one standalone groma executable and the full verification suite passes
- [x] #2 A black-box scenario initializes a temporary workspace, creates multiple domain roots and recursively nested same-type and mixed-type components with sparse and rich intent, connects components across branches, lists and reads them, updates one with an expected revision, and reloads identical semantics after process restart
- [x] #3 Repeating serialization without semantic changes produces no canonical byte changes and moving, reparenting, or renaming a component preserves its stable identity
- [x] #4 A stale revision, containment cycle, multiple-parent attempt, invalid ordinary relation, ambiguous target, malformed document, and missing workspace each fail with the expected nonzero diagnostic and no unintended canonical changes
- [x] #5 Crash injection at every journal phase followed by a new process exposes exactly the complete old or complete new graph and permits subsequent valid work
- [x] #6 The bare terminal entry point renders only bounded hierarchy data and the noninteractive modes remain deterministic and nonstreaming
- [x] #7 One runner cross-compiles and verifies exact standalone artifacts for macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64, runs the full supported 1A workflow without a separately installed Bun runtime on the host-compatible artifact, and makes no unsupported native-runtime claim for the other targets
- [x] #8 Milestone documentation states that scanners, automatic architecture generation, projection, dynamic plugin loading, plans, history, HTTP, and React UI remain later-iteration work
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Refactor the standalone compile invocation into one reusable script helper, then add a documented verify:1a command that builds and smoke-checks the production executable before running a root tests/iteration-1a black-box suite.
2. Drive the native compiled groma process only through public CLI requests to initialize a temporary workspace; create multiple roots and recursive same-type and mixed-type children with sparse and rich intent; relate branches; page, read, update, rename, reparent, and restart; compare stable JSON semantics, identities, resource locations, and canonical bytes.
3. Add a failure matrix for missing workspace, stale revision, containment cycle, multiple-parent-shaped input, invalid relation target, ambiguous targeting of one relationship by multiple changes, malformed JSON, and malformed canonical Markdown; snapshot the canonical tree around every failed command.
4. Compile a separate verification-only CLI entry that passes an explicit LocalResourceFaultInjector through default host composition. Exercise prepared, committing, partial-target, settlement, replacement-durability, and removal-durability crash boundaries in real child processes; restart with the production binary, assert exactly the old or new complete graph, and perform a subsequent valid mutation.
5. Verify bounded deterministic bare and noninteractive behavior through the compiled binary, using a native PTY when the host provides the standard script utility and keeping exact non-PTY coverage portable.
6. Keep the four-target single-runner cross-compilation matrix, run the complete workflow only for the host-compatible artifact, and document the distinction from native runtime verification along with all deliberately deferred post-1A features.
7. Run focused verification, the full clean-checkout quality command, all four target builds, exact CLI/host compile checks if affected, diff checks, independent review, and the required ready PR, Claude, Codex, and CI gates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter classification: L2 cross-boundary release verification. Reuse the CLI JSON envelope, default-host composition, local resource fault injector, and existing real-process journal crash matrix. Preserve two boundaries: the production executable receives no ambient crash control, and cross-compilation is artifact verification rather than a claim of native Windows or macOS runtime durability testing.

Implemented the first verification slice. A reusable standalone compiler preserves the production build flags; default host composition accepts an explicit verification-only resource fault injector; and tests/iteration-1a compiles a separate crash entry so the shipped groma binary has no ambient crash control. The native black-box suite now passes the complete recursive workflow, deterministic and bounded terminal/nonterminal behavior, canonical byte and stable-locator checks, the exact failure matrix, malformed canonical state containment, and 15 real-process crash cases spanning prepared, committing, target replacement, idle settlement, and deletion durability boundaries. After every crash, the production binary recovers the exact old or new graph and commits subsequent valid work.

Plan correction from implementation evidence: the 1A surface deliberately accepts exact stable identities rather than names or paths, so the ambiguous-target case uses one existing relationship ID in both remove and upsert. The application rejects that exact duplicated mutation target with ambiguous-relationship-mutation before any canonical write; no name-resolution contract was invented.

Acceptance criterion 7 was corrected to the previously approved GROM-6 policy after the final audit found stale native-runner wording. Alex explicitly chose single-runner Bun cross-compilation over native runners; every artifact remains promised and verified, the compatible artifact runs the workflow directly, and documentation distinguishes cross-compilation from native runtime certification.

Exact-worktree validation: bun ci confirmed the locked dependency graph with no changes; bun run check passed formatting, strict types, architecture boundaries, 446 unit tests / 2,926 assertions, native standalone build and smoke, the complete compiled-binary workflow, malformed-state containment, PTY behavior, and 15 real-process crash/recovery cases. bun run check:targets cross-compiled Darwin arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64, verified exactly one standalone artifact for each, ran the complete non-crash workflow directly on the compatible Darwin artifact, and restored the native binary. Semantically identical rich-item serialization preserved exact intent bytes and content revision; rename and reparent preserved stable ID and resource locator. Every expected failure preserved the complete groma tree byte-for-byte. git diff --check passes.
<!-- SECTION:NOTES:END -->
