---
type: Groma Project
title: Groma
groma:
  profile: architecture
---

Groma helps developers read and change software architecture. It stores architecture as Markdown and shows the same records in terminal and browser maps. Scanner plugins supply source evidence. The Backlog plugin supplies task data.

## Scan scope

This map covers the Groma application, browser code, scanner adapters, and the C#, Go, and Rust workers. Scanner package build tools and the plugin example are development code. Test projects and root build scripts are outside this map.

The Java worker source has no Maven project. The Java scanner does not cover that source. The map shows the Java adapter, but it does not show the internal Java worker components. JavaScript launchers, shell scripts, and documentation are also outside the scanner coverage.
