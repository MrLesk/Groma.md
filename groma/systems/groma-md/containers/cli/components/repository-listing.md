---
type: C4 Component
title: Repository inventory
status: stable
groma:
  id: repository-listing
  parent: cli
  code:
    - scanner: typescript
      file: src/repository-listing.ts
      symbol: repositoryListing
  group: Source scanning
description: Lists tracked, unignored project files through Git
---

Lists tracked and unignored project files through Git. Supplies the shared file inventory used by scanner discovery and source coverage.
