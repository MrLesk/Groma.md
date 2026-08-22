---
id: typescript-graph
kind: component
parent: scanner
code:
  - scanner: typescript
    file: src/typescript-graph.ts
    symbol: kebabCase
---

# Typescript graph

Builds the project import graph and reads containers out of it: the `bin` file or the most-imported root is the CLI, roots nothing else imports are sibling containers, files two containers share are hubs, and every other file is a component of the nearest container, named in kebab-case.
