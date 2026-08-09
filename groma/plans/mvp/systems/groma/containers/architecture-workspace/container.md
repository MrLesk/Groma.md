---
id: architecture-workspace
kind: container
parent: groma
---

# Architecture workspace

Keeps observed, missing, and planned architecture as ordinary Markdown files inside the repository.

## Structure

```text
groma/
  observed/
  missing/
  plans/
    mvp/
```

## Technology

Markdown files on the local filesystem.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Git](../../../git/system.md) | Versions and reviews architecture changes | Git |
