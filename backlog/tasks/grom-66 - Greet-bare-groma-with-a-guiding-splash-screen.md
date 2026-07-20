---
id: GROM-66
title: Greet bare groma with a guiding splash screen
status: To Do
assignee: []
created_date: '2026-07-20 06:07'
labels: []
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
- [ ] #1 Bare groma without a workspace renders the splash in plain format: groma.md wordmark with version, one plain-language purpose line, a get-started section with init first followed by scan, bare groma, web, and blueprint export, the instructions guides, and a help pointer
- [ ] #2 Bare groma in a non-interactive terminal with a workspace renders the splash with the common commands (scan, web, blueprint export), keeps the sentence about running bare groma in an interactive terminal, the instructions guides, and a help pointer
- [ ] #3 ANSI color (bold titles, brand-green accent) appears only when stdout is an interactive terminal and NO_COLOR is unset; rendered output is otherwise byte-deterministic, and --format json output is unchanged and never carries escape codes
- [ ] #4 Interactive bare groma with a workspace still opens the visual blueprint unchanged; render tests cover both splash states, the color gate, and json stability
<!-- AC:END -->
