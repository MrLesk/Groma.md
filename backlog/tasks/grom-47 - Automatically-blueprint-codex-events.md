---
id: GROM-47
title: Automatically blueprint codex-events
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:58'
updated_date: '2026-07-19 20:51'
labels: []
milestone: m-4
dependencies:
  - GROM-34
  - GROM-43
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
  - 'https://github.com/MrLesk/codex-events'
modified_files:
  - src/host/typescript-bun-scanner.ts
  - src/host/tests/typescript-bun-scanner.test.ts
  - src/cli/tests/scan.test.ts
  - src/host/README.md
  - groma
priority: high
type: task
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the clean public init -> scan -> blueprint loop produce a useful evidence-grounded view of codex-events. The real first run currently emits 64 package/documentation observations but reconciles only the package because Nuxt's root TypeScript configuration is a generated project-reference aggregator with files: [] and its referenced .nuxt configs do not exist in a clean checkout. Recognize that bounded clean Nuxt convention, scan the repository's real TypeScript sources, and expose only explicit method-suffixed server/api route modules as public actions. Keep generated configuration, Vue SFC semantics, Nuxt aliases, and ambiguous route forms partial rather than guessed. This is a direct first-run slice, not generalized framework inference.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A clean shallow codex-events snapshot initialized with the compiled public CLI scans to a non-empty bounded blueprint containing its package, real TypeScript source boundaries, dependencies, documentation, exact provenance, and explicit method-suffixed server API actions without manual correction
- [x] #2 Only the bounded clean Nuxt aggregator shape is accepted: files is empty, references point to the known generated .nuxt TypeScript configs, and a root nuxt.config TypeScript marker exists; malformed, mixed, or near-miss configurations remain fail-closed
- [x] #3 Explicit server/api route filenames produce deterministic HTTP method and path actions through the existing action/evidence path, while ambiguous route forms make no route claim
- [x] #4 Generated .nuxt configuration, Vue single-file components, framework-provided aliases, and other unsupported semantics remain explicitly partial rather than guessed
- [x] #5 An unchanged codex-events rescan is byte-stable, a failed scan preserves the last complete blueprint, and the disposable source remains unchanged outside its generated groma workspace
- [x] #6 Focused regression fixtures, compiled codex-events dogfood, Groma self-scan, and the full repository gate demonstrate the supported boundary without a framework plugin layer, fallback scanner, or benchmark scorecard
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a narrow parser result for the clean Nuxt project-reference aggregator and activate it only when the exact generated .nuxt reference shape and root nuxt.config TypeScript marker are both present. 2. Reuse existing inventory, boundary, action, provenance, reconciliation, and visual paths; add explicit method-suffixed server/api route actions without a second semantic model. 3. Cover accepted and near-miss configurations, route naming, unsupported Vue/generated/alias coverage, deterministic rescans, and last-complete preservation with focused fixtures. 4. Build the compiled CLI and dogfood a disposable clean codex-events clone, inspect its bounded visual/export output, rescan byte-stably, and verify no source changes outside groma/. 5. Run the full gate, then exactly two Terra xhigh reviews and one Claude review before one ready PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Clean dogfood at codex-events commit f67c033334863ce77acf97128451528d661dfd67 showed the exact first-run gap: the compiled CLI emitted 64 records but reconciled only the package because the root Nuxt tsconfig is an empty-files aggregator whose generated .nuxt references are absent in a clean checkout. A diagnostic source-universe run exposed the repository's real TypeScript boundaries and then localized a second issue: 171 route actions on one api component exceeded the existing 100-member bound.

The implementation recognizes only the exact four-reference clean Nuxt aggregator when a root nuxt.config.ts marker is present. It reuses the existing inventory, parser, evidence, action, reconciliation, component-detail, and visual/export paths. Explicit method-suffixed server/api modules become HTTP actions with file fingerprint provenance. Route structure composes them into public /api/... source areas; dynamic-resource subtrees use their next directory. Conflicting route files make no action claim, and an area above 64 unique routes keeps its component and relationships but omits its actions as partial, so density cannot fail atomic publication. No global limit, framework plugin, fallback scanner, or second semantic path was added. Vue SFCs, generated config, framework aliases, and ambiguous filenames remain partial with no guessed claim. Recognition of shared/ is scoped to the Nuxt gate; unrelated TypeScript solution references are now honestly marked partial because their referenced programs remain unsupported.

The final compiled clean run emitted 475 records and published 92 components (1 package, 58 source boundaries, 33 externals), 149 relationships, and 171 HTTP actions. The largest component has 19 actions. Component detail showed exact action-to-file provenance, including GET /api/events/[eventId] from server/api/events/[eventId]/index.get.ts. Coverage is partial as intended. An unchanged rescan was byte-stable; an invalid scanner configuration failed with zero records and left the 92-component blueprint unchanged; restoring configuration returned to the same complete result. Git status in the disposable clone contained only ?? groma/.

The required pre-PR reviews completed exactly once each. The Terra product/simplicity pass had no findings. The Terra correctness pass found duplicate files mapping to one route; route candidates are now aggregated and every conflicting claim is omitted as partial, with cross-boundary and extension-collision regressions. Claude independently reinforced that ambiguity issue and found dense static API areas could still exceed the host item bound and full filesystem-like area names weakened readability. The final implementation uses public /api/... names and a conservative 64-action area ceiling that degrades to partial rather than failing. Claude's framework-placement note was evaluated as a future product decision, not a blocker: this deliberate first vertical slice remains tightly gated and does not add a framework layer.

Focused scanner and CLI regressions passed 66 tests / 801 assertions, including atomic publication of 120 accepted routes alongside a 65-route area whose actions fail closed without failing the scan. The final complete gate passed 412 tests / 2,755 assertions plus formatting, TypeScript, architecture boundaries, build, smoke, and compiled crash recovery. Final codex-events output repeated byte-stably after the review fixes. Groma's own compiled self-scan advanced once for the changed scanner evidence and repeated byte-stably at generation 137 with 51 components, 139 relationships, and 158 actions.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered the clean codex-events automatic-blueprint slice in PR #52. The exact clean Nuxt generated-reference aggregator now activates existing TypeScript scanning without reading generated state; explicit method-suffixed server routes become evidence-backed HTTP actions grouped into readable /api areas. Conflicting and over-dense areas fail closed as partial without breaking atomic publication. Compiled dogfood produced 92 components, 149 relationships, and 171 actions, repeated byte-stably, and preserved the last complete blueprint on failure. Full CI and the required two Terra xhigh reviews, Claude review, and first automatic Codex review passed.
<!-- SECTION:FINAL_SUMMARY:END -->
