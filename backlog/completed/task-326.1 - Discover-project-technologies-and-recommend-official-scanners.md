---
id: TASK-326.1
title: Discover project technologies and recommend official scanners
status: Done
assignee:
  - '@scanner-discovery'
created_date: '2026-09-08 21:34'
updated_date: '2026-09-12 14:25'
labels:
  - scanners
dependencies: []
references:
  - TASK-228.2
  - ../callforpapers
  - TASK-326.9
  - scanner-modules
  - catalog
  - discovery
  - TASK-326.10
  - TASK-326.11
  - TASK-352
  - TASK-356
documentation:
  - docs/scanners/index.md
  - docs/scanners/creating-a-plugin.md
modified_files:
  - src/scanner/modules/catalog.ts
  - src/scanner/modules/discovery.ts
  - src/scanner/cli.ts
  - test/fixtures/scanner-discovery.json
  - test-bun/scanner-discovery.test.ts
  - docs/scanners/discovery.md
  - docs/scanners/index.md
  - src/scanner/modules/inventory.ts
parent_task_id: TASK-326
type: feature
ordinal: 362000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Developers need evidence-backed discovery of supported languages and frameworks across root and nested applications before installing scanner plugins. Preserve declaration locations, distinguish framework declarations from proven runtime behavior, retain embedded TypeScript and existing selections, and report unavailable or uncertain support honestly. The implementation covers the approved callforpapers Java/Angular example and the reviewed C#, Go, Rust, Vue and React declarations. Public package publication and verified catalog releases belong exclusively to TASK-356.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Discovery finds the supported language/project declarations in both the repository root and nested applications of the acceptance project, without stopping after the first match or counting dependency/generated directories as project applications.
- [x] #2 Each detected language or framework is associated with its evidence location; a framework declaration is reported as a discovery clue rather than verified runtime use.
- [x] #3 Recommendations come from the official catalog and account for Groma compatibility, declared technology/version support, and already available plugins; unreleased or incompatible packages are not offered as installable.
- [x] #4 For callforpapers, discovery identifies Java and Angular as complementary to embedded TypeScript and reports their actual configured or unavailable state honestly. Verified public release availability is owned by TASK-356.
- [x] #5 Recognized technologies without a suitable plugin and uncertain findings remain visible as coverage limits; documentation states that discovery covers supported rules rather than every possible technology.
- [x] #6 Rerunning discovery after adding a supported nested project identifies the new support needed while retaining the existing configured selection.
- [x] #7 The reviewed Vue and React project declarations produce evidence-backed complementary scanner recommendations, with supported-version limits and unavailable public releases represented honestly.
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
Use the existing scanner inventory and official catalog to discover supported project declarations, retain evidence and configured selections, and classify compatibility and coverage. Verify the approved root/nested examples and complementary framework recommendations. Keep public release metadata conditional on actual publication in TASK-356.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented read-only scanner discover text/JSON entry and one reusable result for later installation. Discovery uses root/nested Git inventory, literal supported declarations, existing inventory, and an official catalog with no invented release versions. Five concurrent discovery tests (33 assertions) and scoped Biome lint pass. callforpapers read-only validation finds Java 25, Angular ^21.2.17 and TypeScript ~5.9.3; TypeScript stays embedded, Java/Angular are unavailable candidates, and Spring Boot framework evidence is an explicit coverage limit. Typecheck was temporarily blocked by ongoing composition work at src/scan-reconciler.ts:404 (ScanSummary.evidenceConflicts). Awaiting coordinator-arranged cold review and exclusive repository check.

Cold simplicity review through coordinator found no structural blocker; fixed its AC4 range-confirmation finding and reused the existing embedded inventory entry. Added a fixture where installed Angular 21.2.17 satisfies declaration ^21.2.17 and compatible catalog release metadata, while an installed version below the declared range is incompatible. Bun require.resolve was observed resolving absent callforpapers dependencies from its global cache; the final implementation reads only standard node_modules search paths and leaves absent packages unresolved. callforpapers currently has no node_modules; no dependency or architecture changes were made there. Own specification review: all six discovery criteria have fixture or read-only callforpapers evidence, with real release qualification explicitly unavailable. Own quality review: no blocking defect in the supported flow; discovery is read-only, module/domain ownership is clear, all changed source/test files stay below 500 lines, and scoped Biome reports no complexity warnings. Awaiting exclusive bun run check and full-context coordinator review.

Exclusive full bun run check completed with exit 1; complete log /tmp/groma-discovery-check.MeCrsy. Typecheck passes, Node tests 110/110 pass, Bun tests 378 pass/1 skip/1 fail. Only failure is the shared C# adapter fixture at test-bun/scanner-evidence.test.ts:427 because its fake dotnet host exits 3 for the new SDK --version probe. Coordinator received this cross-task failure; no other task files changed. Discovery + inventory focused run: 11 pass, 75 assertions. Scoped Biome is clean; repository lint reports six pre-existing complexity warnings.

Full-context discovery review passed with no blocking findings. Coordinator accepted technical dependency readiness under delegated review authorization. Shared bun run check rerun passed after the C# fixture correction: Node 110 pass; Bun 379 pass, 1 skip, 0 fail. Complete shared check log: /tmp/groma-csharp-sdk-XrB499/full-check.log. Criteria 1,2,3,5,6 have objective fixture/CLI/read-only evidence; AC4 remains open for actual compatible published Java/Angular metadata verification in TASK-326.7. DoD1 and whole-task completion remain open for that acceptance evidence. Release advisory: C# TargetFramework values such as net10.0 are preserved as declarations but are not numeric semantic versions; release integration must interpret supported framework identity explicitly before offering C# installation. No code changes or commits followed the final review.

Coordinator accepted the verified technical implementation, cold and full-context reviews, and the latest passing shared repository check, and authorized committing/pushing the completed discovery code separately from installation work. TASK-326.1 remains In Progress with AC4 and DoD1 open for compatible published Java/Angular catalog verification. The discovery-only frozen versions of src/scanner/cli.ts and docs/scanners/index.md are staged so TASK-326.3 changes remain uncommitted.

Vue/React discovery extension is code-stable. Added vue/react dependency declarations to the existing package.json rule and reused installed-version resolution, with complementary unavailable @groma catalog placeholders and no fabricated release support. Extended the existing mixed fixture with root React and nested Vue; one additional concurrent test proves declaration evidence, installed versions, retained embedded TypeScript, unavailable public packages, compatible fixture releases, and out-of-support rejection. Focused discovery suite: 7 pass, 50 assertions; scoped Biome lint and git diff --check pass. Own specification review confirms AC7 implementation behavior with fixture evidence; public release qualification remains TASK-326.7 and AC4 remains open. Own quality review found no blocking defect or new infrastructure. Awaiting coordinator shared check and full-context gate; no commit or push.

Vue/React extension accepted by coordinator: final full-context review passed with no changes required; shared bun run check passed (Node 110, Bun 398, 7 tool-dependent skips, zero failures; six existing complexity warnings), log /tmp/groma-vue-react-check.log. Actual packed Vue REPL and React Backlog consumer reports confirm root project declaration evidence, installed versions, embedded TypeScript retained, and unavailable complementary public candidates. AC7 is verified. AC4 and whole-task completion remain open for published Java/Angular catalog qualification.

Scope reconciliation approved by Alex on 2026-09-12: close the accepted implementation/local-evidence scope, apply TASK-352 removal of package qualification and CI test requirements, and consolidate all remaining public delivery in TASK-356. Revised criteria describe recorded completed behavior; older notes about waiting for publication or rebuilding qualification automation are superseded. Historical evidence and modified-file traceability are preserved. No source files or tests were changed or rerun for this task-record cleanup.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Discovery implementation is complete: root/nested declaration evidence, configured selections, compatibility handling and complementary framework recommendations were accepted in the recorded focused, consumer and review evidence. Completion covers truthful unavailable catalog entries; public release qualification and catalog activation are consolidated in TASK-356.
<!-- SECTION:FINAL_SUMMARY:END -->
