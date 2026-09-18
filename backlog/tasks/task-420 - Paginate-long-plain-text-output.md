---
id: TASK-420
title: Paginate long plain-text output
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:32'
updated_date: '2026-09-18 06:19'
labels: []
dependencies: []
references:
  - src-core
  - src-cli
  - src-architecture-findings
  - src-lint-command
  - src-scanner
  - modules-discovery
modified_files:
  - src/list-window.ts
  - src/plain-world.ts
  - src/cli.ts
  - test-bun/plain-view.test.ts
  - src/architecture-findings.ts
  - src/lint-command.ts
  - src/scanner.ts
  - src/scanner/modules/discovery.ts
  - src/scanner/cli.ts
  - docs/agent-instructions/inspect.md
  - docs/product-model.md
  - docs/scanners/discovery.md
  - test-bun/list-window.test.ts
type: enhancement
ordinal: 486000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Plain-text commands print every item at once: `groma view --plain` printed 227 lines for callforpapers, `groma lint` 1,553 lines and `groma scanner discover` one line per PHP file. Agents lose context or truncate the output without knowing more exists. Backlog.md only offers `--limit`, which cuts the list silently and has no next page, so it does not tell an agent that items were left out. Agents already know grep's `-m`/`--max-count`, git log's `--max-count` with `--skip`, and grep's `-c`/`--count`; Groma reuses those names instead of inventing page numbers. Backlog.md gets the same options in its own task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Command help and agent instructions describe paging; focused tests cover page boundaries, the footer and stable order.
- [x] #2 Every Groma command whose plain output lists items prints one page of a fixed, documented size by default. `groma scan` is not paged because a second page would rescan; its summarized report stays short. The complete Markdown record from `groma view <id>` stays whole.
- [x] #3 Output cut by the default or chosen count ends with the item range, the total and the exact command that prints the next items; complete output has no footer.
- [x] #4 `--max-count <n>` sets how many items print and `--skip <n>` skips items first, like `git log`; item order is stable across runs so consecutive windows neither overlap nor skip items. Options match Backlog.md, which has no short flags for them.
- [x] #5 `--count` prints only the number of items, like grep.
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
1. src/list-window.ts (new): paging shared by the plain commands, named after git log --max-count/--skip and grep --count, following Backlog.md's list-window. parseListWindow reads the options (default page size 50 items, --count counts without the default), listPage selects the window of an ordered list, listWindowFooter names the printed range, the total and the typed command with a new --skip, printListPage prints one page plus an optional tail, and withListWindowOptions registers the three options.
2. src/plain-world.ts: the plain answers become head blocks, titled sections of items (an element entry, a relationship line, a flow or draft line), and tail blocks. One window spans the sections in order, so a cut page prints only the sections it reaches and ends with the footer; a complete page still prints every section, empty ones as none.
3. src/cli.ts: the view command takes the window options, any of them prints plain text, and renderPlainWorld/renderPlainRecord receive the window. groma view <id> without --plain keeps the complete Markdown record.
4. src/lint-command.ts with src/architecture-findings.ts: findings become one item each (architectureFindingLines), paged through printListPage; failures and the no-findings message are unchanged.
5. src/scanner/cli.ts with src/scanner/modules/discovery.ts: groma scanner discover pages its report lines and keeps its closing note; groma scanner list pages its inventory lines. --json output stays complete.
6. src/scanner.ts: the scan report summarizes findings as a count and the groma lint command instead of listing them, so the report stays short; groma scan takes no window options.
7. Docs: a Paging section in docs/agent-instructions/inspect.md, plus docs/product-model.md and docs/scanners/discovery.md.
8. Tests in test-bun/list-window.test.ts: page boundaries, the footer range, total and next command, --count, and consecutive windows of a paged view drill-down that neither overlap nor leave items out.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: src/list-window.ts holds the paging shared by the plain commands, following Backlog.md's list-window so the wording matches: parseListWindow reads --max-count, --skip and --count (default page 50 items; --count counts without the default page), listPage selects the window, listWindowFooter prints 'Showing <range> of <total> items.' plus 'Next: <the typed command with a new --skip>' when items follow, printListPage prints one page with optional closing lines, and withListWindowOptions registers the options. Any window option makes groma view print plain text.
plain-world.ts answers are now head blocks, titled sections of items (one element entry, relationship, flow or draft per item) and tail blocks; pagedAnswer spans the sections with one window, so a cut page prints only the sections it reaches and ends with the footer, while a complete page still prints every section with none where empty. groma lint pages one item per reportable finding (architectureFindingItems), groma scanner discover pages its report lines and keeps its closing note, and groma scanner list pages its inventory. --json results and the complete Markdown record stay whole. groma scan takes no window options; its report now counts findings and names groma lint instead of listing them.
Verification: test-bun/list-window.test.ts covers the default page and its continuation, chosen windows, refused values, the footer range, total and next command, the last page without a next command, --count, and two consecutive pages of a drill-down that together equal the complete answer. Real commands in this repository: groma scan ends with '53 possible duplicate findings. Run groma lint to review them.' (was about 1,200 lines), groma lint --max-count 2 ends with 'Showing 1-2 of 52 items. Next: groma lint --max-count 2 --skip 2', groma view cli --plain --max-count 3 ends with 'Showing 1-3 of 83 items. Next: groma view cli --plain --max-count 3 --skip 3', groma view src/cli.ts --max-count 2 and groma scanner discover --max-count 3 page the same way, groma scanner discover --count prints 22, and the complete groma view --plain has no footer. bun run check in an isolated worktree at fb4ea929 with only TASK-420 changes passed: biome and tsc clean apart from existing warnings in other files, 16 node tests and 441 bun tests pass (25 skipped), 0 fail.

Cold review applied. Must-fix: a section that holds no item anywhere now prints on every page, so paged reading shows the same sections as the complete answer (pagedAnswer drops a section only when its items sit on another page); a window option no longer forces plain output when a target is given, so groma view <id> --max-count keeps the complete Markdown record while a source-file target still pages; and groma view --plain --count answers 0 in an empty project instead of the setup guidance.
Accepted optional findings: the scan report line is now 'Run groma lint to review the findings.' because the summary already counts them; list-window uses Backlog.md's exact validation sentences and refuses --count with --json (groma scanner discover --json --count exits 1); architectureFindingText was folded into architectureFindingItems and plainBlock, pagedAnswer, PlainSection and plainRelationshipSection are private again; every call site passes process.argv.slice(2) instead of the parser defaulting to it; the reassembly test now compares all content lines of two pages against the complete answer, asserts the empty Flows index on a page, and checks a past-the-end page printing 'Showing 0 of N items.'.
Re-verification: focused tests pass (10 across list-window and plain-view). Real commands: groma view src-cli --max-count 2 prints the complete Markdown record, groma view src/cli.ts --max-count 2 pages the file answer, groma view --plain --count answers 0 in test/fixtures/empty-project, groma scanner discover --json --count exits 1 with the refusal, and groma scan ends with the single lint line. bun run check in an isolated worktree at 23877a72 with only TASK-420 changes passed: biome and tsc clean apart from existing warnings in other files, 16 node tests and 450 bun tests pass (25 skipped), 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Plain lists now print one page of 50 items and end with the printed range, the total and the exact command for the following items, chosen with --max-count and --skip as in git log, or counted with --count as in grep; complete output has no footer. src/list-window.ts holds the shared paging, following Backlog.md so agents meet the same options and wording. groma view --plain, the drill-down, the source-file answer, groma lint, groma scanner discover and groma scanner list page their items, while --json results and the complete Markdown record of groma view <id> stay whole. groma scan is not paged: its report now counts findings and names groma lint, which replaced about 1,200 lines with one on this repository. Verified with test-bun/list-window.test.ts (default page and continuation, chosen windows, refused values, footer range, total and next command, --count, empty-section paging, past-the-end page), the real commands in this repository, and bun run check in an isolated worktree (16 node and 450 bun tests pass).
<!-- SECTION:FINAL_SUMMARY:END -->
