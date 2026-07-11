---
id: GROM-1
title: Create Groma's handmade architecture overview
status: Done
assignee:
  - '@codex'
created_date: '2026-07-11 16:15'
updated_date: '2026-07-11 16:18'
labels:
  - architecture
  - bootstrap
  - documentation
milestone: m-0
dependencies: []
references:
  - MANIFESTO.md
modified_files:
  - ARCHITECTURE.md
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the root ARCHITECTURE.md as a manual precursor to Groma's self-blueprint. The document must map the approved product architecture at intent level and become the reviewed architectural source until Groma can represent itself.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ARCHITECTURE.md contains a system context, legend, and high-level Mermaid architecture diagram
- [x] #2 Every planned subsystem is represented by a component card with a seed key, intent, inputs, outputs, actions, relationships, and first delivery iteration
- [x] #3 The overview covers Core, Official Host, Standard Blueprint Model, Canonical Persistence, Projection, Scanning and Reconciliation, Planning and History, Surfaces, and Plugin Development
- [x] #4 The overview documents canonical data planes and the initialize, scan, reconcile, plan, diff, history, and self-hosting workflows
- [x] #5 The overview records architectural invariants and unresolved decisions without drifting into package, class, or implementation design
- [x] #6 The overview aligns with MANIFESTO.md and preserves scanner blindness, shared application operations, plugin boundaries, and separation from Backlog.md
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Derive the intent-level system context and legend from MANIFESTO.md.
2. Map every planned architectural group into Groma-style component cards with seed keys, interfaces, relations, and delivery iterations.
3. Document canonical data planes, primary workflows, invariants, and explicitly unresolved decisions.
4. Review the overview against every acceptance criterion and the manifesto before marking the task complete.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created ARCHITECTURE.md with 32 component cards across all nine required groups. Verified each card has a seed key, delivery iteration, intent, inputs, outputs, actions, and relationships. Added the context and data-plane diagrams, primary workflows, architectural invariants, deferred decisions, and the transition into Groma self-hosting. git diff --check passes; AGENTS.md retains exactly one Backlog-managed block.

Final verification: all six acceptance criteria are checked; structural counts match across all component-card fields; git diff --check passes; Backlog configuration reports taskPrefix GROM; the manifesto rule is outside one intact managed Backlog block.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Created and reviewed the handmade Groma architecture blueprint. It maps 32 intent-level components across nine architectural groups, documents canonical planes and core workflows, and defines the transition to Groma self-hosting. Verified structurally, against MANIFESTO.md, and with git diff --check.
<!-- SECTION:FINAL_SUMMARY:END -->
