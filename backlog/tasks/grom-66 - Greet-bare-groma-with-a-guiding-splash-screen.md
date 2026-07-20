---
id: GROM-66
title: Greet bare groma with a guiding splash screen
status: Done
assignee:
  - '@claude'
created_date: '2026-07-20 06:07'
updated_date: '2026-07-20 06:17'
labels:
  - cli
  - brand
milestone: m-4
dependencies:
  - GROM-65
references:
  - ../backlog.md/src/ui/root-entry.ts
  - src/cli/render.ts
priority: high
type: feature
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog.md greets a bare backlog run with a root-entry splash: identity, version, context-aware common commands, the instructions index, and a help pointer, colored only on an interactive terminal. Give bare groma the same first-contact quality for the two plain-text cases where it cannot open the visual blueprint: when no workspace exists (today two terse lines) and when the terminal is non-interactive (today the full usage dump). The splash presents the basic loop commands - init, scan, bare groma, web, and blueprint export - plus the instructions guides and command help. The wordmark stays lowercase groma.md with the green accent reserved for the .md suffix and the surveyed point; no ASCII-art logotype (uppercase block letters would break the lowercase wordmark rule).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bare groma without a workspace renders the splash in plain format: groma.md wordmark with version, one plain-language purpose line, a get-started section with init first followed by scan, bare groma, web, and blueprint export, the instructions guides, and a help pointer
- [x] #2 Bare groma in a non-interactive terminal with a workspace renders the splash with the common commands (scan, web, blueprint export), keeps the sentence about running bare groma in an interactive terminal, the instructions guides, and a help pointer
- [x] #3 ANSI color (bold titles, brand-green accent) appears only when stdout is an interactive terminal and NO_COLOR is unset; rendered output is otherwise byte-deterministic, and --format json output is unchanged and never carries escape codes
- [x] #4 Interactive bare groma with a workspace still opens the visual blueprint unchanged; render tests cover both splash states, the color gate, and json stability
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add src/cli/splash.ts: formatSplash({workspace: missing|ready, color}) renders the lowercase groma.md wordmark with version (green surveyed point and .md accent only when color), one purpose line, a get-started or common-commands section (init, scan, bare groma, web, blueprint export), the instruction guides from the embedded registry, and a command-help pointer; plain output stays byte-deterministic with no escape codes.
2. render.ts: renderCommandResult gains an optional presentation {color} argument; the overview workspace-missing and help kinds render through formatSplash; json rendering is untouched.
3. program.ts: compute color once (plain format, stdout TTY, NO_COLOR unset) and pass it to the post-host emits; keep the existing sentence about running bare groma in an interactive terminal inside the ready splash so current tests and habits hold.
4. Tests: splash content and color gating, render integration for both kinds, json stability; adjust any test pinned to the old two-line workspace-missing text; bun run check.
Supported boundary: splash only for the two plain overview fallbacks; interactive artifact opening and all structured output unchanged; no ASCII-art logotype without a brand decision.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
src/cli/splash.ts renders both splash states; render.ts routes the overview workspace-missing and help kinds through it with an optional color flag threaded from program.ts (plain format + stdout TTY + NO_COLOR unset). Color paints only bold section titles, the bold groma wordmark, and the brand-green truecolor surveyed point and .md suffix, matching the lockup accent exception; plain output is byte-deterministic with no escape codes. The ready splash keeps the run-bare-groma-in-an-interactive-terminal sentence so existing tests and habits hold. Two Iteration 1A black-box assertions that pinned the old two-line missing text and the old usage dump were updated to assert splash content, determinism, and the uncolored non-interactive guarantee.
Validation: bun run check green (436 tests incl. the updated compiled black-box); compiled binary output inspected in both states. Interactive artifact opening and all json output verified unchanged (splash tests assert json carries no escape codes).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bare groma now greets the two plain-text fallbacks with a guiding splash: the lowercase groma.md wordmark with version and surveyed-point accent, a purpose line, the loop commands (init, scan, bare groma, web, blueprint export), the built-in instruction guides, and a help pointer — context-aware for missing versus initialized workspaces, colored only on an interactive terminal with NO_COLOR respected, byte-deterministic otherwise, with json output untouched. Verified by the full check gate and compiled-binary inspection.
<!-- SECTION:FINAL_SUMMARY:END -->
