---
id: TASK-241.6
title: Group and combine from the web
status: Done
assignee:
  - '@web-editor'
created_date: '2026-09-02 21:16'
updated_date: '2026-09-03 11:08'
labels:
  - cli
  - web
  - core
dependencies:
  - TASK-241.1
references:
  - 'https://claude.ai/code/artifact/902f8d7d-7267-49cd-b8cd-771e23b93d2b'
  - edit
  - commands
  - web-viewer-details
  - iso-map
  - iso-camera
  - render
  - page
  - instructions
  - welcome
  - draft
modified_files:
  - src/group.ts
  - src/add.ts
  - src/edit.ts
  - src/remove.ts
  - src/cli.ts
  - test/group.test.ts
  - src/viewers/web/atoms/text.ts
  - src/viewers/web/organisms/writes.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/iso/paint-ground.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/pointer.ts
  - src/viewers/web/chrome/group.ts
  - src/viewers/web/authoring.ts
  - src/viewers/web/render.ts
  - src/viewers/web/page.ts
  - test-bun/web-authoring.test.ts
  - src/instructions.ts
  - README.md
  - docs/product-model.md
  - docs/agent-instructions/index.md
  - docs/viewers/web/index.md
  - src/welcome/model.ts
  - src/naming.ts
parent_task_id: TASK-241
priority: medium
type: feature
ordinal: 280000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A group is a name on each sibling component and has no id of its own, so it carries the word group on every verb and is addressed as <container-id>/<group-kebab>. groma add group <name> <ids...> assigns siblings, groma edit group <address> --title <text> renames every member in one change and groma remove group <address> [ids...] removes members or dissolves the group. In the web, a multi-select offers Group as and Combine into, where the person picks the survivor, and clicking a group label offers rename and dissolve. Combine keeps the survivor id and the union of Code references, as edit --combine does today, because nothing hand-creates scanned software.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma add group <name> <ids...> assigns sibling components to one group and refuses when the ids do not share a container
- [x] #2 groma edit group <container-id>/<group-kebab> --title <text> renames every member in one change; groma remove group <address> [ids...] removes the named members or dissolves the group when no ids are given
- [x] #3 In the web, a multi-select offers Group as and Combine into with the survivor chosen by the person; clicking a group label offers rename and dissolve; every control posts the same input as the CLI
- [x] #4 Combine keeps the survivor id and the union of Code references
- [x] #5 Tests cover group add, rename, dissolve, the shared-container refusal and address resolution with fixtures under test/fixtures
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Core: src/group.ts with addGroup (sibling components of one container get the group name; refuses other kinds, mixed containers or an empty list), editGroup (every member takes the new name) and removeGroup (the named members lose the name, or every member when none is named). A group is addressed as <container-id>/<group-kebab>; the slash tells the verbs apart from an element id. Inputs: add { thing: 'group', name, members }, edit { id: <address>, title }, remove { id: <address>, members? }; add.ts, edit.ts and remove.ts dispatch on the thing or the address. Combine stays groma edit <survivor> --combine <ids...> and keeps the survivor id and the union of Code references.
2. CLI: groma add group <name> <ids...>, groma edit group <address> --title <text>, groma remove group <address> [ids...]; one helper turns the words relation and group plus their ids into the verb input.
3. Web: on the current revision of a live map a multi-selection of components gets Group as (a name, posting the add input) and Combine into (the person picks the survivor among the selected, posting edit with --combine); a zone label on the map carries the group address and clicking it opens one dialog (chrome/group.ts) with Rename (edit) and Dissolve (remove).
4. Tests: test/group.test.ts on the plain-view fixture (add, rename, member removal, dissolve, the shared-container and kind refusals, address resolution); test-bun/web-authoring.test.ts posts the three group inputs and a combine.
5. Docs and guides: README, product model, shipped instructions, agent guide, web viewer doc, welcome table. Verify in the browser pane, run the checks, then the reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: src/group.ts with addGroup, editGroup and removeGroup over the group name each sibling component carries; a group is addressed as <container-id>/<group-kebab> and the slash tells it apart from an element id, so add.ts dispatches on thing group, edit.ts and remove.ts on the address (editAddressed also holds the relation branch to keep editArchitecture simple). CLI: groma add group <name> <ids...>, groma edit group <address> --title <text>, groma remove group <address> [ids...] through the addressed and addedIds helpers. Web: zones carry data-group and data-group-name, the map pointer offers the pressed group as an action, chrome/group.ts is the Rename or Dissolve dialog, and a multi-selection of components starts the pane with Group as and Combine into (organisms/writes.ts, which also took the meaning, draft and relate controls out of details.ts; atoms/text.ts holds heading and paragraph). Combine stays groma edit <survivor> --combine <ids...>. Browser run on the plain-view demo: ?component=orders&component=stock showed '2 selected' with both controls; Group as Checkout posted /add and both components carried the group and a zone; pressing the zone label opened 'Group Checkout', Rename posted /edit and both members read Order flow, reopening showed the new name, Dissolve posted /remove and the zone left; Combine into orders posted /edit and the pane showed the core refusal (orders owns an authored relationship) under the controls. Tests: test/group.test.ts (add, rename, member removal, dissolve, kind and shared-container refusals, address resolution and strangers) and test-bun/web-authoring.test.ts (the three group inputs and a mixed-container refusal).

Cold simplicity review applied: the address rule lives once as groupAddress in naming.ts, used by group.ts and by the zone painter; loadMembers is one filter over that rule instead of a hand-written parser; the guards no control reaches left add.ts; the pane always passes the whole selection; edit takes only the address or the relation from the addressed helper, so members never spread into an edit input; the web test keeps the mixed-container refusal to core; docs and comments say a pressed zone rather than a label, since labels take no pointer events. Restored from the review's quality note: a pressed zone opens the dialog only on the current revision of a live map and otherwise selects its container as before (editGroup returns whether it took the press). Specification review: AC1 by test/group.test.ts (sibling components named, a system and members of two containers refused with the tree unchanged); AC2 by the same file (rename of every member, a member leaving, the dissolve, unknown or slashless addresses and strangers refused); AC3 by the browser run (two selected components offered Group as and Combine into, Group as posted add and the zone appeared, the pressed zone opened Rename and Dissolve which posted edit and remove, Combine into posted edit with --combine and showed the core refusal under the controls) and by test-bun/web-authoring.test.ts (the three group inputs); AC4 by the existing combine test in test/curate.test.ts (survivor id kept, Code references united); AC5 by the plain-view fixture under test/fixtures. Quality review: no reproducible defect in the supported flow; every group rule is in src/group.ts, the address rule in naming.ts, and the web reaches all of it through the same three verbs; details.ts is 425 lines and render.ts 494, both under the limit.

Full-context complexity review: one defect found and fixed, the word group followed by a plain element id fell through to that element (groma remove group git would have removed the external), so the CLI helper now requires a group address after the word and test/group.test.ts proves it with an existing component and an external; isGroupAddress moved beside groupAddress in naming.ts; the pane's write-hook types moved to organisms/writes.ts so details.ts composes writes one way. Correction to an earlier note: test-bun/web-authoring.test.ts covers the add, edit and remove round trip of a group; the refusals live in test/group.test.ts. Reported to the owner rather than built: (a) two vocabularies write the same field, groma edit <id> --group/--ungroup and the group verbs, and dropping the flags would leave one path; (b) two names that kebab to one address (Order Flow and order flow) make two zones with one address, so Rename merges them and Dissolve dissolves both; (c) the web offers Group as and Combine into to any multi-selection and relies on the core refusal for mixed kinds or containers; (d) the three verb dialogs repeat one skeleton and the group dialog does not disable its buttons while a write is in flight. Final checks after the fixes: Biome and tsc clean for the task's files, Node 106/106, Bun 245/245.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Groups carry the word group on every verb and are addressed as <container-id>/<group-kebab>: groma add group <name> <ids...> names sibling components of one container, groma edit group <address> --title renames every member, groma remove group <address> [ids...] takes members out or dissolves the group; combine stays groma edit <survivor> --combine and keeps the survivor id and the union of Code references. The web posts the same inputs: a multi-selection of components starts its pane with Group as and Combine into (the person picks the survivor), and a pressed zone on a live map opens Rename and Dissolve. Verified with test/group.test.ts, test-bun/web-authoring.test.ts, the existing combine tests, both full suites (Node 106/106, Bun 245/245) and browser runs of Group as, the zone dialog's Rename and Dissolve, and Combine into showing the core refusal.
<!-- SECTION:FINAL_SUMMARY:END -->
