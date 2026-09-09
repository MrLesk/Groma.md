---
id: TASK-326.1
title: Discover project technologies and recommend official scanners
status: In Progress
assignee:
  - '@scanner-discovery'
created_date: '2026-09-08 21:34'
updated_date: '2026-09-09 13:18'
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
A developer can inspect one repository and understand which official scanner plugins fit its languages and frameworks, including nested applications. Build on the existing scanner inventory and installation contract. The parent task defines the scope and language-tooling policy.

Use lightweight project evidence for discovery and established project tooling for semantic confirmation after installation. Support the Java/Angular project at ../callforpapers and the project declarations required by the C#, Go, and Rust delivery tasks. Recommend Java and the separate Angular plugin while retaining embedded TypeScript. Shared file coverage is intentional: Angular adds framework evidence and is not redundant merely because TypeScript already scans those files. State Angular compiler compatibility separately from the embedded TypeScript SDK. Match supported framework declarations to the support actually provided by a plugin; a declared dependency is not proof of runtime use. Discovery must not require installing the plugin it is trying to recommend.

An official catalog is maintained by Groma. It identifies the supported technology, compatible plugin package/version, and evidence for a recommendation. Prefer coverage through a small suitable set; do not invent numerical confidence scores or force a winner between materially different choices. Keep discovery rules within the supported examples and exclude dependency/generated content from project-owned discovery. Reuse branch project-selection and detection work where suitable.

Include Vue and React project declarations and their separate complementary framework plugins in discovery for the examples accepted in TASK-326.10 and TASK-326.11. Preserve declaration evidence and installed-version confirmation, the embedded TypeScript recommendation, and explicit unavailable status until compatible public package releases are verified. Do not claim complete framework runtime analysis from a dependency declaration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Discovery finds the supported language/project declarations in both the repository root and nested applications of the acceptance project, without stopping after the first match or counting dependency/generated directories as project applications.
- [x] #2 Each detected language or framework is associated with its evidence location; a framework declaration is reported as a discovery clue rather than verified runtime use.
- [x] #3 Recommendations come from the official catalog and account for Groma compatibility, declared technology/version support, and already available plugins; unreleased or incompatible packages are not offered as installable.
- [ ] #4 For ../callforpapers, the proposal retains embedded TypeScript and recommends compatible official Java and Angular plugins. Angular is complementary support despite scanning some of the same files; genuinely redundant installations are avoided and unclear alternatives are explained.
- [x] #5 Recognized technologies without a suitable plugin and uncertain findings remain visible as coverage limits; documentation states that discovery covers supported rules rather than every possible technology.
- [x] #6 Rerunning discovery after adding a supported nested project identifies the new support needed while retaining the existing configured selection.
- [x] #7 The reviewed Vue and React project declarations produce evidence-backed complementary scanner recommendations, with supported-version limits and unavailable public releases represented honestly.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add read-only declaration discovery in the existing scanner module-management domain, using project-owned Git inventory and supported root/nested ecosystem manifests. Preserve exact evidence paths and unresolved declarations.
2. Match findings to an official catalog, distinguish embedded/configured support from additions, and expose unreleased or unverified compatibility as coverage limits without installation offers. Keep Angular complementary to TypeScript.
3. Add scanner discover text/JSON entry points without modifying configuration or architecture; document supported rules and limitations.
4. Verify independent mixed-project fixtures, selection retention, compatibility decisions, and read-only callforpapers discovery. Obtain coordinator review and an exclusive repository-check slot.

5. Confirm installed Angular/TypeScript dependency versions through standard node_modules resolution paths without executing code, preserving declared ranges and separate version evidence. This allows compatible Angular releases to match the approved project shape without a custom range solver.

6. Extend the existing package declaration and installed-version rules to Vue and React, with complementary unavailable official candidates. Add one root/nested fixture check and update discovery documentation; preserve the current configuration, evidence model, and release qualification gate.
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
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented read-only scanner discovery with root/nested declaration evidence, installed-version confirmation, retained embedded TypeScript, and complementary Angular, Vue, and React candidates. Vue/React fixture and actual packed consumer discovery checks pass; shared repository check and final complexity review pass. Public release catalog qualification remains open under TASK-326.7, so TASK-326.1 stays In Progress.
<!-- SECTION:FINAL_SUMMARY:END -->
