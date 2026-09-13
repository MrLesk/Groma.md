---
type: C4 Component
title: Project scan support
status: stable
groma:
  id: scanners-projects
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/projects.ts
    - scanner: typescript
      file: plugins/scanners/project-scanner.ts
      symbol: projectScanner
    - scanner: typescript
      file: plugins/scanners/observations.ts
  group: Scanner plugins
---

Finds supported project inputs. Combines project results with paths that start at the repository root.
