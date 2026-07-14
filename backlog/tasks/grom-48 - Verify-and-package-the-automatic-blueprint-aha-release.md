---
id: GROM-48
title: Verify and package the automatic-blueprint aha release
status: To Do
assignee: []
created_date: '2026-07-14 19:59'
updated_date: '2026-07-14 22:20'
labels: []
milestone: m-3
dependencies:
  - GROM-33
  - GROM-43
  - GROM-45
  - GROM-49
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
  - DEVELOPMENT.md
priority: high
type: task
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Close Iteration 2 with black-box proof that a friend can run one standalone Groma binary on an unfamiliar TypeScript or Bun project and quickly receive an understandable, correct, evidence-grounded local blueprint before asking an agent to improve its intent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 From a clean checkout and a held-out project with no Groma state, the standalone executable completes the documented groma init, groma scan, groma workflow and opens a bounded local visual blueprint without Bun installed, AI calls, network inference, uploads, or human correction
- [ ] #2 The held-out project and Groma results pass the recorded aha benchmark with zero critical false architectural claims and the recorded time-to-first-understandable-visual target
- [ ] #3 Black-box scenarios cover unchanged rescan, implementation rename or move, disappearance and reappearance, overlapping observations, partial coverage, explicit binding, ambiguity, cancellation, crash, projection rebuild, focus navigation, and structured evidence inspection
- [ ] #4 The friend workflow demonstrates that dense main-layer presentation remains readable while focus and detail views expose deeper structure without changing canonical meaning
- [ ] #5 One runner cross-compiles exact standalone artifacts for macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64, and the host-compatible artifact runs the complete workflow without an installed Bun runtime
- [ ] #6 User documentation shows the no-AI first-run experience and how to inspect intent, raw evidence, automatic architecture, uncertainty, and coverage before optional agent curation
- [ ] #7 The Iteration 2 release resolves and records the scheduled state-taxonomy, plaintext-grammar, and visual-presentation-budget decisions, verifies and documents the bounded initial 256-bucket evidence strategy, and explicitly defers organization-scale fanout evidence and any fanout decision to GROM-53 in Iteration 3
<!-- AC:END -->
