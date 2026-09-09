---
id: TASK-326.10
title: Deliver an official Vue scanner with compiler-backed framework evidence
status: Done
assignee:
  - '@scanner_vue'
created_date: '2026-09-09 12:59'
updated_date: '2026-09-09 13:20'
labels:
  - scanners
dependencies:
  - TASK-326.8
references:
  - TASK-326.9
  - scanner-index-5
  - scanner-project-2
  - evidence
  - scanner-build-5
  - scanner-smoke-compiled
documentation:
  - docs/scanners/evidence.md
  - docs/scanners/creating-a-plugin.md
  - docs/component-markdown.md
modified_files:
  - plugins/scanners/vue/package.json
  - plugins/scanners/vue/src/project.ts
  - plugins/scanners/vue/src/evidence.ts
  - plugins/scanners/vue/src/index.ts
  - plugins/scanners/vue/build.ts
  - docs/scanners/vue/index.md
  - docs/scanners/vue/validation.md
  - test/fixtures/vue-output/package.json
  - test/fixtures/vue-output/tsconfig.json
  - test/fixtures/vue-output/Emitter.vue
  - test/fixtures/vue-output/Host.vue
  - test/fixtures/vue-output/receiver.ts.fixture
  - test-bun/vue-scanner.test.ts
  - plugins/scanners/vue/.gitignore
  - plugins/scanners/vue/smoke-compiled.ts
  - bun.lock
parent_task_id: TASK-326
type: feature
ordinal: 372000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Developers can install a separate Vue scanner alongside embedded TypeScript and obtain useful framework evidence through the existing discovery, readiness, scan, and architecture-review journey. Follow the established Angular plugin approach: use maintained compiler, parser, and semantic tooling; preserve Groma's embedded TypeScript 7.1 SDK; keep compatible tooling local to the plugin where required. Do not create a competing language name/type resolver.

Start with one small real-project interaction and one independent fixture. The first investigation should establish a single-file component template event and its explicitly supplied parent handler, its exact original source locations, and the limits of the selected analysis tooling. Present the concrete source witnesses and bounded extraction plan to the coordinator before implementation; implement only that approved slice. Do not generalize to state stores, routing, server components, dependency injection, all framework APIs, or cross-service communication without an approved example.

Framework constructs and compiler objects are temporary evidence, not automatic C4 components or new OKF concepts. Existing core owns architecture inference, source ownership, complementary evidence, conflicts, and Markdown. Preserve one physical-file owner across scanners; uncertain claims must not become certain relationships. Source and supported template/JSX edits participate in rescans, and failed enabled scans preserve the previous architecture.

Deliver a real installable packed artifact and compiled-Groma consumer proof with the required project tooling documented. Public names, publication, and additional-platform release qualification remain coordinated in TASK-326.7; do not claim unexecuted or unpublished support.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A separate Vue plugin loads and runs in compiled Groma alongside embedded TypeScript without replacing its compiler SDK.
- [x] #2 Maintained Vue/language tooling establishes project membership and supported identities; exact tool and project versions are documented and missing prerequisites produce actionable readiness results.
- [x] #3 One coordinator-approved a single-file component template event and its explicitly supplied parent handler contributes concrete shared-contract evidence beyond the ordinary language scan; unsupported or ambiguous cases are explicit and original source positions are correct.
- [x] #4 Overlapping scanner contributions preserve one curated physical-file owner and reuse the existing complementary/conflicting-evidence rules without a plugin-priority winner.
- [x] #5 Supported source/template edits rescan, repeated scans preserve curated ownership and authored relationships, and an enabled scanner failure preserves the previous complete map.
- [x] #6 An independent fixture and one pinned real Vue project pass the packed-artifact consumer journey and coordinator map review; documentation states the exact supported scope and remaining qualification limits.
- [x] #7 Focused tests, the repository check, implementer specification/quality reviews, cold simplicity review, and final full-context review pass before technical acceptance.
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
1. Obtain coordinator approval for the pinned vuejs/repl CodeMirror change event and independent SFC fixture. 2. Use pinned Vue language-core and Volar TypeScript program/source mappings to extract static imported SFC event-to-immutable-function evidence through the existing SDK. 3. Package the plugin with its private compiler and helper declarations; validate readiness, deterministic positions, overlapping ownership, repeat/watch edits and failure preservation. 4. Run the real pinned project through a packed artifact in compiled Groma, document source/map evidence and qualification limits. 5. Complete focused checks and implementer reviews; coordinator runs cold simplicity, shared check, map review and full-context review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research uses /tmp/groma-task32610-repl at 9b5bc873415bbc6fcba6080b9402d140175d5b03 and isolated /tmp/groma-task32610-tooling. Vue language-core 3.3.11, Volar TypeScript 2.4.28, compiler 3.5.42 and TS 5.9.3 successfully resolve CodeMirror template import and onChange signature through generated source mappings. Awaiting coordinator approval of bounded slice before source implementation.

Coordinator approved pinned Vue REPL CodeMirror witness and bounded static-import, typed literal event, direct immutable source-handler slice. Implemented Vue language-core/Volar-backed program, compiler-owned membership, source mappings and TypeScript symbol/signature resolution. Allowing compiler non-TS roots is required for configured standalone SFC fixture; typed bridge isolates hoisted compiler declarations while runtime bundles plugin TS5.9.3. Four concurrent package fixture tests pass (27 assertions); scanner lint and root typecheck pass. Actual npm-packed consumer passed on fixture and pinned REPL with compiled /tmp/groma-react-research/groma. Evidence: /tmp/groma-task32610-fixture-proof and /tmp/groma-task32610-real-proof (validation.json, commands.json, map). Real repeated 43 documents and fixture eight documents unchanged; source/template removal, restoration, overlap and failed-scan preservation passed. Original source/template restored. Awaiting coordinator cold simplicity review, then implementer specification/quality reviews, serialized full check and final full-context/map acceptance.

Cold simplicity review passed without findings. Implementer specification review: AC1-5 supported by packed compiled-consumer evidence and four fixture tests; AC6 real map approved by coordinator at http://127.0.0.1:48328/?relationship=core-codemirror/codemirroreditor (curated responsibility, correct callback direction and Vue provenance). AC7 awaits shared full check and final full-context review. Quality review found no reproducible supported-flow defect or unnecessary domain abstraction; source maps/TS symbols own identity, core owns inference, no new schema or lifecycle behavior. One post-install watcher test hit a 20-second timeout; two traced unchanged-scenario runs showed prompt native watch dispatch and complete preservation checks, and final instrumentation-free run passed all four tests/27 assertions in 1.90s. No timeout increases, assertions removed, retries or production watcher changes. Root cause of the isolated timeout is not established; record retained for shared-suite validation. Scanner lint and root typecheck pass. Final packed artifact /tmp/groma-task32610-final-artifact/groma-scanner-vue-0.1.0.tgz has SHA256 8d248d946f6aedec3266d6df0c51b12c3f321c71079e43261055fe4beff41da4; its bundled runtime is byte-identical to both proved consumer artifacts (SHA256 4f0547260d159f9c862010531e73fc4297d3c5a668c5b6566d05b007da52d037). Current live scan now resolves plugin files to scanner-index-5, scanner-project-2, evidence, scanner-build-5 and scanner-smoke-compiled; references recorded.

Final coordinator gates passed: full-context review required no changes; real browser map review approved the selected CodeMirror callback, responsibility and Vue provenance. Shared bun run check passed with 110 Node tests and 398 Bun tests passing, seven existing tooling-dependent skips, zero failures and six pre-existing complexity warnings. Vue watcher passed in the shared suite. The earlier isolated 20-second focused timeout investigation remains recorded without a claimed root cause; no assertions/timeouts were weakened and no retries were added. Validation documentation updated only; no additional code checks required. Task remains In Progress pending coordinator serialization of finalization and scoped commit.

Coordinator technical acceptance is complete. Actual packed fixture and pinned Vue REPL journeys, original-source positions, curated ownership, complementary evidence, source/template rescan, failure preservation and rendered-map review all pass. Cold, implementer specification/quality and full-context reviews pass; shared repository check passes at /tmp/groma-vue-react-check.log. The shared artifact-registry helper is committed under TASK-326.7. This commit stages only Vue-owned lock additions; React additions remain for TASK-326.11. Public publication and additional-platform release qualification remain TASK-326.7.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered a separate compiler-backed Vue scanner for the approved typed SFC event-to-parent-handler interaction. Vue/Volar source maps and plugin-private TypeScript preserve original positions without changing embedded TypeScript. Verified actual packed fixture and pinned Vue REPL consumers, source/template edits, curated ownership, failed-scan preservation, rendered map, all reviews and the shared repository check. Local macOS arm64 technical acceptance is complete; public and other-platform qualification remains separate.
<!-- SECTION:FINAL_SUMMARY:END -->
