---
id: GROM-3
title: Document Groma plugin package installation
status: Done
assignee:
  - '@codex'
created_date: '2026-07-11 17:25'
updated_date: '2026-07-11 17:26'
labels:
  - architecture
  - plugins
  - documentation
dependencies: []
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend Groma's constitutional and architectural documentation with the agreed package installation model: simple npm, Git, and path sources; user and project scopes; project trust; selective plugin enablement; temporary loading; and deterministic locking for blueprint-affecting plugins.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 MANIFESTO.md states the trust, reproducibility, and package-versus-plugin principles without embedding package-manager details in Core
- [x] #2 ARCHITECTURE.md defines the plugin package manager component, package manifest, scopes, sources, enablement, trust flow, locking, and CLI surface
- [x] #3 The design prevents global plugins from silently changing canonical blueprint behavior and never mutates a scanned project's package-manager files
- [x] #4 The repository contains no attribution to an external inspiration for this design
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add package distribution, trust, and reproducibility principles to the manifesto.
2. Add the package manager component and concrete package model to the architecture overview.
3. Verify terminology, architectural boundaries, and absence of prohibited attribution.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Documented Groma package distribution as a native architectural decision. The manifesto now defines package/plugin separation, trust, reproducible canonical-impacting plugins, and isolation from observed project dependencies. The architecture now includes the Plugin Package Manager component, package manifest, scopes, sources, locking, trust, selective enablement, temporary loading, and CLI. Verified all 34 component-card field counts match, git diff --check passes, and the repository contains no prohibited attribution.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added Groma’s plugin package installation model to the manifesto and architecture overview. Packages can contain selectively enabled plugins, install from npm, Git, or paths, use user or local-blueprint scope, require project trust, and pin canonical-impacting plugins through a committed lock. Verified structure, boundaries, and attribution requirements.
<!-- SECTION:FINAL_SUMMARY:END -->
