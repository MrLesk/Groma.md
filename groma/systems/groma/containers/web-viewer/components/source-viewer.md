---
type: C4 Component
title: Source viewer
status: stable
groma:
  id: source-viewer
  parent: web-viewer
  code:
    - scanner: typescript
      file: src/viewers/web/source/control.ts
      dependencies: 4
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/source/view.ts
      dependencies: 4
      dependents: 2
    - scanner: typescript
      file: src/viewers/web/source/highlight.ts
      dependencies: 1
      dependents: 3
    - scanner: typescript
      file: src/viewers/web/organisms/code-lists.ts
      dependencies: 3
      dependents: 1
---

Controls browser source inspection and renders owned file lists, declarations and highlighted code inside Details. Opening code keeps the architecture selection and uses the shared source readers and syntax tokens.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Web server](web-server.md) | Requests only selected Code from the active revision | HTTP |
| [Web viewer details](web-viewer-details.md) | Reuses the selected component inspector | DOM |
| [Source inspection](../../view-host/components/read-read.md) | Reads selected component structure and source | TypeScript |
