---
id: TASK-486
title: Qualify and improve the Rust scanner on public repositories
status: Done
assignee:
  - '@codex'
created_date: '2026-09-22 21:03'
updated_date: '2026-09-22 21:28'
labels: []
dependencies: []
references:
  - rust-src-index
  - rust-analysis
  - rust-http
modified_files:
  - test-bun/rust-workspace.test.ts
  - plugins/scanners/rust/src/project.ts
  - test-bun/rust-scanner.test.ts
  - plugins/scanners/rust/native/src/scan.rs
  - plugins/scanners/rust/native/src/endpoints.rs
  - plugins/scanners/rust/native/src/requests.rs
  - plugins/scanners/rust/native/src/tokens.rs
  - plugins/scanners/rust/native/src/client.rs
  - docs/scanners/rust/index.md
ordinal: 567000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex requested a repository-by-repository Rust scanner exercise after the PHP pass. Scan diverse public Rust projects for real source, routing, client, and lifecycle edge cases; fix verified scanner failures while keeping C4 interpretation in language-neutral Groma core.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ten distinct public Rust repositories are scanned at recorded commits, with concrete evidence and each result classified.
- [x] #2 Verified defects in the supported Rust scan flow are fixed with focused regression coverage where existing tests leave a gap.
- [x] #3 The complete repository check passes after the Rust scanner changes.
- [x] #4 Temporary repository clones are removed after Rust qualification and the results are reported to Alex before work starts on another scanner.
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
1. Build and verify the local Rust scanner worker. Ask ten read-only agents to scan ten distinct public Rust repositories in separate /tmp/groma-rust-486 directories; each records its commit, exact scan result, and a minimal source-backed reproduction for a suspected defect. 2. Compare reports with the Rust scanner guide and current tests. Fix verified failures in Rust project loading or evidence extraction; preserve language-neutral core and keep C4 meaning out of the scanner. Record the supported rule, wrong result, and coverage gap before adding tests. 3. Re-run affected repositories and bun run check, review for subtraction and correct domain ownership, run the final full-context complexity review, delete all temporary clones, report the result, and pause before another scanner.

Test decision for Cargo targets and workspace context: the Rust guide promises inherited workspace editions, inferred binary targets, default-feature selection, and direct manifest selection. Actix and Clap child manifests receive Rust 2015 instead of inherited 2021/2024; mdBook loses a named bin with inferred src/main.rs; Tokio includes bins gated by disabled required-features. Existing Rust tests cover only explicit paths and root workspaces. Add focused fixture variants that fail for each concrete wrong target or edition, then correct Rust project loading.

Test decision for source facts: Bat and Clap emit calls inside inactive cfg blocks, Bat emits direct #[test] functions, and Serde emits duplicate operations through a symlink to the same physical file. The guide excludes inactive/test code and promises one physical file identity. Existing Rust tests cover inactive modules and shared source across crates but not body branches, direct test attributes, or symlink aliases. Add minimal cases proving absent false facts and one physical source identity, then correct native extraction.

Test decision for Rocket registration: Rocket examples workspace loses GET / from hello when another crate has a handler named hello. The guide promises served routes; existing HTTP fixture has no duplicate bare handler names across crates. Add one multi-crate route case in the focused fixture and resolve routes! names in their crate context.

Test decision for dependency features: mdBook root defaults activate mdbook-html/search, but searcher.rs and search.rs are omitted because the adapter ignores default feature entries containing a dependency/feature pair. The Rust guide says declared default features supply the source graph. Existing workspace tests cover inherited dependencies but not features enabled across one. Add a small two-package scan where an active dependency feature includes a module; it must appear in the observation, then propagate the feature in the Rust crate graph.

Test decision for extracted HTTP client: Axum reqwest-response serves a handler with State(client): State<Client> and calls client.get(...).send(), but the scanner reports no request because it reads only direct Client parameter patterns. Alex asked to improve practical scan coverage beyond documented limits where feasible. Existing Rust HTTP coverage has direct Client declarations but no typed extractor pattern. Add one source example that must report GET /stream and recognize only a client explicitly typed inside the extractor.

Correction to the Rocket regression case: the focused test uses two modules in one crate with the same handler name, which reproduces the name collision with less fixture setup. The pinned multi-crate Rocket examples workspace is the real-project validation.

Reviewer regression: explicit [[bin]] targets remain valid with autobins=false. Test Cargo target discovery for src/main.rs and src/bin/<name>/main.rs; the current named-bin test does not cover disabled automatic discovery, so these variants should fail before the fix.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rust adapter target and workspace fixes are red-to-green: focused rust-workspace suite passes 7 tests. Actix member scan now uses edition 2021 and completes with 87 files; Clap member uses 2024; mdBook now has its mdbook entry and both default-feature search modules (60 files); Tokio now reports only ungated test_cat entry. The changes remain in Rust project loading, with no Groma core or C4 rules.

Ten pinned public checkouts were scanned read-only before fixes: ripgrep 3fce3b5bb0236da2df6d99672afb8a719642eca7 (83 files, no verified defect); Axum c44f6650aa38d4c154e3cdb7347205e03813f4d5 (78 root files, 59 example files, typed State client request omitted); Actix ad0d97b51ab8f57ae3dd97f2b4cbea0e7bd59ce1 (210 root files, direct member scan failed with wrong edition); Rocket 3a54d079aef060a8f732bd04ea54b0581a604087 (38 example files, GET / lost among duplicate handler names); Reqwest aff2ddb677e20517baec5254b8800c6d371aa010 (2 roots, 21 files, macro re-export client limit); Clap 8ab46fe22b4aa5c3bd09cc0e6c3fe9a75fc178a8 (89 root files, inherited edition and inactive calls wrong); Serde 6693a89cca77e0151437da1c7f890090b9ebf04c (62 files, duplicate symlinked physical sources); Tokio 2ebac75c369d7f6b9e899862ae7302113513c395 (109 files, gated bins included); Bat 4987f76709aae3a1c4db723c53874c9ddcb0c4fd (39 files, inactive calls and direct test functions included); mdBook ea1b91d0ea1fa2d62e4c1faeeffd910ce19306fd (46 files, named bin and dependency feature modules missing). All ten scans completed; no clone or shared source was edited by the agents.

Focused fixes verified on affected checkouts: Actix direct member now uses Rust 2021 and scans 87 files; Clap member uses 2024 and inactive calls disappear; mdBook now yields 60 files, mdbook entry, and both search modules; Tokio reports only the ungated test_cat binary; Serde yields 52 unique files with ten shared-context diagnostics and no unlisted observation paths; Rocket examples restore GET /; Axum reqwest-response reports GET /stream; Bat inactive calls and direct test operation disappear. Core and C4 policy remain unchanged. The native Rust suite passes 20 tests and 58 assertions, and cargo clippy with denied warnings passes. Cold simplicity review found no material simplification.

Specification review: AC1 is proven by ten pinned, completed public repository observations above. AC2 is proven by red-to-green target, feature, inactive-source, physical-identity, Rocket registration, and typed-client tests plus affected repository reruns. AC3 is proven by bun run check on the final code: 675 pass, 43 skip, 0 fail, 2434 assertions; the opt-in Rust suite separately passes 20 tests and 58 assertions, and cargo clippy with warnings denied passes. AC4 remains pending clone cleanup and the report to Alex. Quality review: the scanner entry and Rust project adapter own Cargo selection; the native worker owns physical source identity, active syntax, calls, routes, and requests; core alone owns C4 interpretation. A new developer can follow the source graph into native evidence and knows where each correction belongs. New tests fail on the concrete pre-fix mistakes, pass on the final code, and do not freeze documentation prose. Changed TypeScript functions meet the cognitive complexity limit. Cold simplicity review found no material deletion or consolidation.

Full-context complexity review traced Cargo selection through native Rust facts into language-neutral core and recommended no architectural change. It found one narrow explicit-bin regression: autobins=false hid conventional source paths. Cargo metadata confirmed explicit app and tool bins resolve to src/main.rs and src/bin/tool/main.rs. The revised focused test failed before the fix and passes after separating conventional path inference from automatic target enrollment. Final focused native suite: 20 pass, 58 assertions; final bun run check: 675 pass, 43 skip, 0 fail, 2434 assertions; Biome changed files and git diff --check clean. Pinned mdBook still yields five executables and Tokio still yields only test_cat. Final limited specification and quality re-review found the corrected target flow matches Cargo and adds no core or C4 policy.

After all Rust verification and reviews, removed every /private/tmp/groma-rust-486* clone, observation, and reproduction directory. A final find returned no matching paths. No next scanner has started; Rust findings are ready for Alex’s review.

Rust scanner report delivered to Alex in this turn before any next scanner work. Task stays In Progress for Alex’s review and commit decision.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Qualified the Rust scanner against ten pinned public repositories. Fixed Cargo target and workspace inference, feature propagation, inactive and duplicate source facts, Rocket route resolution, and Axum reqwest client extraction. Focused Rust tests passed (20), cargo clippy passed, bun run check passed (675 pass, 43 skip), and all task-owned temporary checkouts were removed.
<!-- SECTION:FINAL_SUMMARY:END -->
