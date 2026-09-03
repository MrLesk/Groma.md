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
      dependencies: 14
      dependents: 2
---

Draws the selected architecture element, relationship, command flow, or task in the terminal details pane.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Source inspection](../../view-host/components/read-read.md) | Reads selected structure, source, and task file diffs | TypeScript |
