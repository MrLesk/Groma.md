---
id: TASK-358
title: Build scanner recommendations from plugin-owned discovery metadata
status: Done
assignee:
  - '@codex'
created_date: '2026-09-12 14:47'
updated_date: '2026-09-12 14:53'
labels: []
dependencies: []
references:
  - scan-observation
  - catalog
  - discovery
  - scanner-modules
  - rust-scanner-build
  - java-scanner-build
  - go-scanner-build
  - package-csharp-scanner
modified_files:
  - packages/scanner/src/discovery.ts
  - packages/scanner/src/index.ts
  - plugins/scanners/typescript/package.json
  - plugins/scanners/java/package.json
  - plugins/scanners/csharp/package.json
  - plugins/scanners/go/package.json
  - plugins/scanners/rust/package.json
  - plugins/scanners/angular/package.json
  - plugins/scanners/vue/package.json
  - plugins/scanners/react/package.json
  - src/scanner/modules/official-catalog.ts
  - src/scanner/modules/catalog.ts
  - src/scanner/modules/discovery-rules.ts
  - src/scanner/modules/discovery.ts
  - src/scanner/modules/package.ts
  - plugins/scanners/framework-package.ts
  - plugins/scanners/java/build.ts
  - plugins/scanners/go/build.ts
  - plugins/scanners/rust/build.ts
  - scripts/package-csharp-scanner.ts
  - docs/scanners/discovery.md
  - docs/scanners/creating-a-plugin.md
type: enhancement
ordinal: 404000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Scanner maintainers currently repeat technology discovery rules and support information in Groma core. Let official and third-party packages own declarative discovery metadata. Assemble the official catalog from selected plugin manifests when Groma is built, so changes expressible by the supported rules require metadata changes and a rebuild, rather than technology-specific core edits. Preserve existing discovery behavior, embedded TypeScript, and the distinction between discovery and source watch patterns. Publishing packages, a third-party index, and extracting TypeScript are separate work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Official scanner manifests own detection rules, descriptions, and optional release compatibility; Groma assembles its catalog from those manifests without a parallel technology-specific list or detector.
- [x] #2 Discovery preserves supported dependency, XML, TOML, text, and file-presence findings, installed dependency resolution, exclusions, uncertainty, configured selections, and recommendation compatibility without executing plugin code.
- [x] #3 An independent plugin using the same metadata can supply a new dependency or file detection rule and compatibility data without changes to Groma matching code; plugin package builders preserve that metadata and the installer accepts it.
- [x] #4 Documentation explains authoring metadata and rebuilding the official catalog, focused checks demonstrate metadata-driven recommendations and compiled delivery, and the repository check passes.
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
Define a small shared declarative metadata contract for existing detection cases. Move current rules to plugin manifests; assemble a catalog through static manifest imports embedded by the existing build. Replace technology branches with the shared rule reader, preserve metadata in package builds, and document the author flow. Verify recommendation behavior with disposable projects and metadata variation, build compiled Groma, run bun run check, then complete the required simplicity, specification, quality, and full-context reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Official manifests now own discovery rules. Static JSON imports assemble and embed the catalog in the existing build, avoiding an extra generation script or generated file. Source watch metadata remains separate. Focused disposable checks cover all eight scanners and five rule types, nested installed dependency versions, unsupported framework clues, exclusions, private availability, independent-plugin metadata changes, compatibility and uncertainty, configured selection, local package acceptance, and compiled discovery. The checks caught and fixed the trailing empty git file-list entry. A built React package retains metadata and resolves through the installer. Public publication and TypeScript extraction remain separate.

Cold simplicity review passed without requested changes. Implementer specification review: all four acceptance criteria have focused evidence, including compiled discovery and a built React package. Quality review: discovery reads data only; manifest rules own technology-specific names; configured scanner and compatibility logic remain shared; package builders retain metadata; no unrelated source/watch/architecture behavior changed. No blocking defect found. All changed source files remain below 500 lines. Final bun run check passed with 256 Bun tests, 6 existing skips, the Node suite, typecheck and lint; no new complexity warning. Disposable validation was used for discovery/package plumbing rather than restoring qualification suites removed by TASK-352.

Final full-context complexity review passed with no blocking findings or material simplifications. Ownership and scope match the approved discussion: plugin-owned metadata, shared data readers, embedded official selection, separate watch patterns, and no publication, index service, or TypeScript extraction in this change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Official scanner recommendations now come from plugin package metadata embedded by the normal Groma build. Existing declaration detection is handled by five shared rule types; package builders preserve metadata and third-party packages can use the same contract. Verified all official scanners, an independent metadata-only dependency change, compatibility/configuration behavior, compiled discovery, a packaged React scanner, and bun run check. Required simplicity and full-context reviews passed.
<!-- SECTION:FINAL_SUMMARY:END -->
