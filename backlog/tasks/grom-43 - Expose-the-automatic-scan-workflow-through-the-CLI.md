---
id: GROM-43
title: Expose the automatic scan workflow through the CLI
status: To Do
assignee: []
created_date: '2026-07-14 19:58'
updated_date: '2026-07-14 22:36'
labels: []
milestone: m-3
dependencies:
  - GROM-30
  - GROM-39
  - GROM-40
  - GROM-41
  - GROM-42
  - GROM-52
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deliver the first-run product loop in which a user initializes Groma, scans the current TypeScript or Bun project, and immediately opens a bounded, evidence-grounded local blueprint with no human or AI intervention.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 From a supported project root, groma init followed by groma scan registers the project, executes the built-in scanner, reconciles one complete snapshot, and for interactive use proceeds directly to a nonempty bounded local visual blueprint
- [ ] #2 The default scan performs no AI calls, network inference, project code execution, uploads, or edits outside the Groma workspace
- [ ] #3 Interactive use exposes bounded progress and proceeds to the visual blueprint, while noninteractive plain and JSON results remain deterministic, complete for one bounded result, and suitable for automation
- [ ] #4 Public commands expose scan status, diagnostics, coverage, evidence, bindings, automatic components, bounded raw export, and structured component and evidence inspection through shared operations
- [ ] #5 Repeating an unchanged scan produces no canonical byte changes and a failed, cancelled, or interrupted scan leaves the prior blueprint and its reconstructable projection usable
- [ ] #6 The workflow supports explicit project and scanner selection without creating scanner-specific mutation semantics
<!-- AC:END -->
