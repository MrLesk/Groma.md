---
id: TASK-225
title: Move Groma architecture to an OKF v0.2 package
status: Done
assignee:
  - '@codex'
created_date: '2026-08-30 21:44'
updated_date: '2026-08-31 00:25'
labels: []
milestone: m-5
dependencies: []
references:
  - >-
    https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/ad30107c31c06aec8a7d5636e0d1058118604e6f/SPEC.md
  - >-
    https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/ad30107c31c06aec8a7d5636e0d1058118604e6f/src/reference_agent/bundle/document.py
  - >-
    https://cloud.google.com/blog/products/data-analytics/okf-v0-2-adds-trust-signals
priority: high
type: feature
ordinal: 238000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer opens the groma directory with a standard OKF reader, the reader can inspect useful typed concepts, Markdown bodies, indexes, and links on a best-effort basis. When the same package is opened with Groma, every current architecture, planning, scanning, history, TUI, and Web feature remains supported through a strict Groma profile of OKF. Groma must reject generic OKF packages. This directly replaces the experimental storage contract without a legacy reader or compatibility adapter.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The groma directory is an OKF v0.2 bundle whose concept and reserved files satisfy the pinned canonical specification and Google reference validation code
- [x] #2 Google’s reference OKF visualizer discovers Groma concepts, renders their Markdown bodies, and extracts relationship edges
- [x] #3 Groma opens only bundles carrying the explicit Groma profile and rejects generic OKF bundles
- [x] #4 OKF type replaces kind, standard title and optional description map directly into the domain, and all Groma-only metadata is grouped beneath groma
- [x] #5 The current long introductory Markdown remains body content and is exposed as overview without being truncated into description
- [x] #6 Observed, missing, planned, ghost, restatement, accept, grouping, source evidence, relationships, history, Web, and TUI behavior remain supported
- [x] #7 Groma writers preserve standard and unknown OKF metadata they do not own while keeping canonical C4 relationships and containment strict
- [x] #8 Focused checks, official interoperability checks, and bun run check pass before finalization
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
1. Replace the reader, domain model, and validation boundary with the strict Groma profile of OKF v0.2 through TASK-225.1.
2. Move every supported writer and lifecycle transition onto that profile through TASK-225.2.
3. Rewrite the live bundle, fixtures, and documentation and prove official-reader interoperability through TASK-225.3.
4. Run cold simplicity, specification, quality, and full-context architecture reviews; resolve findings; then verify and finalize the milestone.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Delivered as one atomic direct replacement through three reviewed subtasks. The final package is outbound-interoperable OKF v0.2 but Groma accepts only its explicit architecture profile. Standard type/title/description, Markdown overview, nested Groma metadata, lifecycle, strict C4 containment and relationships, all writers, live data, fixtures, docs, Web, TUI, history, and scanning now share one contract. Cold and full-context architecture reviews passed with no remaining authority-backed finding. Pinned upstream validation passes 140 concepts and 40 indexes across nine packages; the reference visualizer loads 70 live concepts, 69 bodies, and 69 edges; bun run check passes Node 91/91 and Bun 207/207.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Moved Groma to an outbound-interoperable OKF v0.2 package without removing Groma features or adding generic-OKF input support. The pinned reference implementation, visualizer, Groma validation, complete test suite, TUI walkthrough, cold reviews, and full-context architecture reviews all pass.
<!-- SECTION:FINAL_SUMMARY:END -->
