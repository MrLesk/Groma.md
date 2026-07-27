---
id: architecture-workspace
kind: container
parent: groma
---

# Architecture workspace

Keeps the current architecture and named plan revisions as ordinary Markdown files
inside the repository.

## Structure

```text
groma/
  observed/
  plans/
    <revision-name>/
```

## Technology

Markdown files on the local filesystem.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Git](../../../git/system.md) | Versions and reviews architecture changes | Git |
