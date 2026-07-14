---
id: GROM-24
title: Manage and pin local plugin packages
status: To Do
assignee: []
created_date: '2026-07-14 19:56'
updated_date: '2026-07-14 22:36'
labels: []
milestone: m-4
dependencies:
  - GROM-22
  - GROM-23
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: medium
type: feature
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Support reproducible local plugin packages for the initial package-management delivery while keeping package installation, plugin enablement, runtime loading, and project package management separate.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A local package containing one or more plugins can be added, inspected, selectively enabled, disabled, and removed through supported Groma operations
- [ ] #2 Blueprint-affecting plugins are declared in canonical configuration and resolved through deterministic exact lock entries
- [ ] #3 Personal presentation-only plugins remain local and cannot silently change shared blueprint meaning
- [ ] #4 Groma requires explicit trust before executing project-provided plugin code and clearly states that plugins run with the user permissions
- [ ] #5 Package operations never modify package-manager files belonging to an observed project
- [ ] #6 Remote acquisition remains explicitly out of scope for this delivery
<!-- AC:END -->
