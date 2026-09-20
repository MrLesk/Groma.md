---
id: TASK-443
title: Support Linux and Windows in the Swift scanner
status: Done
assignee:
  - '@codex'
created_date: '2026-09-19 21:10'
updated_date: '2026-09-20 11:02'
labels: []
dependencies: []
references:
  - swift-src-index
modified_files:
  - plugins/scanners/swift/build.ts
  - plugins/scanners/swift/src/index.ts
  - plugins/scanners/swift/package.json
  - test-bun/swift-scanner.test.ts
  - scripts/scanner-release.ts
  - test-bun/scanner-fresh-checkout.test.ts
  - .github/actions/setup-swift/action.yml
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - test-bun/scanner-release.test.ts
  - plugins/scanners/swift/THIRD-PARTY-NOTICES.txt
  - bun.lock
  - docs/scanners/swift/index.md
  - docs/scanners/publishing.md
  - README.md
  - docs/scanners/swift/validation.md
  - plugins/scanners/swift/Package.swift
type: enhancement
ordinal: 516000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Swift is the only official scanner restricted to macOS, although the other scanners share Linux, Windows and macOS release targets. Alex requested the same platform coverage for Swift. Keep source analysis and the shared scanner interface unchanged; deliver the worker and its runtime through the existing scanner package and release flow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Swift package builder supports macOS arm64, Linux x64 and arm64, and Windows x64 and arm64; consumers do not need a Swift SDK or project dependencies.
- [x] #2 The adapter selects the packaged executable on each supported host and preserves declaration, function outline and operation evidence.
- [x] #3 The release workflow builds and assembles Swift on every existing scanner platform and runs Swift package validation there without platform skips.
- [x] #4 Documentation states the build requirements, release targets and actual validation evidence accurately; focused checks and bun run check pass.
- [x] #5 Swift 0.1.2 is published to npm and the public package is verified through a fresh installation.
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
1. Keep the scanner interface and source evidence unchanged; select worker.exe on Windows and worker on Unix hosts.
2. Build with Swift 6.3.3. Use the supplied parser libraries on macOS/Linux and the pinned SwiftSyntax source through SwiftPM on Windows. Bundle required non-system runtime libraries and notices.
3. Use the shared five-host release build and assembly. Build the Swift package before timed tests in ordinary CI; each test owns its package copy and fixture.
4. Qualify native packages, SDK-free scans, outlines, source positions and watch updates on every host. Verify the assembled npm tarball and document exact results.
5. Complete the required reviews and repository checks. Keep npm publication separate from the approved validation branch work.

6. Publish only the qualified Swift 0.1.2 package, then verify registry integrity and a fresh public installation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented native Swift package builds for Linux and Windows, worker.exe selection, shared release assembly, all-host Swift integration checks, and a five-host assembly regression. Swift 0.1.1 is prepared for a subsequent release; nothing has been published. Focused macOS tests: 4 pass, 47 assertions; assembly regression: 1 pass, 18 assertions. Full bun run check passed (607 Bun tests, 36 existing optional skips; Node suite also passed). Linux Docker validation is in progress; Windows execution requires its native CI runners.

Cold simplicity review passed: the existing package builder, adapter and release assembly own the change, with no recommended extra layer or material deletion. Implementer specification review: C4/OKF evidence, scanner protocol, declarations and outlines are unchanged; OS-specific behavior stays in package delivery. Quality review traced workflow setup -> host build -> runtime dependency copies -> multi-host assembly -> adapter executable selection -> existing evidence protocol. Changed functions pass Biome and remain below the complexity limit. Native Windows execution remains a verification gap, not a claimed pass. Linux ARM64 built with Swift 6.3.3 and scanned the fixture without SDK or network: 2 files, 22 operations, 16 unresolved invocations, stable repeat output and method outlines. TASK-444 has an overlapping isolated scanner release; its owner was contacted to coordinate the Swift version and Windows ARM64 JDK workflow fix.

TASK-444 reserved Swift 0.1.1, so this task now prepares 0.1.2. Its Windows CI reproduced a shared harness failure: moving git.exe behind a symlink loses its DLL search context (exit 53). Applied the same real-Git-directory PATH correction to the Swift isolation test and aligned the shared fresh-checkout harness; Unix keeps its isolated symlink. The Swift child also checks that swift and swiftc are absent from PATH. Preserve TASK-444s Microsoft JDK 25 selection for Windows ARM64 and max-concurrency 4 when merging.

Targeted quality follow-up for the Windows Git harness correction confirms that only Git remains on the isolated PATH; Swift compiler discovery is rejected explicitly. The original macOS symlink behavior stays unchanged. No specification or architecture scope changed. The exact package version for this task is now 0.1.2; 0.1.1 belongs to TASK-444.

Final full-context complexity review passed with no blocking implementation or simplification findings. The post-harness-fix bun run check passed: 16 Node tests, 608 Bun tests, 36 optional skips, zero failures (the shared checkout gained an unrelated test during this session). A freshly built macOS 0.1.2 package also passed the shared fresh-checkout test, 7 assertions. npm pack verified version 0.1.2 and inclusion of worker, engine metadata, runtime notices and license files; nothing was published. Windows native execution is still required before checking AC1-3.

Linux x64 also passed the SDK-absent/no-network scan and outline checks using the official Swift 6.3.3 image under Docker CPU emulation. It returned the same 2 files, 22 operations and 16 unresolved calls as Linux arm64, with stable repeated evidence. Both native Linux package builds succeeded. Local implementation and reviews are ready; requested Alexs approval to commit only TASK-443 on an isolated remote validation branch so native Windows CI can run. AC1-3 and completion remain unchecked until that verification succeeds. No commit, push or publication has been performed for this task.

Alex approved committing TASK-443 on an isolated branch, pushing it, and running Windows CI. Validation uses codex/swift-cross-platform based on TASK-444 commit c5e079ff so its verified Windows Git PATH, Microsoft JDK and test-concurrency fixes are preserved. This approval does not include npm publication.

Approved validation branch pushed: codex/swift-cross-platform, commit 767e15a4be56a001d68d9d00ceee865906660a87. GitHub Release validation run: https://github.com/MrLesk/Groma.md/actions/runs/35472031076 with publish_scanners=false. Based on TASK-444 c5e079ff; focused combined-branch tests passed (5 tests, 65 assertions). Native CI is running; npm publication remains outside this approval.

First native CI run 35472031076 passed macOS, Linux x64/arm64 and the full repository check (16 Node tests, 601 Bun tests, 36 optional skips), but both Windows builds failed because the official Swift installer omits parser development modules. Correction 8cae781ff20cb28fa51c0a1bc6160868a20d30d0 adds a Windows-only SwiftPM build with SwiftSyntax 603.0.2 pinned by commit. It uses the existing temporary build directory and keeps consumer SDK requirements unchanged. The manifest parses and Biome passes. Corrected validation-only run: https://github.com/MrLesk/Groma.md/actions/runs/35472816372.

Native qualification passed on all five hosts in https://github.com/MrLesk/Groma.md/actions/runs/35472816372 at 8cae781f. Both Windows hosts passed 4 Swift tests (47 assertions) and 12 shared fresh-checkout tests (92 assertions); no Windows skips. Repository check: 16 Node tests and 601 Bun tests passed, with 36 existing optional artifact skips. Ordinary CI now builds the Swift package before timed tests (commit 6aa4178a); its full validation run is https://github.com/MrLesk/Groma.md/actions/runs/35473844959. Actual combined-package verification is in progress. Nothing was published.

The real five-host Swift artifacts were assembled, verified byte-for-byte and passed all four integration tests (47 assertions). The complete 0.1.2 npm tarball contains every worker and notice and installs offline; compressed size 137637680 bytes. Ordinary CI has passed Linux and macOS, with Windows still building its test package. Publication is still not authorized or attempted.

Final qualification: native Release run 35472816372 passed all five hosts, each with 4 Swift tests / 47 assertions and 12 shared fresh-checkout tests / 92 assertions. The exact combined npm installation passed 4 Swift tests / 47 assertions. All 89 non-documentation files in the final tarball are byte-identical to that tested installation; documentation records the final results. Final candidate: @groma/scanner-swift@0.1.2, 137637578 compressed bytes, integrity sha512-Q7aGbhn/1kbw1bOlcLTId1mZaMkVaanWjy1Y3uDz4yfEMBMe5Tsknaryrn1wnl3zDpnyfQfb8RlKciCt1ydT3g==.

Ordinary CI run 35473844959 passed Linux and macOS. Windows passed its package build, all 4 Swift tests and all 16 Node tests, but the full Bun suite reported 594 passes, 41 optional skips and 2 failures: java-gradle.test.ts expects libs/core from path.relative on Windows, and the Python ownership test exceeded 20 seconds. Both tests and both scanner implementations are unchanged by TASK-443 (verified against base c5e079ff); the Python timeout cause is unconfirmed. These are recorded as non-blocking follow-ups outside the Swift package change. The full Windows repository suite is not claimed to pass. No assertions, timeouts or concurrency settings were changed to hide these failures.

Final specification and quality review: AC1-3 have native execution and assembly evidence; AC4 has updated documentation plus passing local, Linux and macOS repository checks. The targeted ordinary-CI correction moves package compilation before timed tests without changing their behavior or isolation. Required simplicity and complexity reviews passed. No new core, OKF or C4 behavior exists. Registry readback still reports Swift 0.1.1 as latest. TASK-443 implementation and validation are complete; npm publication has not been authorized or attempted.

Alex explicitly approved publishing Swift 0.1.2 and fixing the two Windows failures. Publication is now authorized; Windows test corrections are tracked separately. The npm login is valid and the registry still reports 0.1.1 as latest.

npm publish accepted @groma/scanner-swift@0.1.2 after account browser authentication. Published candidate: 137637542 bytes, integrity sha512-Xeq3m2CLnJsHQn0ACT56MrUlnRat8HfzR5umx0w7l6yiZTf4ujzJ6Tbnw2i1Jmp7SvJzzKopCQb2HzArwRuUxw==. Initial readback and install see npm propagation delay; no repeat publication was attempted. Public-install verification is pending.

Public registry readback now confirms Swift 0.1.2 and its integrity exactly matches the qualified tarball. A fresh npm install downloaded the public package; all four Swift integration tests passed against that installation (47 assertions). Verifying the normal released Groma CLI install/restore flow next.

Swift 0.1.2 publication is fully verified. Registry latest is 0.1.2 and the public integrity matches the qualified 137637542-byte artifact. The npm-installed package passed 4 integration tests and 47 assertions. The published Groma 0.3.3 CLI installed the exact public version into a fresh fixture project, passed readiness and produced byte-identical Markdown across two scans with source bytes unchanged. A second project restored the copied scanner selection and passed readiness and stable repeated scans. Public-install verification used macOS arm64; all five native workers were previously qualified by CI. No Groma core release was needed. Windows repository follow-ups are owned by TASK-451.

Alex reported that GitHub main still showed the old Swift macOS-only README row. The earlier correction existed only on the validation branch. Applied the exact one-line README correction directly to main in d75ee16e903b9c1e7fbd040bef3e3b27a78e37aa and read it back through the GitHub API: Swift now uses the same Available status as the other scanners. This standalone documentation correction does not change scanner code or require another test run.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Published @groma/scanner-swift@0.1.2 with macOS arm64, Linux x64/arm64 and Windows x64/arm64 workers and required runtimes. All five native CI package jobs passed. Public npm integrity matches the qualified artifact; a fresh public installation passed all four Swift tests (47 assertions). Released Groma 0.3.3 passed installation, readiness, stable repeated scans and second-project scanner restoration. No scanner interface, C4/OKF model or Groma core release changed. Separate Windows repository test corrections are tracked in TASK-451.
<!-- SECTION:FINAL_SUMMARY:END -->
