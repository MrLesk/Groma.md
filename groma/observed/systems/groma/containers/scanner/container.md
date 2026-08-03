---
id: scanner
kind: container
parent: groma
---

# Scanner

Owns the single generated component directory reserved for bounded source
scan results.

## Structure

```text
groma/observed/systems/groma/containers/scanner/
  container.md
  components/  # generated; scanner/emitter-owned
```

## Technology

Local scanner runtime, language plugins, and canonical Markdown emission.
