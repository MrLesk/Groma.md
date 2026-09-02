---
type: C4 Component
title: Project editor
status: stable
groma:
  id: project-editor
  parent: web-viewer
  code:
    - scanner: typescript
      file: src/viewers/web/project/editor.ts
      dependencies: 1
      dependents: 2
---

Edits the project title, optional concise description, and Markdown overview in one bounded source or preview surface beside the blueprint title plate.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Web server](web-server.md) | Saves a valid project profile | HTTP |
