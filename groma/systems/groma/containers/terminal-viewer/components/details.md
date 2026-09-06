---
type: C4 Component
title: Details
status: stable
groma:
  id: details
  parent: terminal-viewer
  group: Terminal presentation
  code:
    - scanner: typescript
      file: src/viewers/tui/panes/details.ts
    - scanner: typescript
      file: src/viewers/tui/panes/code.ts
---

Renders the selected architecture, flow and task in What, How and Tasks. It presents task definitions, file change summaries, numbered source and unified diffs, and supplies exact reading-row links for opening files and references.
