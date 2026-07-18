---
id: GROM-38
title: Register projects and scanner coverage
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-14 19:58'
updated_date: '2026-07-18 15:44'
labels: []
milestone: m-3
dependencies:
  - GROM-22
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Represent one or more observed source roots inside an aggregate blueprint so scanner execution, provenance, status, and queries share stable project boundaries without creating separate project blueprints.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A user can add, inspect, edit, and remove a project registration with a stable identity, display name, source locator, enabled scanners, scanner configuration, and allowed coverage
- [x] #2 Initializing Groma in a single project can create an explicit default registration for the current source root
- [x] #3 Several heterogeneous source roots can contribute to one aggregate blueprint and remain filterable by project
- [x] #4 An unavailable source keeps its prior evidence and reports unavailable status rather than deletion
- [x] #5 Project registration never copies source content into intent or modifies package-manager and configuration files belonging to the observed project
- [x] #6 Source locator handling is deterministic and portable across supported macOS, Linux, Windows x64, and Windows ARM64 conventions
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the bounded groma/v0.1 bootstrap schema with optional deterministic project registrations and a bounded sorted retired-project-ID tombstone set: opaque stable IDs, display names, portable workspace-relative source locators, sorted scanner selections with bounded canonical data-only configuration, and sorted declared coverage scopes. Preserve byte-compatible acceptance of existing configurations without project fields and include active/retired projects in all bootstrap drift/equality checks.
2. Add a Host-owned project registry capability with strict runtime inspection, per-registration revisions, deterministic add/get/list/update/remove operations, collision checks across active and retired IDs, source availability derived through the confined LocalResourceProvider, and a pure cross-platform locator resolver. Reuse the exact existing groma.yaml coordination lane with package mutations. Under that lease, each manager must re-read canonical configuration, compare only its owned projection, merge its mutation into every current non-owned field, and fail closed on owned-state races or indeterminate publication. Removal or unavailability never mutates evidence, bindings, intent, or observed source content.
3. Make official single-project initialization write one explicit project.default registration for source "." and coverage ".", deriving its display name once from the workspace root. Expose the narrow project capability through Host composition and surface context without adding a project component, separate blueprint, scanner execution, or evidence write path.
4. Add bounded CLI project add/get/list/update/remove commands, using JSON input for nested registration requests and explicit revisions for update/remove. Return structured availability without absolute paths or timestamps; document the portable workspace-contained source-locator contract.
5. Add parser/serializer, hostile-input, ID-retirement/restart, sequential and concurrent project/package preservation, initialization, unavailable-source retention, multi-project filtering, CLI, lifecycle, and Darwin/Linux/Windows x64/arm64 regressions. Verify focused suites, full repository checks, all target builds, diff hygiene, and independent specification/quality reviews before one ready PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter classification: L2/high-risk Host and CLI configuration change. The implementation boundary is the Official Host groma/groma.yaml configuration plane plus narrow CLI project management. Core, Standard Model, intent, projection, scanner execution, and canonical evidence remain unchanged. Stable project IDs are Host-generated and never reused after removal; project availability is derived, not canonical. Portable source locators are confined to the aggregate blueprint workspace ("." or forward-slash descendants); arbitrary absolute or sibling roots would require a separate portability/product decision.

Pre-implementation design review found and resolved two blockers. Active-only random IDs could not prove non-reuse after removal, so the schema will retain a bounded canonical retired-ID tombstone set and generation will reject active or retired collisions across restart. Sharing the package-state coordination locator alone did not cure whole-configuration caching; package and project mutations will each re-read under the shared lease, compare their owned projection, and merge into current non-owned fields. Sequential both-direction and concurrent mutation regressions are required.

Design audit clarified initialization and coverage semantics. Official missing-workspace initialization must prepare one exact dynamic project.default configuration before publication and accept only those exact bytes during a concurrent init; an arbitrary projects-only file racing into place remains a conflict. Project source locators are aggregate-workspace-relative, while coverage resource roots are project-source-relative. A source apps/api with coverage src must later give a scanner scope root of src through authority rooted at apps/api, never expose apps/api/src inside the scanner request or resolve src against the aggregate root.

Scanner-blindness review split enforcement explicitly across GROM-38 and GROM-39. Registration rejects project sources resolving to the aggregate top-level groma/ canonical subtree and, for source ".", coverage roots inside that subtree, using portable ASCII-case-insensitive first-segment checks. The official source/coverage "." remains valid because allowed coverage is a maximum over a future virtual project-resource view. GROM-39 must enforce exclusion of the aggregate groma/ subtree for direct reads and enumeration requests/results; a complete "." scan means complete over that filtered view, never canonical intent, evidence, bindings, sessions, or stages.

Implemented the bounded optional project registry in groma/v0.1, including stable Host identities, sorted explicit coverage scopes, canonical scanner configuration, permanent retired-ID tombstones, dynamic project.default initialization, derived availability, Host/lifecycle/CLI surfaces, and shared package/project configuration coordination. Package mutations now re-read and rebase their owned package projection under the shared outer lease so plugins/projects/tombstones survive sequential and concurrent management. Scanner-blindness handoff for GROM-39: its runtime project provider must root at registration.source, pass coverage {id, resourceRoot} unchanged as project-source-relative session scopes, and filter the aggregate top-level groma/ subtree on direct reads plus enumeration requests/results; coverage resourceRoot '.' is complete only over that filtered virtual project view. GROM-42 retains graph/evidence query filtering scope. Added parser, hostile-boundary, lifecycle, tombstone/restart, availability, portability, identity-seam, byte-preservation, coordination, init-race, CLI, and package-bypass regressions; focused suites are in progress.

Verification completed after implementation: the focused Host/CLI suite passed 242 tests, the full repository check passed 972 tests plus build, smoke, Iteration 1A, Iteration 1B foundation, and self-blueprint verification, and check:targets verified native Darwin ARM64 plus Linux x64, Windows x64, and Windows ARM64 artifacts. The binary foundation verifier now asserts the canonical project.default init document, and an exact legacy schema/plugins/packages configuration is covered through package add, enable, restart/load, disable, and removal.

Settled review findings remediated: project publication now exact-captures and identity-checks the owned callback settlement while strictly containing both coordination Result layers, mapping every malformed/substituted post-commit settlement to indeterminate. Availability now validates exact enumeration Results, copied diagnostics, bounded pages, entries, cursors, kinds, locators, sizes, and depth flags; only an exact valid success or exact directory-overflow proof reports available. CLI add/update now require exactly coverage/name/scanners/source before invoking project operations, and parser-provider shapes cover neither/project-only/retired-only/both optional fields. Indeterminate add diagnostics include attemptedProjectId for exact reconciliation. Added adversarial regressions. Review-fix verification: focused Host/CLI 247 pass; full check 977 pass plus all binary workflows; check:targets passed Darwin ARM64, Linux x64, Windows x64, and Windows ARM64.

Quality re-review staging/readback blocker remediated. stageReplacement now crosses an exact Result boundary, copies failure diagnostics, rejects proxy/malformed/non-object/native-Promise tokens without traps, and preserves valid provider-owned opaque token identity before publication can become indeterminate. Post-commit readback now exact-validates Result and contents records, copies an intrinsic non-proxy bounded Uint8Array, and compares only the owned copy; every hostile/malformed readback remains indeterminate. Added proxy/accessor/extra/malformed/invalid-token/oversized-byte regressions plus a valid custom opaque-token identity regression. Final verification: focused Host/CLI 249 pass; full check 979 pass plus binary workflows; check:targets passed Darwin ARM64, Linux x64, Windows x64, and Windows ARM64.

Final settled validation: project-registry adversarial suite 15 pass; focused Host/CLI suite 249 pass; full bun run check 979 pass plus build, smoke, Iteration 1A, Iteration 1B, and self-blueprint workflows; check:targets passed Darwin ARM64, Linux x64, Windows x64, and Windows ARM64; git diff --check clean. Independent specification review passed and final quality re-review approved with no actionable findings.

Claude review follow-up: hardened default project display-name derivation through an exported pure seam. The Host now derives the final path segment without runtime path coercion, replaces C0/C1 controls, Unicode line separators, and unpaired surrogate code points, truncates at the configured code-point bound, trims after truncation, and falls back to workspace. Direct regressions cover lone high/low surrogates on POSIX and Windows, control/line separators, a truncation-created trailing space, supplementary-plane characters at the exact bound, and whitespace-only fallback; every derived name is accepted by the canonical project-registration validator. Verification: focused Host/CLI suite 250 pass; full check 980 pass plus build, smoke, Iteration 1A, Iteration 1B, and self-blueprint workflows; check:targets passed Darwin ARM64, Linux x64, Windows x64, and Windows ARM64; formatting, architecture boundaries, typecheck, and diff hygiene passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a bounded Host-owned project registry and exact CLI CRUD for stable multi-project registrations, deterministic default initialization, portable project-relative coverage, derived fail-closed availability, permanent ID retirement, and concurrency-safe sharing of groma.yaml with package management. Verified every acceptance criterion with Host/CLI adversarial and integration tests, all 979 repository tests and binary workflows, four target builds, diff hygiene, and approved independent specification and quality reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
