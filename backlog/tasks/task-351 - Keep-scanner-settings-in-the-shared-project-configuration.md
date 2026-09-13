---
id: TASK-351
title: Keep scanner settings in the shared project configuration
status: Done
assignee:
  - '@codex'
created_date: '2026-09-11 07:56'
updated_date: '2026-09-11 08:21'
labels: []
dependencies: []
references:
  - scan-observation
  - scanner-modules
  - scan-lifecycle
  - readiness
  - config
  - c-scanner
  - rust-src-scanner-project
  - rust-src-scanner-index
  - typescript-scanner
modified_files:
  - packages/scanner/src/index.ts
  - src/scanner/modules/config.ts
  - src/scanner/modules/inventory.ts
  - src/scanner/registry.ts
  - src/scanner/modules/readiness.ts
  - plugins/scanners/csharp/src/config.ts
  - plugins/scanners/csharp/src/adapter.ts
  - plugins/scanners/csharp/src/index.ts
  - plugins/scanners/rust/src/project.ts
  - plugins/scanners/rust/src/index.ts
  - plugins/scanners/typescript/src/index.ts
  - test-bun/csharp-scanner.test.ts
  - test-bun/scanner-evidence.test.ts
  - test-bun/rust-scanner.test.ts
  - test-bun/scanner-setup.test.ts
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/index.md
  - docs/scanners/dotnet-csharp/index.md
  - docs/scanners/rust/index.md
  - docs/scanners/release-qualification.md
  - docs/scanners/rust/validation.md
  - scripts/validate-csharp-repository.ts
  - scripts/validate-csharp-package.ts
type: enhancement
ordinal: 397000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Store optional scanner settings on entries in the shared scanners.json. Pass settings to readiness and scan calls; C# and Rust must stop reading separate Groma configuration files. Document this contract for future scanner authors.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Shared scanner entries accept optional settings, preserve them during scanner management, and pass each scanner only its own settings for readiness and scans.
- [x] #2 C# input and resource settings and Rust manifest selection work through supplied settings without separate Groma configuration files.
- [x] #3 The plugin guide, language guides and validation examples explain and use the single configuration contract, including defaults and session reload behavior.
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
Extend shared scanner entries and plugin calls; deliver settings through module resolution, readiness and registry; replace C# and Rust config-file reads with supplied settings; document plugin ownership, defaults and session reload behavior; verify supported paths and review implementation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Focused verification before TASK-352 passed 34 tests and 174 assertions, including per-scanner settings delivery, preservation during scanner management, C# worker arguments and Rust nested-manifest selection. Those configuration assertions and release scripts were then deliberately removed under the user explicit domain-only test boundary. Rust package and compiled CLI builds passed. C# native build/tests could not execute because dotnet is unavailable. Cold simplicity, implementer specification/quality and final full-context complexity reviews passed without material findings. Shared settings are runtime configuration: loader owns delivery, plugins own semantics, no new OKF or C4 concept.

Final shared check after the user-requested test cleanup passed: 16 Node and 262 Bun tests, including Rust and Go, zero failures. Six pre-existing complexity warnings. C# native execution remains unverified because dotnet is unavailable; adapter settings and worker arguments were verified in the earlier focused run before those configuration tests were removed.

Follow-up verification after SDK installation: .NET SDK 10.0.401/runtime 10.0.12 on macOS arm64. Existing native C# suite passed all six tests in 4.66 seconds with dotnet on PATH. C# package build passed. Compiled Groma readiness and scan passed on a disposable csharp-operations fixture with settings.input=App/App.csproj in shared groma/scanners.json: two project contexts, ten architecture records created. No tests or source code added or changed for this verification. This resolves the earlier local C# verification gap; other platforms were not exercised.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Scanner entries now carry optional settings in the shared scanners.json. Groma passes each entry settings to readiness and scanning; C# and Rust use supplied settings instead of separate files. Plugin and language guides document ownership, defaults and session reload behavior. Focused settings verification passed before requested test removal; final repository check and required reviews passed. Native C# build/tests unavailable without dotnet.
<!-- SECTION:FINAL_SUMMARY:END -->
