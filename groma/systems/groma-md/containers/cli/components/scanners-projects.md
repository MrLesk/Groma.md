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
    - scanner: typescript
      file: plugins/scanners/typescript-project.ts
    - scanner: typescript
      file: plugins/scanners/entry-points/javascript.ts
      symbol: withJavaScriptEntries
    - scanner: typescript
      file: plugins/scanners/entry-points/source.ts
  group: Scanner support
description: Finds language project roots and reports paths from the repository root
---

Finds supported source projects and composes observations with repository-relative paths. Reads declared JavaScript-family execution entries and their local source inputs through the scanners’ existing compilers. These shared helpers report evidence; core owns application placement.
