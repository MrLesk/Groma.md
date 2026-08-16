---
id: TASK-40
title: Inspect this repository through a standalone TypeScript plugin
status: In Progress
assignee:
  - '@scan'
created_date: '2026-08-16 14:21'
updated_date: '2026-08-16 17:40'
labels: []
dependencies: []
references:
  - src/typescript-scanner.ts
  - docs/scanners/typescript/contract.md
documentation:
  - docs/scanners/typescript/index.md
modified_files:
  - src/typescript-scanner.ts
  - test/typescript-scanner.test.ts
  - docs/scanners/typescript/contract.md
  - docs/scanners/typescript/observation.txt
priority: high
type: spike
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When someone runs the TypeScript scanner plugin on its own, it prints an import graph of this repository. The plugin takes configurable globs and ignore patterns, and respects .gitignore. It does not fold into Markdown and does not change groma scan, core, or observed architecture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Running the TypeScript plugin as a standalone program prints an import graph for this repository
- [ ] #2 The plugin accepts configurable glob and ignore patterns and respects .gitignore
- [ ] #3 groma scan still prints created 0, refreshed 0, matched 0 and does not write architecture Markdown
- [ ] #4 The plugin does not read groma/ files or import core
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Promote CLI imports to containers only when fan-in is exclusive to CLI; promote a file to a hub only when two or more already-identified containers import it and it has its own project imports.
2. Emit one starts/uses edge per container pair from the import graph. starts only when CLI is the sole importer.
3. Name index.ts from its directory; keep one parent per file. Drop Groma-only view/web/scan verbs.
4. Update tests and contract. Rescan Groma and Backlog.md. Do not fold or edit observed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Standalone dump is bun src/typescript-scanner.ts. First cut: package.json name is the system, src directories are ancestors, each .ts file is a component, id is ancestors/kebab(name). scanTypeScriptSource stays empty. Focused tests 4/4 plus cli-scan; this repo prints 1 system, 6 containers, 36 components. groma scan remains created 0.

Wrote the standalone dump to docs/scanners/typescript/observation.txt.

Wrote the expected standalone observation to docs/scanners/typescript/expected.txt: 1 system, 4 containers, 8 components, 1 group. People, Git, and Architecture workspace stay out.

Generic TypeScript mapping: package name is the system; peel empty folders; folders with source are containers; skip atoms/utils/internal-style folders; sibling areas stay visible. This repo dumps 1 system, 3 containers, 22 components. TUI rule modules are visible; atoms/molecules/organisms are not. groma scan still empty. Nest/Next left as future plugins.

Standalone plugin now lists files via git ls-files plus configurable --glob/--ignore, then prints an import graph. Roots include src/cli.ts. Focused tests 6/6. groma scan still created 0. No core or groma/observed changes.

Observation dump is an ASCII import tree from roots so CLI hierarchy is readable.

Standalone dump is now indented C4 candidates (kind, name, parent, code) that core would consume. CLI is a container. groma scan still empty. No observed or core changes.

Dump now matches the approved C4 picture: five sibling containers (CLI, Core, Scanner, Terminal viewer, Web viewer), rule-module components, CLI view/web/scan relationships, modes use Core. Paint and unused roots omitted. groma scan still empty.

Three-rule cut: exclusive CLI modes, hubs only when two already-identified containers import a file with a subgraph, one starts/uses edge per container pair, index.ts named from its directory. Focused tests 8/8. groma scan still created 0. Groma dump is 5 sibling containers (Cli, Core, Scanner, Server, Terminal viewer) and 14 components. Backlog.md dump is 55 containers, 55 components, 217 relationships (10 starts, 207 uses). No observed or core changes.

TASK-50 now folds candidates. Spike AC 3 (scan stays created 0) is superseded by that fold.
<!-- SECTION:NOTES:END -->
