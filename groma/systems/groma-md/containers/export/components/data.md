---
type: C4 Component
title: Browser data
status: stable
groma:
  id: data
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/data.ts
    - scanner: typescript
      file: src/viewers/web/authoring.ts
  group: Browser session
---

Reads live updates from the local server or saved data from a static export. Sends permitted write and scanner actions to the server.
