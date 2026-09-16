---
id: TASK-177
title: Restore Groma web startup after scanner adoption
status: Done
assignee:
  - '@codex'
created_date: '2026-08-26 06:05'
updated_date: '2026-09-05 15:23'
labels: []
dependencies: []
references:
  - scan-reconciler
  - web-viewer
  - typescript-scanner
modified_files:
  - >-
    groma/observed/systems/groma/containers/cli/components/components/blueprint.md
  - groma/observed/systems/groma/containers/cli/components/components/shell.md
  - >-
    groma/observed/systems/groma/containers/scanner/components/typescript-scanner.md
  - groma/observed/systems/groma/containers/scanner/components/csharp-scanner.md
  - groma/observed/systems/groma/containers/graph/components/naming.md
  - groma/observed/systems/groma/containers/graph/container.md
  - groma/observed/systems/groma/containers/cli/components/naming.md
priority: high
type: bug
ordinal: 189000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer running groma web in the shared main workspace must reach the current architecture map. The command currently fails after the shared TypeScript and C# scanner adoption, which prevents verification of the scanner result in the supported web flow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Running groma web from the repository starts the web server without a scanner or startup error
- [x] #2 Opening the served URL renders the current Groma architecture map without a framework overlay or relevant console error
- [x] #3 The running web flow uses the shared scanner observation path and remains able to refresh after a supported source-file change
- [x] #4 The stale duplicate-ID cause is recorded, existing duplicate validation remains covered, and focused scanner evidence checks pass after cleanup
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
1. Reproduce startup from the shared root and isolate invalid generated architecture records without changing other agents' work.
2. Remove only stale duplicate-ID and duplicate-source ownership records, then make the authoritative TypeScript and C# component Code lists show their complete domain-grouped implementations without changing scanner inference.
3. Start Groma web on a task-owned port, inspect the payload and rendered map, trigger a supported TypeScript source event, and verify the live generation advances while curated scanner grouping remains stable and unknown files remain singleton evidence.
4. Run focused model/scanner/web checks, the exact full project check, one cold simplicity review, specification and quality reviews, and the required full-context complexity review with one targeted re-review of any blocking finding.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Risk and cause: L2 because web startup crosses architecture load, scan/watch, and rendered UI in a shared dirty workspace. `bun src/cli.ts web` reproduced `DUPLICATE_ID` before binding a port. A scanner process loaded before TASK-175 had written stale untracked Blueprint and Shell records under CLI, duplicating the current web-viewer IDs and source ownership. The current reconciler already allocates new IDs globally, so compatibility or recovery code was not added; only obsolete Groma-owned prototype state was removed.

Visible architecture correction: verification found that the source folders were grouped by scanner domain but the authored scanner cards still listed only one file each. The TypeScript scanner authority now owns files.ts, graph.ts, and scan.ts. The C# scanner authority now owns adapter.ts, Contract.cs, Scanner.cs, Command.cs, and Program.cs. A quality review then found stale duplicate ownership of graph.ts through an inferred Graph container. That container and its child were removed. The next supported scan kept graph.ts only in TypeScript scanner and recreated still-unknown src/naming.ts as a separate singleton under inferred CLI placement.

Rendered verification: `groma web --port 4777` started. Browser QA at http://localhost:4777 showed title groma.md, meaningful SVG/map content, no framework overlay, and no console warnings or errors. The Dark control changed to Light. The How it's built views showed all three TypeScript files and all five C# files. After the final cleanup, no Graph container remained. Touching src/scanner/typescript/scan.ts advanced generation 9 to 10 through watchScan while both curated scanner memberships stayed unchanged.

Checks: scanner evidence 6/6, web-live 5/5, architecture model errors 16/16, C# .NET 10 tests 4/4, plain view, duplicate-ID search, single graph.ts ownership, and git diff --check passed. The first full check had one isolated live-watch timeout while 167 other Bun tests passed; its focused rerun passed immediately, and the exact next `bun run check` passed with 81 Node and 168 Bun tests.

Reviews: the cold simplicity and specification reviews found no blockers. The first quality/full-context reviews found the stale Graph ownership; their targeted re-reviews passed after removal. The final full-context result chose the current boundary as simpler and safer for junior developers: scanners emit validated atomic evidence, placement is inferred separately, curated Markdown alone owns multi-file architecture grouping, and unknown files remain singletons.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Restored Groma web by deleting stale pre-adoption records that caused duplicate IDs and duplicate graph.ts ownership, then made the authoritative scanner cards show one three-file TypeScript skyscraper and one five-file C# skyscraper. Verified startup and the rendered How it's built views in the browser with no overlay or console errors; a supported TypeScript event advanced generation 9 to 10 without changing curated grouping. Focused model/scanner/web and 4 .NET tests passed, the exact full check passed with 81 Node and 168 Bun tests, and cold/specification/quality/full-context reviews passed after the Graph ownership correction.
<!-- SECTION:FINAL_SUMMARY:END -->
