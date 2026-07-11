---
id: GROM-19
title: Define recursive component containment
status: Done
assignee:
  - '@codex'
created_date: '2026-07-11 22:32'
updated_date: '2026-07-11 22:51'
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
- [x] #1 The manifesto and architecture define every architectural node as a component with a stable open type and recursive containment
- [x] #2 Each component has at most one structural parent, root components have none, and parents may contain children of the same or different types
- [x] #3 Containment is cycle-free and independent from unlimited non-containment relationships
- [x] #4 The special Group entity and primary_group field are removed from the v0.1 standard model, examples, workflows, and terminology
- [x] #5 All affected Iteration 1A tasks describe the recursive component model consistently without changing completed historical task records
- [x] #6 A repository-wide terminology audit finds no remaining active specification that requires special groups or primary grouping
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

Claude review approved the model with minor clarity suggestions. Added an explicit graph kind versus model type distinction, made the Shopify action example self-contained, and showed root Parent: None values while explaining sparse root definitions. The Backlog whitespace is CLI-generated and has no supported CLI normalization path; the package.json formatting remark was not applicable because the PR does not modify that file.

Final validation passed: focused Markdown formatting; git diff whitespace checks; TypeScript typecheck; 6 Bun tests; native single-binary build and smoke; 33-card structural type and parent audit; and active-spec terminology audit. Claude approved with minor clarity feedback that was addressed. Codex bot completed with a thumbs-up and no review comments or unresolved threads.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the special Group entity and primary_group field with one recursive component model: the blueprint is a workspace, domains are ordinary root components, every non-root component has one parent, same-type and mixed-type nesting is allowed, containment is acyclic, and ordinary relationships remain unrestricted. Updated the manifesto, architecture, Shopify and Ordering examples, development terminology, and affected Iteration 1A tasks while preserving Core neutrality and completed historical records. Local validation passed and both required external review gates completed.
<!-- SECTION:FINAL_SUMMARY:END -->
