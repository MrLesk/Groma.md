---
id: GROM-38
title: Register projects and scanner coverage
status: To Do
assignee: []
created_date: '2026-07-14 19:58'
updated_date: '2026-07-14 22:07'
labels: []
milestone: m-3
dependencies:
  - GROM-22
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Represent one or more observed source roots inside an aggregate blueprint so scanner execution, provenance, status, and queries share stable project boundaries without creating separate project blueprints.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A user can add, inspect, edit, and remove a project registration with a stable identity, display name, source locator, enabled scanners, scanner configuration, and allowed coverage
- [ ] #2 Initializing Groma in a single project can create an explicit default registration for the current source root
- [ ] #3 Several heterogeneous source roots can contribute to one aggregate blueprint and remain filterable by project
- [ ] #4 An unavailable source keeps its prior evidence and reports unavailable status rather than deletion
- [ ] #5 Project registration never copies source content into intent or modifies package-manager and configuration files belonging to the observed project
- [ ] #6 Source locator handling is deterministic and portable across supported macOS, Linux, Windows x64, and Windows ARM64 conventions
<!-- AC:END -->
