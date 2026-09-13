---
id: TASK-374
title: Remove scanned components after their Code references are cleared
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 14:21'
updated_date: '2026-09-13 14:25'
labels: []
dependencies: []
references:
  - authoring
  - commands
  - welcome
  - scanner-session
  - groma-session
  - discovery-rules
  - framework-package
  - go-scanner-smoke
  - observations
  - official-catalog
  - project-scanner
  - published
  - react-scanner-smoke
  - scanner-artifact-registry
  - scanner-index
  - scanners-projects
  - smoke-compiled-build
  - smoke
  - source-imports
  - src-discovery
  - src-projects
  - structure
  - typescript-build
  - typescript-scanner
  - validate-callforpapers-artifacts
  - validate-csharp-package
  - validate-csharp-repository
  - validate-native-scanner-artifact
  - watch-patterns
  - modules-settings
  - settings-model
  - settings
  - scanner-source-watch
  - source-watch
  - scanner-settings
  - read-read
  - scanners-settings
modified_files:
  - src/removable.ts
  - src/remove.ts
  - src/cli.ts
  - src/instructions.ts
  - src/welcome/model.ts
  - docs/agent-instructions/index.md
  - docs/product-model.md
  - test/fixtures/removal/obsolete.md
  - test-bun/removal.test.ts
  - groma/scanners.json
  - groma/relationships.md
  - groma/systems/groma/containers/groma-session/components/scanner-session.md
  - groma/systems/groma/containers/groma-session/container.md
  - groma/systems/groma/containers/scanner/components/discovery-rules.md
  - groma/systems/groma/containers/scanner/components/framework-package.md
  - groma/systems/groma/containers/scanner/components/go-scanner-smoke.md
  - groma/systems/groma/containers/scanner/components/observations.md
  - groma/systems/groma/containers/scanner/components/official-catalog.md
  - groma/systems/groma/containers/scanner/components/project-scanner.md
  - groma/systems/groma/containers/scanner/components/published.md
  - groma/systems/groma/containers/scanner/components/react-scanner-smoke.md
  - >-
    groma/systems/groma/containers/scanner/components/scanner-artifact-registry.md
  - groma/systems/groma/containers/scanner/components/scanner-index.md
  - groma/systems/groma/containers/scanner/components/scanner-smoke-compiled.md
  - groma/systems/groma/containers/scanner/components/scanners-projects.md
  - groma/systems/groma/containers/scanner/components/smoke-compiled-build.md
  - groma/systems/groma/containers/scanner/components/smoke-compiled.md
  - groma/systems/groma/containers/scanner/components/smoke.md
  - groma/systems/groma/containers/scanner/components/source-imports.md
  - groma/systems/groma/containers/scanner/components/src-discovery.md
  - groma/systems/groma/containers/scanner/components/src-projects.md
  - groma/systems/groma/containers/scanner/components/structure.md
  - groma/systems/groma/containers/scanner/components/typescript-build.md
  - groma/systems/groma/containers/scanner/components/typescript-scanner.md
  - >-
    groma/systems/groma/containers/scanner/components/validate-callforpapers-artifacts.md
  - groma/systems/groma/containers/scanner/components/validate-csharp-package.md
  - >-
    groma/systems/groma/containers/scanner/components/validate-csharp-repository.md
  - >-
    groma/systems/groma/containers/scanner/components/validate-native-scanner-artifact.md
  - groma/systems/groma/containers/scanner/components/watch-patterns.md
  - groma/systems/groma/containers/settings/components/modules-settings.md
  - groma/systems/groma/containers/settings/components/settings-model.md
  - groma/systems/groma/containers/settings/container.md
  - >-
    groma/systems/groma/containers/source-watch/components/scanner-source-watch.md
  - groma/systems/groma/containers/source-watch/container.md
  - >-
    groma/systems/groma/containers/terminal-viewer/components/scanner-settings.md
  - groma/systems/groma/containers/view-host/components/read-read.md
  - groma/systems/groma/containers/web-viewer/components/scanners-settings.md
type: enhancement
ordinal: 420000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A scan removes references to deleted source files but leaves the architecture component for explicit curation. The remove command currently rejects that empty scanned component, leaving obsolete smoke-test records impossible to clean up through Groma.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma remove accepts an observed component with no Code references, while observed components with Code and observed systems or containers remain protected.
- [x] #2 Existing flow, child and incoming-relationship checks still block removal; removing an eligible empty component uses the existing authoring writer.
- [x] #3 CLI help and current human and agent documentation describe scanning away deleted Code references before explicit component removal.
- [x] #4 The Vue and Rust compiled smoke components are cleaned up through the Groma scan and remove flow; focused lifecycle tests and bun run check pass.
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
Relax only the observed-component guard when its Code list is empty. Test scan-to-empty-to-remove and retained dependency guards using fixtures. Update removal guidance, verify the CLI, then reconcile and remove the two obsolete live records using Groma operations.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Selecting the published scanner triggered an already open viewer to scan before the explicit CLI scan. Compared the live architecture with the pre-scan disposable-copy index and immediately recorded every resulting path and affected ID. The explicit scan then made no additional changes.

Implemented the empty-Code component exception in the shared removal guard. Existing flow, incoming relationship and child checks remain; scanned systems and containers remain protected. Updated CLI help, welcome helper, human instructions and agent guidance. No new OKF metadata or C4 concepts: ordinary readers retain the existing component documents until an explicit removal; authoring interprets the existing Code list. Two concurrent fixture tests cover scan-to-empty-to-remove, unchanged neighbors/relationships and retained protections. Full bun run check passed 16 Node plus 289 Bun tests, with six existing native skips. git diff --check passed. Own specification, quality and simplicity review passed: one guard exception, existing writer, no filesystem checks or new abstraction. The initial test expectation was corrected to account for removing the child ID from its parent.

Validated actual CLI scan and removal in a disposable copy before live cleanup. The development TypeScript scanner could not scan inactive fixture configurations; used published @groma/scanner-typescript@0.1.0 successfully. Temporarily selecting it refreshed Code and discovered 23 previously unrecorded source elements. Removed scanner-smoke-compiled and smoke-compiled through groma remove; the next scan created zero records and changed no architecture bytes. CLI view confirms both IDs are absent. Removed the temporary scanner selection through the CLI, restoring the original scanners.json. Other scan-produced evidence was retained; no unrelated architecture curation was performed. The ignored Finder .DS_Store was preexisting and is excluded from task traceability.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma remove now accepts scanned components whose Code list is empty, retaining existing dependency checks and protection for scanned systems and containers. Updated public and agent guidance. Removed both approved stale smoke components through a published-scanner refresh and the CLI; a repeat scan made no changes. Verified two lifecycle tests, actual CLI behavior, and the complete repository check: 305 passing tests and six existing skips.
<!-- SECTION:FINAL_SUMMARY:END -->
