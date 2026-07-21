---
id: GROM-102
title: Accept valid large evidence sources in component detail
status: Done
assignee:
  - '@codex'
created_date: '2026-07-21 20:02'
updated_date: '2026-07-21 20:12'
labels:
  - application
  - evidence
  - dogfood
dependencies: []
references:
  - GROM-42
  - GROM-94
modified_files:
  - src/application/operations.ts
  - src/host/tests/reconciliation-local.test.ts
priority: high
type: bug
ordinal: 92000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A valid OpenClaw scan publishes more than one hundred component bindings under the canonical component bound, but component detail reparses that evidence using the smaller per-component embedded-item bound. The canvas renders while every affected detail read fails with invalid-evidence-state. Detail reads must accept evidence already validly published by reconciliation without weakening malformed-state rejection or introducing another parser.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Component detail succeeds for a valid evidence source with more than one hundred component bindings when it remains within the configured component bound
- [x] #2 Malformed, over-component-bound, and otherwise noncanonical evidence still fails closed through the existing diagnostic path
- [x] #3 Every application read that reparses canonical evidence uses the same component/source/record/relationship ceilings as reconciliation
- [x] #4 Focused regression tests and the full repository check pass, and the OpenClaw markdown component detail renders without the malformed-evidence error
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the two evidence-read parser calls that misuse the embedded-item ceiling with the existing component ceiling. 2. Extend the closest Application evidence-detail fixture past one hundred valid component bindings and verify detail succeeds while malformed and over-bound cases still fail. 3. Run focused and full checks, rebuild/install Groma, rescan OpenClaw if needed, and verify the component-detail interaction in the browser.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reused the reconciliation component ceiling in both Application evidence-read paths. Existing malformed-evidence and over-component-limit tests continue to cover fail-closed behavior. Added a regression above the per-component embedded-item ceiling. Verified with the focused reconciliation suite, TypeScript checks, the full repository check, the compiled CLI against OpenClaw's 212-component evidence source, and the rendered markdown detail interaction with no console warnings or errors.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Component detail and cognitive-complexity reads now accept canonical evidence sources already validly published within maxComponents. The change removes the accidental 100-component read ceiling without changing parsing, persistence, schema, scanner, or UI semantics.
<!-- SECTION:FINAL_SUMMARY:END -->
