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
      dependencies: 16
      dependents: 3
    - scanner: typescript
      file: src/viewers/tui/panes/code.ts
      dependencies: 4
      dependents: 2
---

Renders the selected architecture, flow and task in What, How and Tasks. It presents task definitions, file change summaries, numbered source and unified diffs, and supplies exact reading-row links for opening files and references.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Source inspection](../../view-host/components/read-read.md) | Reads selected structure, source, and task file diffs | TypeScript |
