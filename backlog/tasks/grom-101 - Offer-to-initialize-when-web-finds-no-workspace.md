---
id: GROM-101
title: Offer to initialize when web finds no workspace
status: Done
assignee:
  - '@codex'
created_date: '2026-07-21 19:19'
updated_date: '2026-07-21 19:36'
labels:
  - cli
dependencies: []
references:
  - src/cli/surface.ts
  - GROM-67
modified_files:
  - src/cli/help.ts
  - src/cli/surface.ts
  - src/cli/tests/scan-init-offer.test.ts
  - src/cli/tests/web.test.ts
priority: medium
type: enhancement
ordinal: 91000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When groma web runs in a directory without a Groma workspace, an interactive user should be able to initialize immediately instead of leaving the command and running groma init manually. Reuse the existing scan confirmation boundary. Automation must remain fail-closed, and accepting initializes only; it does not silently scan.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Interactive plain-format groma web asks one yes-or-no question when the workspace is missing; yes initializes and continues the same invocation into the web server
- [x] #2 Declining the offer returns the existing web-workspace-missing exit-3 diagnostic and creates no workspace
- [x] #3 JSON-format and non-interactive web invocations never prompt, retain the existing diagnostic, and create no workspace
- [x] #4 Focused CLI tests cover acceptance, decline, JSON, and non-interactive behavior, and help text describes the interactive offer
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extract the existing interactive missing-workspace initialization offer into one CLI surface helper shared by scan and web. 2. Call it before web serving, preserving the existing missing-workspace result on decline or when no confirmation hook is available. 3. Add focused web tests for accept, decline, JSON, and non-interactive paths and update help text. 4. Run focused CLI tests and the full repository check, then complete the required local reviews and merge after green CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one shared interactive initialization offer for web and scan. Web acceptance initializes, recovers the workspace, and continues into the existing loopback server; decline and automation retain the prior missing-workspace result. Validation passed: focused web and scan-offer tests, plus bun run check with 513 tests, formatting, typecheck, dependency boundaries, and compiled-binary verification.

Pre-PR review: both Terra xhigh passes and the single Claude pass completed. Fixed the accepted-initialization race so web continues when another process initializes concurrently, added its regression test, clarified plain-format help wording, and standardized prompt casing. Full check remained green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the missing-workspace initialization offer to interactive plain groma web, preserved fail-closed JSON/non-interactive behavior, reused the scan flow, and documented it. Verified all four paths with focused CLI tests and the complete bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
