---
id: scanner
kind: container
parent: groma
technology: TypeScript import graph
---

# Scanner

Runs a scan once or as a watch: the language plugin reads the repository, core folds the candidates into Markdown, and the command prints `ok` with a short summary. It never writes architecture Markdown itself and never invents an architecture id.
