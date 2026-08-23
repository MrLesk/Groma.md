---
id: TASK-40
title: Inspect this repository through a standalone TypeScript plugin
status: Done
assignee:
  - '@scan'
created_date: '2026-08-16 14:21'
updated_date: '2026-08-23 14:25'
labels: []
dependencies: []
references:
  - src/typescript-scanner.ts
  - docs/scanners/typescript/contract.md
  - typescript-graph
  - scanner-plugin
documentation:
  - docs/scanners/typescript/index.md
modified_files:
  - src/typescript-scanner.ts
  - test/typescript-scanner.test.ts
  - docs/scanners/typescript/contract.md
  - docs/scanners/typescript/observation.txt
  - src/typescript-graph.ts
  - >-
    groma/observed/systems/groma/containers/scanner/components/typescript-graph.md
  - groma/observed/systems/groma/containers/scanner/components/scanner-plugin.md
priority: high
type: spike
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When someone runs the TypeScript scanner plugin on its own, it prints an indented C4 observation derived from this repository's import graph. The plugin accepts configurable globs and ignore patterns and respects .gitignore. The standalone program does not read groma/ Markdown or import core. Folding these candidates through groma scan was delivered separately by TASK-50.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Running the TypeScript plugin as a standalone program prints an indented C4 observation derived from the import graph
- [x] #2 The plugin accepts configurable glob and ignore patterns and respects .gitignore
- [x] #3 The standalone plugin does not read groma/ files or import core
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. List TypeScript files through git ls-files with configurable globs and ignore patterns.
2. Build the relative-import graph and derive one system, container and component candidates, plus standalone container relationships.
3. Format the observation as an indented C4 tree while keeping the plugin independent from core and groma/ Markdown.
4. Document the mapping and verify the standalone program with focused tests. Candidate folding belongs to TASK-50.
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

Administrative finalization on 2026-08-23: removed the former criterion that groma scan remain empty because TASK-50 intentionally superseded it by folding candidates. Updated the task wording from a raw import-graph dump to the delivered C4 observation derived from that graph. Current focused verification: node --import=tsx --test test/typescript-scanner.test.ts, 8/8 passing.

Final cleanup after complexity review: removed unused external-import storage, unused scanner re-exports and the redundant claimed set; constrained relationship descriptions to starts or uses; moved the test import to the file-listing owner; clarified the scanner and graph architecture responsibilities through groma edit. The scoped source, tests and docs are net 13 lines smaller. Verification: node --import=tsx --test test/typescript-scanner.test.ts passed 8/8; node --import=tsx --test test/validate-architecture.test.ts passed 3/3; bun run typecheck passed; git diff --check passed. The cold simplicity review found no further deletion or consolidation, and the full-context targeted re-review found no regression. The scanner-plugin relationship wording remains accurate because typescript-graph owns systemName, fileLabel, displayName and kebabCase, while typescript-scanner owns C4 kinds and parentage. A live self-scan of this checkout is temporarily unavailable because unrelated active work has unstaged deletions still returned by git ls-files; the standalone fixture test exercises the supported command successfully.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Finalized the standalone TypeScript scanner as file selection, import evidence and one C4 mapping. Removed unused state and access paths, narrowed relationship labels, and clarified domain ownership, for a net reduction of 13 lines. Verified the standalone command and configuration boundaries with 8 focused tests, architecture validity with 3 tests, and TypeScript compilation.
<!-- SECTION:FINAL_SUMMARY:END -->
