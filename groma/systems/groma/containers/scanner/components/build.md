---
type: C4 Component
title: Build
status: stable
groma:
  id: build
  parent: scanner
  code:
    - scanner: typescript
      file: scripts/build.ts
    - scanner: typescript
      file: src/compiled-asset.ts
      symbol: compiledAsset
---

Produces the standalone executable and embeds what it needs beyond the bundled code: the browser renderer, dependency credit files, the agent guide, and the native TypeScript worker. At runtime, `compiledAsset` tells a compiled binary from source mode with `Bun.isStandaloneExecutable` and resolves an embedded file under the embedded root, so the web viewer and agent instructions read the same assets whether run from source or as a release binary; the TypeScript scanner locates its embedded worker the same way.
