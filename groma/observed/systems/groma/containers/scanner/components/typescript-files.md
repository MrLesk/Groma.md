---
id: typescript-files
kind: component
parent: scanner
code:
  - scanner: typescript
    file: src/typescript-files.ts
    symbol: isTypeScriptScanFile
---

# Typescript files

Decides which files a scan reads: `git ls-files` filtered by the glob and ignore lists, with `.gitignore` honoured and declaration and test files skipped. The watch uses the same file set.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Git](../../../../git/system.md) | Lists the tracked files | git ls-files |
