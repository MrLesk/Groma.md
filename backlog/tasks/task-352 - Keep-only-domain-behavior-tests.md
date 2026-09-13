---
id: TASK-352
title: Keep only domain behavior tests
status: Done
assignee:
  - '@codex'
created_date: '2026-09-11 08:01'
updated_date: '2026-09-11 08:21'
labels: []
dependencies: []
modified_files:
  - test/add.test.ts
  - test/architecture-reader.test.ts
  - test/cli-scan.test.ts
  - test/cli-view.test.ts
  - test/curate.test.ts
  - test/draft.test.ts
  - test/edit.test.ts
  - test/first-run.test.ts
  - test/group.test.ts
  - test/initialize.test.ts
  - test/instructions.test.ts
  - test/project-profile.test.ts
  - test/relation.test.ts
  - test/remove.test.ts
  - test/scan-watch.test.ts
  - test/validate-architecture.test.ts
  - test-bun/backlog-command.test.ts
  - test-bun/csharp-scanner.test.ts
  - test-bun/git-history.test.ts
  - test-bun/npm-cli.test.ts
  - test-bun/okf-profile-view.test.ts
  - test-bun/okf-writers.test.ts
  - test-bun/parcel-bytecode.test.ts
  - test-bun/release-version.test.ts
  - test-bun/scan-refresh.test.ts
  - test-bun/scanner-diagnostics.test.ts
  - test-bun/scanner-discovery.test.ts
  - test-bun/scanner-modules.test.ts
  - test-bun/scanner-setup.test.ts
  - test-bun/scanner-watch.test.ts
  - test-bun/source-watch.test.ts
  - test-bun/structural-results.test.ts
  - test-bun/task-diff.test.ts
  - test-bun/theme.test.ts
  - test-bun/tui-revision.test.ts
  - test-bun/viewer-live.test.ts
  - test-bun/viewer-lifecycle.test.ts
  - test-bun/web-authoring.test.ts
  - test-bun/web-authoring-race.test.ts
  - test-bun/web-export.test.ts
  - test-bun/web-first-run.test.ts
  - test-bun/web-live.test.ts
  - test-bun/web-port.test.ts
  - test-bun/web-shutdown.test.ts
  - test-bun/web-startup.test.ts
  - test-bun/web-task-live.test.ts
  - test-bun/web-url.test.ts
  - test-bun/web-source-control.test.ts
  - test-bun/welcome.test.ts
  - test-bun/work-badge.test.ts
  - test/architecture-model.test.ts
  - test/accept.test.ts
  - test-bun/chrome.test.ts
  - test-bun/inspect-details.test.ts
  - test-bun/tui-source.test.ts
  - test-bun/editing.test.ts
  - test-bun/angular-scanner.test.ts
  - test-bun/react-scanner.test.ts
  - test-bun/vue-scanner.test.ts
  - test-bun/rust-scanner.test.ts
  - test-bun/go-scanner.test.ts
  - test-bun/java-scanner.test.ts
  - test-bun/scanner-evidence.test.ts
  - test-bun/scanner-roots.test.ts
  - test-bun/scanner-exclusions.test.ts
  - test-bun/scanner-session.test.ts
  - test-bun/source-relationships.test.ts
  - test-bun/work.test.ts
  - test-bun/flows.test.ts
  - test-bun/architecture-findings.test.ts
  - test-bun/scanner-composition.test.ts
  - test-bun/web-search.test.ts
  - test-bun/projection.test.ts
  - test/architecture-model-errors.test.ts
  - plugins/scanners/csharp/dotnet/test/ContractTests.cs
  - plugins/scanners/csharp/dotnet/test/ScannerTests.cs
  - plugins/scanners/csharp/dotnet/test/CoverageTests.cs
  - test-bun/work-pins.test.ts
  - test-bun/large-world.test.ts
  - test-bun/sheet-route.test.ts
  - test-bun/iso-map.test.ts
  - test-bun/scan-component-naming.test.ts
  - test-bun/work-folding.test.ts
  - test-bun/routes.test.ts
  - test-bun/keys.test.ts
  - test-bun/web-selection-camera.test.ts
  - test-bun/container-layout.test.ts
  - scripts/smoke-compiled-build.ts
  - scripts/validate-callforpapers-artifacts.ts
  - scripts/validate-csharp-package.ts
  - scripts/validate-csharp-repository.ts
  - scripts/validate-native-scanner-artifact.ts
  - plugins/scanners/react/smoke.ts
  - plugins/scanners/java/smoke.ts
  - plugins/scanners/rust/smoke-compiled.ts
  - plugins/scanners/vue/smoke-compiled.ts
  - plugins/scanners/go/smoke.ts
  - scripts/scanner-artifact-registry.ts
  - test/init-ui-helpers.ts
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - test-bun/helpers.ts
  - test/cli-helpers.ts
  - docs/scanners/release-qualification.md
  - docs/scanners/dotnet-csharp/index.md
  - docs/scanners/dotnet-csharp/validation.md
  - docs/scanners/go/index.md
  - docs/scanners/java/index.md
  - docs/scanners/react/validation.md
  - docs/scanners/vue/validation.md
  - docs/scanners/rust/validation.md
  - docs/scanners/java/validation.md
  - test/core.test.ts
type: chore
ordinal: 398000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Review every repository test and remove tests of configuration, content, packaging, UI rendering and delivery plumbing. Retain tests of implemented domain rules such as architecture ownership, relationship inference, navigation state, layout, projection and camera behavior. Remove newly added shared-settings configuration tests as part of this cleanup.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every test file has been reviewed against the domain-behavior boundary; configuration, content, packaging, UI and plumbing assertions are removed.
- [x] #2 Remaining tests verify implemented domain rules rather than strings, configuration or transport details, and the repository check passes.
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
Inventory all test files and cases; review bodies and assertions; delete non-domain cases and unused local helpers; retain focused domain tests; run repository checks and review the final deletion scope.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reviewed test inventory. Removing CLI, HTTP, renderer-output, installation, configuration and OS event delivery suites. Domain algorithms and state transitions are reviewed separately in mixed files. Before cleanup the full check had one Angular filesystem-watch timeout; the test is removed under the user-requested plumbing-test boundary, not as a product fix.

User explicitly extended cleanup to release smoke, package qualification and CI test steps. Deleted those scripts and their shared registry helper; removed CI smoke steps, publication dry runs and install-sanity job. Version sync now depends on publication directly. Updated current docs commands while retaining historical qualification records. Removed orphan UI/CLI test helpers. Remaining suites cover domain inference, ownership, hierarchy, navigation, projection/layout and state. Fixed cleanup mistakes without changing scenarios: restored derived-interaction input; Rust failure preservation compares stored architecture model rather than live annotated source line counts. Go verification uses the existing writable temporary build cache.

Final verification passed: bun run check with existing Rust worker and Go executable enabled, GOCACHE set to the writable temporary cache. 16 Node tests and 262 Bun tests passed, zero failures or skipped Bun tests; six existing complexity warnings remain. C# native suite contains six retained domain tests but could not execute because dotnet is unavailable. Reviewed all test files and assertions, including native C# tests and release scripts. Removed serialization/content assertions; architecture preservation checks now compare stored domain models. Implementer simplicity, specification and quality review found no remaining scope-backed blocker. No new test cases added. git diff --check passed.

Follow-up verification with newly installed .NET SDK 10.0.401: all six retained native C# domain tests passed, zero failures, 4.66 seconds. No test additions or changes. C# package build and real shared-settings scan also passed. This closes the earlier local missing-dotnet limitation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed 50 non-domain test files, non-domain cases from mixed suites, release smoke and package qualification scripts, CI consumer checks, and unused test helpers. Updated current documentation commands. Retained domain inference, ownership, hierarchy, navigation, projection, camera and lifecycle tests. Repository check passed: 16 Node and 262 Bun tests; native C# execution unavailable without dotnet.
<!-- SECTION:FINAL_SUMMARY:END -->
