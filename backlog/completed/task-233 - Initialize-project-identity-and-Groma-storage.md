---
id: TASK-233
title: Initialize project identity and Groma storage
status: Done
assignee:
  - '@codex'
created_date: '2026-09-01 19:01'
updated_date: '2026-09-01 19:46'
labels: []
dependencies: []
references:
  - architecture-reader
  - architecture-writer
  - project-profile
  - groma-filesystem
  - project-initialization
modified_files:
  - src/groma-filesystem.ts
  - src/architecture-reader.ts
  - src/markdown-emitter.ts
  - src/project-profile.ts
  - src/scanner/modules/config.ts
  - src/architecture-watch.ts
  - src/history/git.ts
  - src/architecture-path.ts
  - src/create.ts
  - src/accept.ts
  - src/edit.ts
  - src/curate.ts
  - src/scan-reconciler.ts
  - src/initialize.ts
  - src/cli.ts
  - test/instructions.test.ts
  - test/initialize.test.ts
  - test-bun/git-history.test.ts
  - test-bun/scanner-modules.test.ts
  - src/instructions.ts
  - groma/observed/systems/groma/containers/core/components/groma-filesystem.md
  - >-
    groma/observed/systems/groma/containers/core/components/architecture-reader.md
  - >-
    groma/observed/systems/groma/containers/core/components/architecture-writer.md
  - groma/observed/systems/groma/containers/core/components/project-profile.md
  - docs/index.md
  - docs/component-markdown.md
  - docs/scanners/index.md
  - docs/scanners/creating-a-plugin.md
  - docs/viewers/web/index.md
  - AGENTS.md
  - src/scanner.ts
  - >-
    groma/observed/systems/groma/containers/cli/components/project-initialization.md
type: feature
ordinal: 253000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer initializes an uninitialized repository, Groma records the project identity, creates the architecture package in the chosen visible or hidden directory, and makes every later Groma architecture operation use that same storage boundary.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Interactive groma init asks for the project name and offers groma/ as the recommended default or .groma/ as the hidden alternative.
- [x] #2 Initialization creates a valid Groma package under the selected directory, stores the project name as the project.md title, and reconciles the managed agent-instruction block.
- [x] #3 When exactly one Groma directory already exists, initialization and later commands reuse it without asking for or storing a second location.
- [x] #4 When both groma/ and .groma/ exist, Groma stops with a clear ambiguity error before writing files.
- [x] #5 Non-interactive initialization accepts an explicit project name and directory and fails before writing when either required value is missing.
- [x] #6 All Groma-owned architecture reads, writes, watches, scanner configuration, and history path selection resolve through one shared filesystem component; callers do not choose between groma/ and .groma/.
- [x] #7 Tests cover visible, hidden, existing, ambiguous, repeated, and non-interactive initialization behavior.
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
1. Add one Core Groma filesystem component that resolves exactly one visible or hidden storage root and owns Groma-relative path conversion plus file reads, writes, listing, deletion, existence checks, and watches.
2. Route architecture loading and authoring, project profiles, scanner configuration, architecture watching, and Git history path selection through that component without changing unrelated repository filesystem access.
3. Add an initializer that validates the existing or selected root and project identity before creating the minimum valid OKF package and reconciling agent instructions.
4. Extend groma init with interactive name/location prompts and explicit non-interactive project-name and directory inputs.
5. Cover visible, hidden, existing, conflicting, repeated, and non-interactive flows plus representative hidden-root architecture operations.
6. Update the public contract and observed architecture without overlapping active unrelated task files, then run focused checks and bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one GromaFileSystem owner for visible/hidden root discovery and Groma-owned file operations. Architecture readers, writers, project profile, scanner configuration, watches, authoring paths, and history path selection now resolve through it.

Added project initialization with project-name and directory prompts, explicit non-interactive inputs, the minimum OKF package, existing-root reuse, ambiguity failure before writes, and managed agent-instruction reconciliation.

Focused verification passes: changed-file Biome, TypeScript, 46 Node initialization/architecture/authoring tests, 2/2 Git history tests, the hidden-root scanner configuration test, and git diff check. The full Node run reaches 102/104; only the pre-existing shared-host scan-watch failures remain (EMFILE and dependent empty watcher output).

Cold simplicity review found no blocking complexity. Removed the unnecessary absoluteSource bridge so source-file operations now pass through the same storage-relative path boundary. Post-simplification Biome, TypeScript, and all 5 initialization tests pass.

Implementer specification self-review: all seven acceptance criteria are covered by initialization, shared-root routing, public documentation, and focused tests. Implementer quality self-review found one duplicated literal Groma root in the source watcher exclusion list; src/scanner.ts now consumes gromaDirectories from the shared filesystem component. Changed-file Biome and TypeScript pass. The isolated scan-watch test remains blocked by the shared host's pre-existing EMFILE watcher limit.

Full-context complexity review endorsed the shared GromaFileSystem design. With user approval, corrected the observed map: added code ownership for groma-filesystem, added Project initialization under CLI Command surface, grouped Project profile with Groma filesystem under Architecture storage, and corrected the selected-root description. Architecture validation passes with 76 elements and 89 relationships. Final focused verification passes: 39 Node tests, 2 Git history tests, 1 hidden-root scanner configuration test, changed-file lint, TypeScript, and git diff check. Full bun run check reaches 102/104 Node tests; only the pre-existing shared-host EMFILE scan-watch failure and its dependent empty-output assertion remain.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented project-aware initialization and one shared Groma filesystem boundary. groma init now selects visible or hidden storage, records the project title, creates the minimum package, reuses one existing root, rejects ambiguity before writes, and supports explicit non-interactive inputs. Readers, writers, watchers, scanner configuration, history, and authoring now share the selected-root owner. Verified with 42 focused tests, TypeScript, changed-file lint, architecture validation, and diff checks; the full suite retains only the known shared-host EMFILE watcher failures.
<!-- SECTION:FINAL_SUMMARY:END -->
