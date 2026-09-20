---
id: TASK-349
title: Align C# project configuration naming with Rust
status: Done
assignee:
  - '@codex'
created_date: '2026-09-11 07:06'
updated_date: '2026-09-11 07:14'
labels: []
dependencies: []
references:
  - config
  - c-scanner
modified_files:
  - plugins/scanners/csharp/src/config.ts
  - docs/scanners/release-qualification.md
  - plugins/scanners/csharp/src/index.ts
  - plugins/scanners/csharp/src/adapter.ts
  - docs/scanners/dotnet-csharp/index.md
  - scripts/validate-csharp-package.ts
  - scripts/validate-csharp-repository.ts
  - test-bun/csharp-scanner.test.ts
type: chore
ordinal: 395000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Use .groma-csharp.json for C# project selection, matching the existing .groma-rust.json convention. Keep the shared scanner registry in the architecture bundle because it has a separate purpose. Replace the prototype filename directly without compatibility handling.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 C# selection and watch matching use .groma-csharp.json with the existing configuration semantics.
- [x] #2 Examples and validation tools use the same filename; obsolete filename references are removed from current instructions and source.
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
Replace the filename in the C# adapter, config, watch declaration, fixtures and documentation. Run the existing C# selection/lifecycle tests and repository checks. Do not change configuration fields or native process behavior.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Only the C# configuration filename changed. Registry configuration still belongs to the architecture bundle, while native project selection stays scanner-specific. Existing limit fields and native process runners are retained because their lifecycle contracts differ. The release-qualification document received only the example filename correction; no release gate or validation was changed.

C# project selection, watch matching, examples and validation scripts use .groma-csharp.json. Eight C# adapter tests passed; current sources contain no obsolete filename references. Shared scanner registry retains its separate purpose. Release qualification changed only the example filename, with no gate or validation behavior change. Implementer simplicity, specification and quality review found no authority-backed blocking defect. These are bounded fixes and behavior-preserving refactors, with no new architecture level or stored metadata. Full repository check passed outside the sandbox: 110 Node tests and 447 Bun tests, 3 tooling-dependent skips (Maven and Go), 6 existing lint warnings. macOS ARM64 only; other supported OS/CPU targets were not executed. git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
C# project selection, watch matching, examples and validation scripts use .groma-csharp.json. Eight C# adapter tests passed; current sources contain no obsolete filename references. Shared scanner registry retains its separate purpose. Release qualification changed only the example filename, with no gate or validation behavior change. Verified by focused tests and the passing repository check on macOS ARM64.
<!-- SECTION:FINAL_SUMMARY:END -->
