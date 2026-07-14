---
id: GROM-23
title: Publish the plugin SDK and conformance suites
status: To Do
assignee: []
created_date: '2026-07-14 19:56'
labels: []
milestone: m-2
dependencies:
  - GROM-21
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Give built-in and third-party plugin authors one supported public contract for manifests, capability entry points, lifecycle, and provider behavior without depending on repository internals.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The public SDK exports versioned plugin and package manifest contracts plus the capability types required to implement a plugin
- [ ] #2 Plugin packages can implement supported capabilities without importing private source modules
- [ ] #3 Reusable conformance suites validate lifecycle, cancellation, declared cardinality, deterministic results, and provider-specific behavior
- [ ] #4 Every applicable built-in provider passes the same conformance suite exposed to third parties
- [ ] #5 Unsupported or incompatible SDK and runtime versions fail with stable compatibility diagnostics
<!-- AC:END -->
