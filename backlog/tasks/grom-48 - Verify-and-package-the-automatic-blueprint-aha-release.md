---
id: GROM-48
title: Verify and package the automatic-blueprint aha release
status: To Do
assignee: []
created_date: "2026-07-14 19:59"
updated_date: "2026-07-14 23:05"
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
- [ ] #7 The Iteration 2 release resolves and records the scheduled state-taxonomy, plaintext-grammar, and local-artifact main-layer, focus, and expansion budget decisions from the local prototype; verifies the bounded initial 256-bucket evidence strategy; leaves browser retained-node limits unfrozen until the End of Iteration 4; and defers organization-scale fanout and browser evidence to GROM-53
- [ ] #8 Iteration 2 release notes scope the supported first-run path to one active CLI process, identify concurrent independent read processes as a known fail-closed limitation owned by GROM-31, and black-box overlapping-access checks prove canonical state remains byte-for-byte unchanged without claiming that concurrent reads work
- [ ] #9 Iteration 2 release notes declare a preview schema contract: incompatible canonical schemas fail closed with an actionable diagnostic, no silent or in-place migration is promised before GROM-27, and upgrade guidance tells users how to preserve or export state before changing versions

<!-- AC:END -->
