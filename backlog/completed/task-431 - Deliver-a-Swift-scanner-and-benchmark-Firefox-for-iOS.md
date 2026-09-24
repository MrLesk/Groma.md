---
id: TASK-431
title: Deliver a Swift scanner and benchmark Firefox for iOS
status: Done
assignee:
  - '@codex'
created_date: '2026-09-17 06:14'
updated_date: '2026-09-17 07:06'
labels: []
dependencies: []
references:
  - 'https://github.com/mozilla-mobile/firefox-ios'
  - modules-discovery
  - src-scanner
  - swift-src-index
documentation:
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/evidence.md
modified_files:
  - plugins/scanners/swift/.gitignore
  - plugins/scanners/swift/package.json
  - plugins/scanners/swift/worker/Contract.swift
  - src/scanner/modules/official-catalog.ts
  - plugins/scanners/swift/worker/Outline.swift
  - plugins/scanners/swift/worker/Tokens.swift
  - plugins/scanners/swift/worker/Evidence.swift
  - plugins/scanners/swift/worker/main.swift
  - plugins/scanners/swift/src/index.ts
  - plugins/scanners/swift/build.ts
  - plugins/scanners/swift/SwiftSyntax.LICENSE
  - docs/scanners/swift/index.md
  - bun.lock
  - scripts/scanner-release.ts
  - README.md
  - test/fixtures/swift-source/Ledger.swift
  - test/fixtures/swift-source/Other.swift
  - test/fixtures/swift-source/Package.swift
  - test-bun/swift-scanner.test.ts
  - test-bun/scanner-fresh-checkout.test.ts
  - scripts/benchmark-swift-scanner.ts
  - src/scan-component-naming.ts
  - test-bun/scan-component-naming.test.ts
  - docs/scanners/swift/validation.md
type: feature
ordinal: 504000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Swift source is absent from Groma scans. Add an official source-only scanner and evaluate it on a pinned local clone of Firefox for iOS, a Swift-first application with JavaScript, Python and Objective-C. Record coverage, timing, repeatability and limitations without building or running the application.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The official Swift scanner discovers and scans authored Swift files in a fresh Git checkout without project dependencies, Xcode, a Swift SDK, project execution or network access at scan time.
- [x] #2 The scanner reports declarations, operations and calls with exact locations and explicit uncertainty through the existing observation contract, plus source outlines and comparable named-operation bodies for the declared Swift syntax.
- [x] #3 The installed package includes its parser and runtime assets, participates in discovery and release staging, and honors shared source exclusions and source watching.
- [x] #4 Independent concurrent fixtures verify parsing, outlines, body normalization, uncertainty, syntax failure, ownership retention and packaged execution; bun run check passes.
- [x] #5 A pinned Firefox for iOS clone is benchmarked with recorded language mix, source coverage, timings, diagnostics, repeat-scan stability and source immutability, with reproducible instructions and honest limits.
- [x] #6 The Swift scanner is published to npm, installed by package name through Groma on a fresh cache, and restored from an exact shared selection on a second checkout; both run the pinned Firefox benchmark.
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
1. Build a SwiftParser/SwiftSyntax source worker and a thin scanner adapter, using the existing native-worker package pattern. The first supported host is macOS, matching the approved local benchmark; ship parser libraries so installed scans need no Swift toolchain. 2. Report file and declaration inventory, operations and explicitly unresolved calls, source outlines, and binding-normalized named-operation bodies. Keep core C4/OKF ownership unchanged. 3. Integrate official discovery and package staging, document supported host and syntax limits, and verify independent fixtures and installed-package behavior. 4. Benchmark the pinned Firefox for iOS clone, including repeatability and source immutability. 5. Run repository checks, the cold simplicity review, implementer specification/quality reviews, and the final full-context review.

Benchmark-driven correction: Firefox contains BrowserKit/Tests/MenuKitTests/.swift. Core treated the entire dotfile name as an extension, wrote an empty required title, then failed repeat scans. Use standard path parsing for source names and verify non-empty persisted titles and repeat reconciliation; regenerate only the benchmark clone Groma-owned state.

6. Publish the reviewed macOS arm64 Swift package using the existing npm release convention. Verify public metadata and tarball contents, install from npm through Groma with a fresh cache, scan Firefox, and restore the exact package selection in a second checkout. Record public release and reproducible consumer commands.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Benchmark selected: mozilla-mobile/firefox-ios at 35d384c766b5e3091b9df970e4365cf66d9795b9, cloned to /private/tmp/groma-swift-benchmark-firefox-ios. Published tree-sitter-swift 0.7.1 parsed 3186 tracked Swift paths in 2.18s but rejected valid syntax in 126 files; evaluating current grammar before implementation.

The scanner registry also watches declaration discovery, independently of plugin exclusions. Corrected the watch assertion to check the Swift subscription itself; source inventory already excludes Pods. Swift parser, outline, token normalization and restricted-PATH package tests pass. Live session verification requires macOS FSEvents outside the sandbox.

Cold simplicity review: removed unused outline collections. Fixed the release assembly blocker by adding Swift to existing executable-permission and host-metadata preparation, since GitHub artifact transfer strips worker execute permissions. No new layer or broader architecture changes were recommended.

Reproduced full-flow blocker: the first scan writes components/source.md with title empty for BrowserKit/Tests/MenuKitTests/.swift; the second scan fails architecture-reader validation. Authority: TASK-431 benchmark/repeatability AC and required title in docs/component-markdown.md. Smallest correction is standard filename parsing in existing source naming, not a Swift exclusion or new naming fallback. Without it the approved benchmark cannot be rescanned.

Final benchmark: 3182 Swift files, 38758 symbols, 42960 operations, 29388 comparable bodies, 132735 unresolved calls, identical observations in 4.286/4.627 seconds; all-file outlines in 4.909 seconds. Mixed Swift/Python CLI scans covered 3182/56 files, took 36.118/34.776 seconds, created no new elements on repetition, and yielded byte-identical Markdown. Tracked source diff is empty. Evidence and reproduction are in docs/scanners/swift/validation.md. Release assembly restored a deliberately removed worker executable bit; installed-package test passed (12 assertions). Implementer specification/quality review found the documented macOS source-only flow and ownership consistent with AC; no additional blocking Swift defect found. The previous complete repository check passed (384 Bun tests); the final check after naming regression currently stops at an unrelated concurrently added Angular fixture TS1294 error.

The current live architecture now includes swift-src-index for the new adapter. Added that exact element reference alongside modules-discovery and src-scanner so TASK-431 is linked to the Swift code on the map.

Final full-context complexity review: no blocking findings or material simplifications. The parser worker, adapter, core ownership and package boundary are clear. Repository check rerun is in progress after the unrelated Angular fixture correction.

Final verification passed: bun run check exit 0, 16 Node tests and 420 Bun tests passed (24 optional native-package skips), including all four Swift concurrent tests built from current source and the dotfilename reconciliation regression. The separately selected shared fresh-checkout Swift case and assembled-package execution probe also passed. One existing Biome complexity warning remains outside this task. git diff --check passed for task code. Cold simplicity, implementer specification/quality, and full-context complexity reviews have no remaining blockers.

User requested publication and full consumer validation. Reopened task and added AC6 for npm publication, clean-cache name resolution, and exact-version restore in a second checkout. npm login mrlesk is available and @groma/scanner-swift is not yet published. Release artifact now includes repository metadata and its linked benchmark document.

npm publish accepted @groma/scanner-swift@0.1.0 after browser authentication. Published tarball SHA512 is CmAFWtQlvOJF/H3IhuI/VoVH9XOqElGvwLMsGaUBi3KwdmacUOl7SRgbWEqM7MA8iLOdz8KNy15iSGvL55+rOw==; 13 files, 3.3 MB packed, parser/runtime assets and executable worker included. Packed-tarball SDK-free test passed. Full check after package change passed: 425 Bun tests, 16 Node tests. Trusted publishing requested for MrLesk/Groma.md release.yml; npm 11.15 is installed in a temporary directory for that command.

Trusted publisher created successfully: GitHub MrLesk/Groma.md, release.yml, trust ID 87e14f03-df62-4fe5-bc6d-11a95b602b92. The CLI reports publish and stage publish permissions. Public registry metadata is still propagating; first clean-cache install returned package not yet published. Consumer verification will run after visibility is confirmed.

Public registry visibility confirmed with matching SHA512, darwin/arm64 support and ^0.3.0 compatibility. Public npm tarball downloaded independently and all four Swift integration tests passed (47 assertions). Released groma.md@0.3.3, installed separately from the development checkout, resolved scanner add @groma/scanner-swift to exact @groma/scanner-swift@0.1.0 from a new home/cache. A second pinned Firefox checkout with another empty home restored one scanner from only the shared scanners.json and passed readiness.

Consumer E2E complete using the actual published groma.md@0.3.3 CLI and @groma/scanner-swift@0.1.0. Both independent pinned Firefox checkouts, with separate empty homes/caches, passed first and repeat scans: 3182 Swift files each, 2269 lint candidates, no elements created on repeats, byte-identical Markdown within each checkout, unchanged tracked source bytes. First checkout times 32.854/41.249 seconds; restored checkout 34.548/43.596 seconds (overlapping runs, not isolated performance samples). Read-back npm trust configuration matches MrLesk/Groma.md release.yml. Original benchmark selection was switched from the local Swift build to the public npm version in the normal user cache. Public package metadata, checksum, commands, platform limits and verification are documented in docs/scanners/swift/validation.md. Release metadata/documentation-only changes passed implementer specification and quality review; no architectural changes required.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered and published @groma/scanner-swift@0.1.0 for macOS arm64, with GitHub trusted publishing configured for MrLesk/Groma.md release.yml. Verified the exact public tarball, all four Swift integration tests, package-name installation through released Groma 0.3.3, and exact-version restore in a second fresh checkout. Both Firefox clones scanned 3182 Swift files twice with identical repeat Markdown and unchanged tracked sources. Original benchmark now uses the npm package. Full repository check passed (425 Bun, 16 Node tests). Swift source parsing, outlines, comparable bodies and core dotfilename correction remain covered by the earlier implementation reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
