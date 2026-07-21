---
id: GROM-100
title: Repair stale self-blueprint reconciliation bindings
status: To Do
assignee: []
created_date: '2026-07-21 18:39'
labels: []
dependencies: []
priority: high
type: bug
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Restore Groma's checked-in self-blueprint so the public init -> scan -> groma loop can reconcile current source evidence after previously observed source files were removed. The repair must use supported Groma operations, preserve curated architectural intent and stable opaque identities, and keep ambiguous or missing bindings fail-closed. The committed canonical evidence should be immediately reusable by the visual blueprint work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A fresh public Groma self-scan completes successfully on the current repository instead of failing with reconciliation-binding-missing for removed source evidence
- [ ] #2 The repair preserves curated component intent and stable canonical identities while updating or retiring stale scanner-owned evidence only through supported semantic operations
- [ ] #3 Two consecutive self-scans produce deterministic byte-stable canonical state and a bounded blueprint consumable by the existing visual surface
- [ ] #4 Focused reconciliation coverage and the complete repository quality gate pass without weakening ambiguity handling
<!-- AC:END -->
