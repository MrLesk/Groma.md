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

Opens one upright editor beside the title plate's boxed pencil, keeps long Markdown inside a bounded scrolling surface, switches between source and a Comark HTML preview sanitized for the browser, and sends the changed project profile to the web host.
