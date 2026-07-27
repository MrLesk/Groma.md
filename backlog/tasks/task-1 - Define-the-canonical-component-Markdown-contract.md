---
id: TASK-1
title: Define the canonical component Markdown contract
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 21:33'
labels: []
milestone: m-0
dependencies: []
references:
  - README.md
  - groma/plans/01-markdown-foundation/README.md
  - 'https://c4model.com/'
  - 'https://github.com/comarkdown/comark'
modified_files:
  - .gitignore
  - README.md
  - groma/README.md
priority: high
type: feature
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Groma is a local, Git-native architecture tool whose canonical artifacts are readable Markdown. Current materialized architecture lives under groma/observed; each directory under groma/plans is a complete desired architecture revision. Define the smallest shared document contract using the C4 hierarchy of people, software systems, containers, and components. Comark is the required TypeScript Markdown parser: the comark npm package parses CommonMark/GFM, frontmatter, and optional component syntax into a serializable AST. The contract must remain useful to a reader without Groma and must not store layout or lifecycle state.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The supported frontmatter fields and Markdown sections are documented with one complete C4 example
- [x] #2 Observed and planned revisions use the identical component document format with no claim field; the containing directory supplies revision context
- [x] #3 People, systems, containers, components, parent containment, external systems, and directed relationships have an unambiguous readable representation
- [x] #4 The example is parsed successfully by the comark npm package without a second Markdown parser
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Document the canonical Markdown contract in groma/README.md: revision roots, file layout, four frontmatter fields, C4 containment rules, readable sections, relationship direction, and excluded state.
2. Point to the existing Revision 02 snapshot as the complete example because it already contains people, internal/external systems, containers, components, containment, and directed links; keep all plan snapshots unchanged.
3. Link the contract from the root README and add repository ignores for local metadata.
4. Parse the complete example and contract with comark 0.5.1, verify links and absence of claim/layout/lifecycle fields, then finalize TASK-1 and commit the initial repository state to main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Repository review found that all existing plan component documents already use id/kind/parent/external frontmatter and no claim field. Revision 02 is the smallest existing complete example spanning every required C4 kind; TASK-2 explicitly depends on Revision 01 staying at exactly five elements, so TASK-1 will not add a component to Revision 01.

Implemented groma/README.md as the shared observed/planned contract and linked it from the root README. The existing Revision 02 snapshot is the complete example; no plan snapshot content changed.

Verification: comark 0.5.1 parsed and JSON-serialized 36 Markdown files (root README plus all groma Markdown); 40 local Markdown links resolved; Revision 02 contains person, system, container, and component kinds, valid parent containment, an external system, and directed relationship tables. A separate Comark-derived frontmatter check validated 5/10/15 element documents in Revisions 01/02/03 using only id, kind, parent, and external, with all parents and links resolving. Task-specific git diff check passed, and no .DS_Store or .idea paths are staged.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Defined the canonical Git-native C4 Markdown contract for observed and planned revisions, including the four supported frontmatter fields, containment rules, readable sections, directed relationship tables, excluded revision/layout/lifecycle state, and Revision 02 as a complete example. Linked the contract from the project README and ignored local IDE/macOS metadata. Verified with comark 0.5.1: 36 Markdown files parsed and serialized, 40 local links resolved, all planned frontmatter/parents validated, and the complete example covers all required C4 kinds plus an external system.
<!-- SECTION:FINAL_SUMMARY:END -->
