---
id: GROM-19
title: Define recursive component containment
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-11 22:32'
updated_date: '2026-07-11 22:34'
labels:
  - architecture
  - model
  - documentation
milestone: m-1
dependencies: []
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the special Group entity and primary-group assignment with one recursively composable component model. Every architectural node is a stable component with an open type token, zero or one structural parent, any number of children, and any number of non-containment relationships. This refinement must be reflected consistently in the manifesto, architecture overview, examples, and all affected Iteration 1A tasks before the standard model is implemented.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The manifesto and architecture define every architectural node as a component with a stable open type and recursive containment
- [ ] #2 Each component has at most one structural parent, root components have none, and parents may contain children of the same or different types
- [ ] #3 Containment is cycle-free and independent from unlimited non-containment relationships
- [ ] #4 The special Group entity and primary_group field are removed from the v0.1 standard model, examples, workflows, and terminology
- [ ] #5 All affected Iteration 1A tasks describe the recursive component model consistently without changing completed historical task records
- [ ] #6 A repository-wide terminology audit finds no remaining active specification that requires special groups or primary grouping
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Audit active product documentation and future Backlog tasks for group and primary-group semantics.
2. Update the manifesto and architecture overview to define universal recursively nested components, structural containment, component types, and invariants.
3. Rewrite examples and self-hosting instructions around root and nested components.
4. Update all affected To Do tasks through the Backlog CLI.
5. Run focused terminology and Markdown validation, inspect the diff, and open a ready PR for review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Alex confirmed the original product mental model: the blueprint is the workspace; domains are root components; components nest recursively beneath them; a component has one structural parent but may have unlimited non-containment relationships. The supplied Shopify sketch should guide the architecture example.
<!-- SECTION:NOTES:END -->
