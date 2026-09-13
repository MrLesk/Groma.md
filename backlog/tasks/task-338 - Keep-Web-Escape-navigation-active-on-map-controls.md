---
id: TASK-338
title: Keep Web Escape navigation active on map controls
status: Done
assignee:
  - '@codex'
created_date: '2026-09-10 21:54'
updated_date: '2026-09-10 21:57'
labels: []
dependencies: []
references:
  - iso-camera
modified_files:
  - src/viewers/web/iso/camera.ts
  - test-bun/iso-map.test.ts
type: bug
ordinal: 384000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After clicking 2D, Iso, or Layers controls, Escape should still clear map selection. Non-text radio and checkbox inputs must not suppress map shortcuts as if the user were typing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Escape clears selection when a map radio or checkbox control has focus.
- [x] #2 Text inputs still suppress map shortcuts while editing.
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
Reproduce focused-control Escape in the browser, distinguish radio and checkbox controls from text inputs in keyTarget, verify keyboard rules and the actual browser flow, then run repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser reproduction: select Shop, focus and select the 2D overhead radio, then press Escape; selection and details remain open before the fix. keyTarget now classifies radio/checkbox inputs as controls before the text-input rule. Existing keyboard-state test covers Escape on controls and text-field suppression of all map keys. No camera geometry or architecture meaning changed.

Browser verification on an isolated plain-view fixture: before the fix, Escape on the focused 2D radio retained ?system=shop and open details. After rebuilding the viewer, Escape from each of 2D, Isometric, and Layers removed the selection parameter and details. Escape in the Search text input preserved Shop selection. All 18 camera/map tests passed. Specification and quality review found no blocking issue; text editing, browser chords, map geometry and existing shortcut actions are unchanged. Full repository check passed: 110 Node and 433 Bun tests, 3 optional skips. This restores the documented Escape action and needs no new product copy. Uncommitted pending user acceptance.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Web map radio controls no longer suppress Escape as text inputs. Verified selection clearing from 2D, Iso and Layers in the browser, preserved Search behavior, and passed camera tests and the full repository check.
<!-- SECTION:FINAL_SUMMARY:END -->
