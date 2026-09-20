---
type: Groma Flow
title: Review architecture history
groma:
  id: review-architecture-history
---

A developer opens the revision selector in the live browser map and selects a compatible Git revision. The browser requests the revision through the local host, which reads the selected repository snapshot through Git. Groma loads the architecture from a temporary snapshot and returns it for display without replacing working files. Returning to Live restores the current map.

## Steps

| From | To | Action |
| --- | --- | --- |
| [Developer](../actors/developer.md) | [Revision selector](../systems/groma-md/containers/export/components/revision-control.md) | Select a compatible architecture revision |
| [Revision selector](../systems/groma-md/containers/export/components/revision-control.md) | [Browser data](../systems/groma-md/containers/export/components/data.md) | Request the selected revision |
| [Browser data](../systems/groma-md/containers/export/components/data.md) | [Web host](../systems/groma-md/containers/cli/components/web-server.md) | Request the architecture payload for that revision |
| [Web host](../systems/groma-md/containers/cli/components/web-server.md) | [Revision history](../systems/groma-md/containers/cli/components/history-revisions.md) | Load the selected repository snapshot |
| [Revision history](../systems/groma-md/containers/cli/components/history-revisions.md) | [Git](../externals/git.md) | Read the selected commit as an archive for Groma to load |
