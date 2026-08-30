---
id: project-editor
kind: component
parent: web-viewer
code:
  - scanner: typescript
    file: src/viewers/web/project/editor.ts
    dependencies: 1
    dependents: 2
---

# Project editor

Edits the project name and Markdown description in one bounded source or preview surface beside the blueprint title plate.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Web server](web-server.md) | Saves a valid project profile | HTTP |
