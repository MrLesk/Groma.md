---
id: TASK-463
title: 'Deliver time machine, comparison, and static export'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-20 15:04'
updated_date: '2026-09-20 22:14'
labels: []
dependencies: []
references:
  - history-revisions
  - revision-control
  - map
  - organisms-details
  - source-control
  - web-export
documentation:
  - docs/component-markdown.md
  - docs/viewers/web/index.md
modified_files:
  - backlog/tasks/task-445 - Remove-the-direct-Open-PR-integration.md
  - backlog/tasks/task-461 - Export-working-trees-commits-and-comparisons.md
  - backlog/tasks/task-460 - Review-component-changes-and-source-diffs.md
  - backlog/tasks/task-459 - Compare-revisions-on-the-architecture-map.md
  - >-
    backlog/tasks/task-458 -
    Browse-Git-revisions-through-a-searchable-time-machine.md
  - docs/git-comparison-plan.md
priority: high
type: feature
ordinal: 535000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Groma is a PR companion. A developer should understand which components and relationships changed, how responsibilities and implementation changed, and which source changes explain those differences. A CI job can publish that same view for reviewers without their own checkout or a Groma server.

This parent owns the shared requirements below. Its four child tasks own revision browsing, comparison on the map, component details and file diffs, and static export. Read this parent with the relevant child; keep shared decisions here and delivery-specific acceptance criteria in the child. Work sequentially in the shared main workspace, review each visible result, and write each implementation plan on pickup after checking current code and other agents' modified files.

## Shared view and revision rules

- Ordinary live Groma starts on the working tree. An individual revision supplies its own architecture, source contents, and flows without changing the developer's checkout.
- A comparison is directed from starting revision A to destination B. One selected revision or pair supplies the whole viewer: map, details, and source inspection. Detail panels do not own another revision picker.
- Comparison mode only compares the pair. Ending it leaves B open; ordinary revision browsing then opens an individual revision. There is no retained comparison switch or individual-revision submode.
- Keep the selected component when its stable ID exists in the resulting view; otherwise close its details.
- Live comparison supports two commits or a commit and the working tree. A working-tree endpoint follows live changes, including source-only changes.
- Export packages the normal viewer, exact snapshots, required source data, and initial selection. The caller supplies explicit commits. The static browser uses generated data without runtime Git, Backlog, or a Groma server.

## Meaning of changes

Components match by their existing stable `groma.id`, not name, path, parent, or position. Renaming or moving a component with the same ID preserves its identity. A new ID is Added; a missing ID is Removed.

An existing component is Modified when its own architecture content changes, such as name, parent, overview, technology, or code ownership, or when its owned source changes. Added and Removed take precedence. Relationship-only, task-only, and flow-only changes do not mark components Modified. A neighbor's source changes do not propagate to the component, and changes do not propagate to systems, containers, groups, or other ancestors.

Relationships independently show Added, Modified, or Removed. File status describes actual source differences between A and B. Removing a component or changing ownership does not automatically delete its former files; unchanged files remain unchanged even if their ownership changes.

Comparison facts are derived from the revisions without rewriting either snapshot or storing change metadata in architecture Markdown.

## Shared colors

Change colors apply to components and relationships on the map. Systems, containers, groups, and other context retain ordinary styling. The same roles serve map changes, detail/file statuses, and code diffs.

| Role | Light | Dark | Blueprint |
| --- | --- | --- | --- |
| Added | `#2563EB` | `#79C0FF` | `#70E1F5` |
| Modified | `#9A6700` | `#E3B341` | `#FFE066` |
| Removed | `#B42318` | `#FF7B72` | `#FF8FAB` |

Added and removed code lines use those roles. Modified is a component/file status with its own semantic token, not a third kind of changed line.

Blueprint uses quiet blue `#07152B` and Groma green `#1D9E75` for selection and active flows. Component faces retain their change tint while the selection outline and name use the interaction color. Draft dashes retain their draft meaning.

## Tasks and flows

Tasks remain available in ordinary live working-tree Groma. Comparisons and every static export exclude task data and UI: Tasks tabs, pins, task search results, task details, and task diffs. Do not load historical task data for this feature. Existing export bundles task data; this delivery removes it.

Individual revisions show their own flows. The combined comparison uses B's flows. Flow-definition changes are not compared and do not mark participating components Modified.

## Ownership and defensive architecture

- History owns commit metadata and access to exact revision data.
- Comparison derives change facts and the combined architecture from its pair.
- The existing sheet/layout domain owns placement and routes.
- The web time machine owns the user's current view; map, details, and source views consume it.
- Source/file-diff rendering is shared with ordinary task review. Task review owns its endpoint and file selection.
- Export packages data for that same behavior and presentation.

Reuse or reshape these responsibilities. Group atomic components by domain, derive state instead of duplicating it, keep one authority per concern, and remove obsolete paths. The entry point, state, and ownership must be clear to a junior developer.

OKF Markdown and links remain readable and portable without Groma. In C4, revisions and comparisons are views of architecture, not new elements or containment levels. Groma's application profile owns identity and code-ownership meaning; the viewer derives comparison presentation from that information. No new stored comparison metadata or C4 boxes are needed. The existing architecture Markdown contract remains authoritative.

## Shared example

A checkout moves receipt delivery into a worker. A contains Checkout, Payment adapter, and Receipt sender. B modifies Checkout, retains Payment adapter, removes Receipt sender, and adds Receipt worker. A separate source-only commit changes Checkout's owned source without editing its architecture Markdown. These names and languages are examples, not inference rules for other projects. Child tasks provide their observable scenarios.

## Scope limits

This delivery includes no GitHub API integration, revision-source plugin framework, automatic PR or branch discovery, implicit merge-base choice, task comparison, flow comparison, new terminal comparison UI, or repository-specific CI workflow. Initial comparison exports contain two commits. Apply the repository's prototype, testing, and review rules; add no compatibility or speculative abstractions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A developer can browse revisions, start and end a comparison, inspect component and source changes, and export the same supported views through the four completed child tasks.
- [ ] #2 The map, component details, file inspection, and static viewer consistently use this parent's shared revision, identity, change, color, task, and flow rules.
- [ ] #3 The receipt-delivery example works across the full journey: choose A and B, inspect Added/Modified/Removed components and a source diff, end comparison, and open the equivalent static comparison and individual snapshots.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
