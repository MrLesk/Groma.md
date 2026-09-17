---
id: TASK-423
title: Reduce duplicate-logic noise in groma lint
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:42'
updated_date: '2026-09-17 06:11'
labels: []
dependencies: []
references:
  - source-operations
  - src-architecture-findings
modified_files:
  - plugins/scanners/typescript/src/source-operations.ts
  - src/architecture-findings.ts
  - docs/architecture-findings.md
  - test/fixtures/call-argument-callbacks/observers.ts
  - test-bun/architecture-findings.test.ts
  - test-bun/lint-command.test.ts
  - docs/scanners/typescript/index.md
type: enhancement
ordinal: 489000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`groma lint` omits anonymous callbacks and very small bodies, yet callbacks written as object properties inside a call, such as `subscribe({ next: ..., error: ... })`, count as named operations. They dominate the findings together with small, similar framework hooks. In callforpapers 40 of 277 finding groups are `next` or `error` callbacks, and 226 findings are near-duplicates rather than identical copies.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Functions written as property values of an object literal passed directly as a call argument are treated as anonymous callbacks and are not compared.
- [x] #2 Near-duplicate findings require a larger minimum body size than identical copies, and the architecture findings documentation states both minimums.
- [x] #3 Independent fixtures cover call-argument callbacks, small near-duplicates and retained identical copies.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. TypeScript scanner (source-operations.ts): comparableName gives a name only to operations core may compare; comparableBody attaches their source range and tokens. Module code, unnamed functions, and functions written as property values (including method shorthand) of an object literal passed directly to a function call, new, or a decorator get no range or tokens and the informational name (anonymous); their operation and invocation evidence is unchanged.
2. Core (architecture-findings.ts): compare every operation that carries tokens; no reserved-name skip list. MIN_COMPARED_TOKENS = 8 gates every candidate, so identical copies need 8 tokens; MIN_NEAR_TOKENS = 24 gates each body of a near-duplicate pair (measured on a clone of callforpapers).
3. docs/architecture-findings.md states the language-neutral rule (named operations, anonymous callbacks for the three invocation forms, initializers, both minimums and why). docs/scanners/typescript/index.md lists which TypeScript operations are compared and the current exceptions (constructors, accessors, non-identifier method names, class-field functions).
4. Fixtures and tests: test/fixtures/call-argument-callbacks covers call and new arguments against retained named copies; the duplicated-logic fixture proves small identical copies are reported and a small near-duplicate is not; synthetic near-duplicate bodies grow past the new minimum.
5. Measure before/after on the callforpapers clone and run bun run check in an isolated worktree.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Contract choice: scanners mark comparable operations by attaching tokens only to named operations, instead of core skipping reserved names ('callback', '(module)'). This keeps a real function named callback comparable, removes the name list from core, and matches TASK-424 subtasks, which ask each scanner to omit anonymous callbacks and initializers. Core still applies both size minimums, so scanners need not filter by size. The anonymous operation names remain informational; relationship inference uses invocation members and file positions, not operation names.

Threshold measurement (callforpapers clone in scratchpad, TypeScript scanner only, since it is the only scanner that emits tokens): before 277 groups (51 exact, 226 near; 1050 instances; 1553 lint lines; 37 groups made only of next/error/complete). After the call-argument rule alone: 208 groups (45 exact, 163 near). Near minimum 12/16/20/24/30/40 gave 138/112/87/72/57/37 near groups. Groups at 16-23 tokens were mostly mirrored hooks (moveUp/moveDown, onMouseEnter/onMouseLeave) and service boilerplate chains; groups at 24-29 were recognizable review questions (makeProposalStateLabels, isProfileComplete). Chose 24. Final: 156 groups (84 exact, 72 near; 404 instances; 632 lint lines), no next/error callback instances. Exact groups rise because near-duplicate clusters no longer absorb exact subgroups.

Verification: bun test test-bun/architecture-findings.test.ts test-bun/lint-command.test.ts (12 pass). The call-argument test fails when the rule is disabled (callbacks appear as extra instances). bun run check passes (biome: only pre-existing diagnostics in other files; tsc clean; node 16 pass; bun 368 pass, 17 skip, 0 fail). Dropped the unreachable identifier branch of the old operationName: operations are only created for executable nodes and source files. packages/scanner/src/index.ts (owned by TASK-410 at the time) keeps its generic token comment; the rule lives in docs/architecture-findings.md.

Cold review applied (coordinator decisions): object literals passed to new now count as call arguments (decorators already did, being calls), with a fixture case and test that fails without it; declaredName renamed comparableName with the requested docstring; the fallback name no longer repeats the node.parent check, so module code and anonymous callbacks share the informational name (anonymous) (no consumer reads it); MIN_EXACT_TOKENS renamed MIN_COMPARED_TOKENS; MIN_NEAR_TOKENS comment and the docs explain the 24-token reason; readyTokens renamed ruleTokens with a synthetic-size comment; TypeScript scanner page lists compared operations and current exceptions instead of changing scanner coverage. Deferred per coordinator: links from docs/scanners/creating-a-plugin.md and packages/scanner/src/index.ts (TASK-410 files).

Re-verification: focused tests 12 pass; bun run check in an isolated worktree at HEAD plus only this task's files passes (biome diagnostics only in plugins/scanners/php/build.ts, test-bun/vue-scanner.test.ts, test-bun/iso-map.test.ts; tsc clean; node 16 pass; bun 363 pass, 17 skip, 0 fail). callforpapers clone unchanged at 156 groups (84 exact, 72 near).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma lint no longer compares callbacks written as properties of an object literal passed directly to a function call, new, or a decorator, and near-duplicates now need 24 tokens in each body while identical copies still need 8. The TypeScript scanner attaches source ranges and body tokens only to named operations, and core compares every tokenized operation without a reserved-name list. docs/architecture-findings.md states the language-neutral rule for the other scanners; docs/scanners/typescript/index.md lists compared TypeScript operations and current exceptions. On a callforpapers clone, findings fell from 277 groups (226 near-duplicates, 37 made only of next/error callbacks) to 156 groups (72 near-duplicates, no callback groups). Verified by the new call-argument-callbacks fixture test (fails without the call and new rules), the near-duplicate minimum test, the lint command test (small identical copies reported, small near-duplicate not), and bun run check in an isolated worktree.
<!-- SECTION:FINAL_SUMMARY:END -->
