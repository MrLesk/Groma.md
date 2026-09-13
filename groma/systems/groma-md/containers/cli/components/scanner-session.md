---
type: C4 Component
title: Live scanner session
status: stable
groma:
  id: scanner-session
  parent: cli
  code:
    - scanner: typescript
      file: src/scanner/session.ts
  group: Source scanning
---

Owns the scanner state for an open viewer. Applies settings changes and connects source updates to architecture updates.
