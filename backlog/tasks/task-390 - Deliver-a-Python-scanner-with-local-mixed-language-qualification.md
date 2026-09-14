---
id: TASK-390
title: Deliver a Python scanner with local mixed-language qualification
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-13 21:11'
updated_date: '2026-09-14 06:34'
labels: []
dependencies: []
references:
  - modules-discovery
  - build
  - src-index
modified_files:
  - plugins/scanners/python/package.json
  - plugins/scanners/python/src/index.ts
  - plugins/scanners/python/worker/scan.py
  - plugins/scanners/python/build.ts
  - src/scanner/modules/official-catalog.ts
  - scripts/scanner-release.ts
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - bun.lock
  - test/fixtures/python-project/pyproject.toml
  - test/fixtures/python-project/service.py.fixture
  - test/fixtures/python-project/nested/pyproject.toml
  - test/fixtures/python-project/nested/worker.py.fixture
  - test-bun/python-scanner.test.ts
  - docs/scanners/python/index.md
  - docs/scanners/index.md
  - docs/scanners/discovery.md
  - docs/scanners/publishing.md
  - docs/scanners/python/validation.md
type: feature
ordinal: 436000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Developers need Python source evidence through the existing scanner installation and release flow, and local evidence that it works alongside supported frontend scanners in real repositories.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Python plugin discovers Python projects, returns deterministic atomic files, declarations and function operations, and reports unsupported call resolution without claiming certain targets.
- [x] #2 Syntax failures return no partial observation; nested projects and Git source boundaries are covered by concurrent fixture tests.
- [x] #3 The official catalog, package build, release workflow and user documentation include the Python scanner.
- [x] #4 A packed local plugin is exercised through Groma on cloned mixed-language projects, with revisions, commands, coverage and limitations recorded.
- [ ] #5 bun run check passes and required simplicity, specification and quality reviews are recorded.
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
1. Follow the shared scanner contract using the installed Python parser, without executing project code or inferring runtime call targets. 2. Add plugin-owned discovery, portable packaging and release integration. 3. Verify source evidence with isolated fixtures and qualify the packed plugin on FastAPI full-stack and marimo clones alongside TypeScript/React. 4. Complete repository checks, required reviews and documentation.

5. Correct Unicode line-boundary handling, add the reproduced position case, rebuild the package, and run focused and complete checks before inclusion in v0.3.2.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Focused Python tests pass (4 concurrent tests, 28 assertions). Full check passed: Biome, TypeScript, 16 Node tests, 311 Bun tests with 6 existing opt-in native tests skipped. Portable package built and packed; Python scans found 28 FastAPI and 1551 marimo files. Both second Python-only CLI scans created zero records. Cold simplicity review passed with no recommendations. Implementer specification and quality reviews found no blocking defects: Git boundaries, nearest source root ownership, UTF-16 offsets, unresolved call claims, atomic failure, portable package paths and release discovery match the criteria. Documentation qualification record is being completed.

The live architecture now identifies the new Python adapter as src-index and its package builder as build; exact references added after those scanner-owned records appeared. No architecture files were edited manually. Packed plugin and compiled Groma passed combined scans on FastAPI and marimo; the second compiled scans created zero records and saved Code ownership has no duplicate owners. Full local details, revisions, commands, limitations and artifact hashes are in docs/scanners/python/validation.md.

Final full-context complexity review passed with no material recommendations or blockers. Documentation qualification is complete. Python runtime code has not changed since the passing complete repository check; subsequent changes were documentation and removal of an unnecessary Python setup step from the package-build-only job. Existing package version bumps and other agent changes were preserved. No packages were published.

Release review reproduced a source-position defect: U+2028 inside a string is not a Python source newline, but str.splitlines counted it as one. The user approved including Python in v0.3.2; fix this violation of the exact-position contract before publication.

The existing UTF-16/CRLF fixture test now includes U+2028 inside its string and failed before the fix. The worker uses StringIO universal source newlines while retaining exact CR/LF bytes; Unicode string separators no longer split source lines.

The Unicode line-boundary regression failed before the two-line worker correction and passes after it. Full check passed: lint, types, 16 Node tests, 312 Bun tests, 6 optional native skips. Corrected packed plugin passed combined CLI scans on retained FastAPI and marimo clones: zero new records, 130 and 2824 refreshed. Final targeted specification and quality review found no remaining blocking finding; no architecture or contract changes were introduced.

Windows CI exposed a fixture setup error: Git already checks out CRLF, and replacing every LF with CRLF creates CR-CR-LF, adding blank Python lines. Exact source positions passed; the fixed line-number expectation failed. Normalize existing CRLF before applying the test line endings, keeping all assertions.

The Windows checkout reproduction produced line 11 with the old fixture preparation and line 6 with normalization; both kept exact byte-derived positions. The unchanged assertions now pass locally. Full repository check passed again: 16 Node tests, 312 Bun tests, 6 optional native skips. Awaiting the Windows CI rerun before release.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the Python scanner with Git source boundaries, project roots, declarations, operations, and explicit unresolved calls. Integrated discovery, packaging, CI, and release staging. Corrected Unicode source-line handling and verified exact UTF-16 positions. The packed plugin passed mixed-language FastAPI and marimo scans; full repository checks passed. First public publication and trusted-publisher setup are release steps.
<!-- SECTION:FINAL_SUMMARY:END -->
