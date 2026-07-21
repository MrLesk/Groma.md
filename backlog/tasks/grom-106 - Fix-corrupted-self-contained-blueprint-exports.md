---
id: GROM-106
title: Fix corrupted self-contained blueprint exports
status: Done
assignee:
  - '@codex'
created_date: '2026-07-21 21:47'
updated_date: '2026-07-21 21:51'
labels: []
dependencies: []
modified_files:
  - src/web/export.ts
  - src/web/tests/export.test.ts
  - src/cli/tests/export.test.ts
priority: high
type: bug
ordinal: 96000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `groma export` command reports success but corrupts the inlined web-client JavaScript when replacement-pattern tokens occur in compiled assets or snapshot content. Exported blueprints must open as valid deterministic offline HTML rather than a blank or broken page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The final exported HTML preserves compiled script, stylesheet, and snapshot content containing JavaScript replacement-pattern tokens without interpolation corruption
- [x] #2 The final inline client JavaScript parses and the exported blueprint renders from disk as a meaningful read-only blueprint
- [x] #3 Regression coverage fails on the previously corrupted real bundle shape and keeps export deterministic, self-contained, network-free, and bounded
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Trace the export assembly boundary and encode a regression that reproduces replacement-token corruption. 2. Insert dynamic assets and snapshot content through literal callback replacements without changing the bundle contract. 3. Verify targeted export/snapshot/CLI tests, parse the generated production bundle, render the file-based artifact where the available browser permits, and run the proportional repository gate.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced the defect with all three JavaScript replacement tokens: replacement-string interpolation injected the matched closing tag plus document prefix/suffix into styles, snapshot JSON, and the compiled module. Changed the two dynamic HTML insertions to replacement callbacks. Added literal-preservation coverage and a compiled CLI export assertion that parses the real inlined client module. Focused export and snapshot tests pass; a native build exported the 95-component self-blueprint with a valid inline module whose bytes match the live embedded client after the intentional closing-script escape.

Final verification: bun run check passed formatting, both TypeScript configurations, architecture boundaries, 513 tests / 3,248 assertions, native build/smoke, and the compiled Iteration 1A workflow. A generated 760,438-byte self-blueprint contained one parseable inline module with zero imports and no external script or stylesheet tags. After only reversing the mandatory closing-script escape, that module matched the live embedded client exactly. Browser QA rendered generation 19 with all eight top-level domains and successfully opened web component detail; direct file URL automation was unavailable because the in-app Browser blocks file URLs, so disk behavior is covered compositionally by valid self-contained HTML, the static snapshot adapter test, exact client parity, and live client interaction.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed `groma export` corruption by inserting dynamic styles and body content through literal replacement callbacks, preventing `$&`, `$\u0060`, and `$\u0027` from being interpreted as replacement syntax. Added regressions for asset/snapshot token preservation and parsing of the actual compiled inline client. Verified the full repository gate, a production self-export, self-containment, client-byte parity after required HTML escaping, and rendered component interaction.
<!-- SECTION:FINAL_SUMMARY:END -->
