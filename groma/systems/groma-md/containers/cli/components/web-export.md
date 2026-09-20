---
type: C4 Component
title: Static export
status: stable
groma:
  id: web-export
  parent: cli
  code:
    - scanner: typescript
      file: src/viewers/web/export.ts
  group: Browser delivery
description: Writes a static browser map that runs without a Groma server
---

Packages the working tree, one commit, or two explicit commits as a static browser map. History owns snapshot and comparison meaning; the shared map and source domains prepare their normal views. Export bundles those views and their source text without task data. The published browser selects only bundled revisions and never reads Git, Backlog, or a Groma server.
