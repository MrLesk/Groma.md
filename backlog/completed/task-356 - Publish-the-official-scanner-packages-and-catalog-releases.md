---
id: TASK-356
title: Publish official scanners through one shared npm release workflow
status: Done
assignee:
  - '@codex'
created_date: '2026-09-12 14:24'
updated_date: '2026-09-13 16:16'
labels:
  - scanners
dependencies:
  - TASK-358
references:
  - TASK-326
  - TASK-326.7
  - TASK-352
  - TASK-358
  - scanner-adapter
  - go-scanner-build
  - rust-src-scanner-index
  - rust-scanner-build
  - scanner-modules
  - framework-package
documentation:
  - docs/scanners/index.md
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/discovery.md
  - docs/scanners/release-qualification.md
  - docs/scanners/publishing.md
modified_files:
  - plugins/scanners/go/src/adapter.ts
  - plugins/scanners/go/build.ts
  - plugins/scanners/rust/src/index.ts
  - plugins/scanners/rust/build.ts
  - scripts/scanner-release.ts
  - .github/workflows/release.yml
  - docs/scanners/publishing.md
  - plugins/scanners/java/package.json
  - plugins/scanners/go/package.json
  - plugins/scanners/rust/package.json
  - plugins/scanners/csharp/package.json
  - plugins/scanners/angular/package.json
  - plugins/scanners/vue/package.json
  - plugins/scanners/react/package.json
  - plugins/scanners/typescript/package.json
  - package.json
  - packages/scanner/package.json
  - bun.lock
  - plugins/scanners/framework-package.ts
priority: high
type: feature
ordinal: 402000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Official scanners remain together in the Groma repository and use the same package contract and installer as third-party scanners. Optional implementations and local consumer examples are accepted, but users cannot yet obtain verified public releases through normal setup. Provide one maintainable release workflow for the shared scanner author contract and official packages, using npm as the normal distribution channel. Do not introduce separate repositories or a custom release-asset installer. TASK-358 already moved discovery and compatibility ownership into plugin manifests; publishing must use that contract instead of maintaining another catalog table.

Preserve the existing project-specific selection, exact versions, shared download cache, local-path development, explicit restore, and no hidden installs during scan or viewer startup. Package publication and installing official scanners are the scope here; Git sources, a runnable third-party authoring example, explicit updates, and TypeScript extraction have separate tasks. TypeScript delivery is implemented by TASK-362; the final shared release includes that prepared package through the same flow.

TASK-352 removed package qualification scripts, release smoke suites, publication dry-run checks, and install-sanity CI jobs. Do not recreate those or a cross-platform consumer-test matrix. Use focused manual release evidence and the normal repository check. Historical local validation does not establish public availability.

Confirmed release decisions: publish @groma/scanner and all eight @groma/scanner-* packages at initial version 0.1.0. Alex owns the groma npm organization and authorized publication. Support darwin-arm64, linux-x64, linux-arm64, win32-x64 and win32-arm64. Keep the main CLI named groma.md. The new scanner interface requires Groma 0.3.0; released Groma 0.2.0 uses the previous interface. Record separately which targets were built and which were manually exercised. npm two-factor approval and GitHub trusted publisher configuration are publication prerequisites.

The existing Java/Angular/TypeScript acceptance project is ../callforpapers, relative to the Groma repository. Use a disposable copy and its existing preparation instructions referenced by TASK-326. Record the exact checkout and tool versions used. One shared workflow means one maintainer release path; it does not require all scanner packages to have the same version number.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One shared release workflow publishes the scanner author contract (@groma/scanner, subject to final namespace) and the official C#, Java, Go, Rust, Angular, Vue, React and TypeScript packages from this repository; official packages use the public plugin contract and installer without privileged loading paths.
- [x] #2 Versioned packages are available under the final public npm names. Required worker programs are prebuilt for the advertised OS/CPU targets; users do not compile the scanner. Required project tools and actual platform limits are documented.
- [x] #3 A Groma build embeds discovery and compatibility metadata from the selected published plugin versions. Setup recommends the appropriate installable official scanners through that metadata; TypeScript uses the same package flow prepared by TASK-362.
- [x] #4 A user with a fresh compiled Groma can select and install an official scanner, inspect its exact source/version and readiness, and scan the existing ../callforpapers Java/Angular/TypeScript example. Record the checkout, preparation commands, public package/version references, and focused evidence.
- [x] #5 A second checkout restores the recorded exact npm selection using Groma, with project settings preserved and downloads cached across projects. Scan/viewer startup and installing a newer Groma do not silently change that selection. Existing remove and readiness commands remain usable.
- [x] #6 Release instructions describe one repeatable maintainer flow and the supported user installation path. The repository check passes; publication evidence names the platforms actually exercised without claiming a wider validation matrix.
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
Publish official scanners and their author contract from one trusted GitHub workflow. Groma 0.3.0 embeds published discovery metadata; changed framework packages can publish through the same workflow without republishing Groma. Verify public installation, readiness, scanning, source inspection and exact restoration with compiled Groma on the recorded callforpapers example. Record all five build targets separately from macOS arm64 consumer validation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution started after the user requested all tasks in order. GitHub CLI is authenticated as MrLesk; local npm whoami returns E401 Unauthorized. An asynchronous request asks Alex to sign in locally and confirm public names and targets. Preparatory implementation proceeds using current manifest names without treating them as approved public names.

Latest user instruction: Prepare everything, implement all tasks but do not do anything with npm because publication requires their 2FA. This supersedes public publication as a prerequisite for continuing implementation. No npm login, publishing, trust configuration or account changes will be attempted. Local artifacts and Groma/Bun dependency installation are used only for preparation and verification.

Preparation evidence: built all seven optional plugins and author contract on macOS arm64; compiled Groma accepted all seven staged packages; native package assembly and loading passed. Cold simplicity review found an eager builder import that broke clean CI assembly; fixed with imports local to stage(), and verified assembly without node_modules. Targeted re-review passed. Own specification/quality review of preparation found no other blocker. Public publication, final namespace/targets, 2FA and public install evidence remain deferred by the latest user instruction. Full repository check passed (16 Node, 256 Bun, six existing skips).

Final full-context review passed for the prepared flow. On a disposable checkout of callforpapers revision 1cb6783f3379664e3f176e72c5419064ce24dbfd, dependency preparation, compiled Groma initialization, installation of staged Java/Angular packages, readiness checks and scan all passed. Original callforpapers checkout was not modified. Implementation preparation is complete; public publication-related acceptance remains open by user instruction. Continuing dependent implementation with staged artifacts as explicitly authorized.

Final preparation includes TypeScript through TASK-362, so the shared stage now builds eight scanners plus the author contract. Staging and assembly passed on macOS arm64, including executable worker modes after artifact assembly. Public naming, platform approval, compatibility metadata and publication remain pending, as do real public install evidence and the selected combined React/Rust acceptance. No task should reintroduce embedded TypeScript based on the earlier sequencing note.

After TypeScript extraction, the disposable callforpapers checkout also passed current compiled Groma with explicit staged Java, Angular and TypeScript selections: readiness passed (TypeScript has no preparation hook), scan created 0 and refreshed 1390 records with 277 findings. Original project untouched. Exact npm restore, settings preservation and other-project isolation in AC5 were verified through the dependent compiled local-registry scenarios. Final check: 16 Node and 258 Bun tests pass, six existing skips; no lint warnings.

2026-09-13: Alex completed npm login. npm whoami confirms mrlesk. Read-only npm permission check confirms read-write access to the existing groma.md and its five platform packages. npm org ls groma returns E404 Scope not found, so publishing access to the prepared @groma namespace is not established. No package was published and no npm account or organization setting was changed. Authentication is resolved; final namespace and supported-platform decisions remain open.

2026-09-13: Alex created the groma npm organization and approved proceeding with groma.md as the main CLI, @groma/scanner as the author contract, and @groma/scanner-* as official plugins. npm org ls confirms mrlesk is its owner. Alex explicitly selected all five existing Groma targets: darwin-arm64, linux-x64, linux-arm64, win32-x64, win32-arm64. Continue the authorized publication after preparing the complete target artifacts and release metadata.

2026-09-13 release preparation: confirmed plugin manifests now carry public 0.1.0 metadata requiring Groma ^0.3.0. Exact exercised technology declarations are Java 25, Go 1.20 (Chi v5.2.1 go.mod verified from pinned upstream commit), Angular 21.2.19, Vue 3.5.18/3.5.42, React 19.2.7, and TypeScript 5.9.2/5.9.3/7.0.2. Rust and C# leave technology-version maps empty: approved globset has no rust-version, and C# discovery exposes framework labels rather than numeric compiler versions; no broad compatibility claim was invented. Added build-only workflow_dispatch to the shared release workflow for initial artifacts, while publication remains release-event-only. All eight packages and contract staged successfully at /tmp/groma356-first-release/darwin-arm64. Manifest inspection found no install scripts or workspace dependencies. Repository check passed: 16 Node and 258 Bun tests, six existing skips. Author contract tarball verified against current source; npm publish is awaiting browser two-factor approval (terminal session 92555), not yet confirmed published. Linux/Windows builds require the current prepared source on GitHub. A concrete 220-file release snapshot review is in /tmp/groma356-release-review/files.txt and prepared-source.patch, excluding Backlog records and generated architecture. Repository instructions prohibit staging other agents files, so explicit approval is needed before pushing that shared source snapshot; no release snapshot has been committed or pushed.

npm publication completed successfully after Alex approved two-factor authentication: @groma/scanner@0.1.0. Anonymous npm view confirms the package and tarball; integrity matches the reviewed artifact (sha512-CguHkd4CiTeFxML8IAYkvHLtygjKBCVRDYVmtwe1oohmvZY6R9AED3QIp8BCtcsPYVMw6yx5idBAiZxZG2QUxA==). Alex explicitly authorized committing the prepared shared source and pushing to main. Continue with that release snapshot and the shared workflow build-only run.

Trusted publishing successfully configured for @groma/scanner through npm 11.15.0 after Alex completed its separate 2FA approval. npm returned configuration b894935b-25be-4ffb-aa8a-52eb8912044d, provider github, repository MrLesk/Groma.md, file release.yml, permissions publish and stage publish. The eight plugin packages must first exist before their trust configuration can be added. No long-lived token was created. The temporary npm CLI is installed under /tmp/groma-npm-tools; the system npm installation is unchanged.

Alex requested completing trusted publishing before the newly requested nested-project scanner fix. Assemble the verified five-target workflow artifacts from run 34733177332 (source e0fabf3), publish the eight prepared 0.1.0 packages, then configure each GitHub trusted publisher. The later nested-project fix will use new package versions; published versions are immutable.

Trusted publishing setup completed after Alex approved npm browser authentication. All eight official scanners are now publicly published at 0.1.0 from the assembled five-target artifacts. Each trusts GitHub repository MrLesk/Groma.md, workflow release.yml, for publication: java 48e305b4-91d1-4ce3-a688-38eda84e1caa; go 2314c52a-d51f-48fc-8e13-3cb65f5e3750; rust 22847c2f-461d-45b7-bf8f-aa7be0227411; csharp bbdde880-ecc6-4f61-bdc7-1dcde57e680c; angular c191fd5a-21a1-43dd-adb2-fa1eca7875aa; vue 921d549e-b21b-47d5-b63a-d64587f76284; react aff80efa-3c90-4832-b79c-b047fa56b52d; typescript 783bd890-1137-4ac8-b185-0f06539bec6c. The contract trust was completed earlier. Read-only npm trust list also verified groma.md and all five existing platform packages already trust this same repository/workflow. Future releases through GitHub Actions need no maintainer 2FA. No new CI release was triggered merely to test publication; fresh public consumer validation and the newly requested nested-project scanner fix remain pending.

Final release pass: current source changes require @groma/scanner 0.1.1 as well as all eight prepared scanner 0.1.1 packages. Updated the contract manifest and lockfile. Full repository check passed: 16 Node and 289 Bun tests, six existing native skips. The first sandboxed run could not open local servers/FSEvents; rerunning with the required local permissions passed. Existing main CI 34764129798 passed all three operating systems. Proceeding with the authorized Groma 0.3.0 GitHub release through trusted publication; concurrent TASK-166 working-tree files are excluded from this release commit.

Release 34764733268 built all five scanner targets but publication failed before uploading packages: npm parsed scanner-packages/contract as GitHub shorthand. The publish entry now resolves the staging directory to an absolute path, matching stage/assemble handling. Publish a corrected Groma 0.3.1 release rather than move the public v0.3.0 Git tag. Scanner packages remain the unpublished 0.1.1 versions.

Verified with the installed npm argument parser: scanner-packages/contract is type git, while its resolved absolute path is type directory. Full check after the one-line fix passed: 16 Node and 290 Bun tests, six native skips (the working tree also contains concurrent TASK-166 checks). Release CI validates the exact committed snapshot independently.

Release paused after Alex raised that the changelog had not been aligned. Cancelled workflow 34765239797 for v0.3.1 during validation, before scanner build/publication. npm still reports groma.md 0.2.0 and scanner contract/TypeScript 0.1.0. GitHub release entries v0.3.0 and v0.3.1 exist, but no npm package or binary was published by either attempt. Do not resume publication until the changelog and release sequence are aligned with Alex.

Alex approved the shorter Highlights / Behavior changes release notes and explicitly requested deleting both attempted tags/releases and creating a clean v0.3.0. Deleted the v0.3.0 and v0.3.1 GitHub releases and remote tags, then created v0.3.0 at corrected commit 184072e67d4bf66be49b7154314346dfca5e5040 with the reviewed notes and v0.2.0...v0.3.0 comparison. This supersedes the publication pause and v0.3.1 plan. Trusted release workflow restarted; successful package publication and consumer checks remain to be verified.

All eight scanner 0.1.1 packages and @groma/scanner 0.1.1 were published through GitHub OIDC in run 34765688173. CLI builds read the registry before Vue was visible: build lookups at 15:40:10–48 UTC preceded the registry publication timestamp 15:40:57. All eight exact versions now resolve through the same readPublishedScanners code. Rerunning only failed CLI jobs; no package/version/code change is required.

Public consumer checks found Angular/React/Vue compiler library paths embedded from the CI host. The shared builder now ships the pinned compiler as typescript.cjs beside its existing library declarations and keeps that import external to the adapter bundle. No compiler patch, runtime fallback, added dependency or architecture semantic change. Relocated React scan on Yaak passed (245 files, 8 invocations); Angular on callforpapers passed (711 files, 121 invocations). All three compilers resolve libraries inside their installed package. Existing framework suite: 13 passed; full repository check: 16 Node and 290 Bun passed, six native skips. Added an explicit publish_scanners input to the same trusted workflow to publish corrected framework packages at 0.1.2 without republishing Groma 0.3.0. Other scanner versions remain 0.1.1. Implementer specification/quality review passed for this bounded packaging fix.

Groma 0.3.0 release run 34765688173 completed successfully after rerunning CLI builds once npm exposed the exact scanner versions. All five standalone binaries and SHA256SUMS are attached. npm delayed macOS package visibility for several minutes after accepting it; a later genuinely fresh npm install (npm-clean) installed both wrapper and platform package and reports 0.3.0. Its binary matches the GitHub asset SHA-256 5de96a46499d67e04209041967e904ac7ae09ddd80fe105dfeb6b56f3b452ff9. Scanner-only fix publication is run 34767264377 at 5a6ab23; main CLI is not republished.

Final acceptance passed on macOS arm64 using npm-installed Groma 0.3.0. Final public versions: @groma/scanner, Java, Go, Rust, C# and TypeScript 0.1.1; Angular, React and Vue 0.1.2. Every package has GitHub provenance. Release 34765688173 and scanner-only release 34767264377 succeeded. Both workflows built darwin-arm64, linux-x64, linux-arm64, win32-x64 and win32-arm64; only darwin-arm64 consumer behavior was manually exercised.

callforpapers revision 1cb6783f3379664e3f176e72c5419064ce24dbfd was archived into /tmp/groma-public-030/callforpapers. Its previously prepared node_modules was copied with cp -cR; installed Angular is 21.2.19 and TypeScript 5.9.3. Maven preparation ran ./mvnw --batch-mode --no-transfer-progress --non-recursive org.apache.maven.plugins:maven-help-plugin:3.5.1:effective-pom org.apache.maven.plugins:maven-dependency-plugin:3.9.0:build-classpath -Doutput=/tmp/groma-public-030/cfp-pom.xml -Dmdep.outputFile=/tmp/groma-public-030/cfp-classpath.txt -DincludeScope=compile with Java 25.0.1. Groma init and discovery offered the matching plugins; bare npm package installation pinned Java/TypeScript 0.1.1 and Angular 0.1.2. Check, scan, plain view and static export passed: 1394 created records, 277 findings, and 451 components with source outlines in the export. These are snapshot counts, not accuracy claims.

A separate full project copy restored the exact committed selection with the registry pointed at an unavailable local endpoint. Cached package payload files and timestamps were unchanged; the installer rewrites its own cache manifest normally. Project configuration stayed byte-identical through restore/check/scan. Removing all selections preserved saved Markdown byte-for-byte, kept plain viewing available and left the original checkout unchanged. Public Vue 0.1.2 also installed and scanned the existing vue-output fixture (5 records).

Fresh npm install of groma.md@0.3.0 installed the wrapper plus macOS binary; its SHA-256 matches the GitHub asset. Tool versions and raw evidence are under /tmp/groma-public-030: environment.json, final-public-packages.json, callforpapers-public.log, restore-public.log, vue-public.log and the two static sites. Earlier temporary harness assertions were corrected to match the current bare-package recommendation and cache-wrapper behavior; no product assertion was removed. Required full check after the final code change passed 16 Node and 290 Bun tests with six existing native skips. Self specification and quality review found no remaining acceptance blocker. Existing domain reviews remain applicable; the final changes were bounded package delivery fixes, with no new OKF/C4 meaning.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-09-12 20:41
---
Astra reviewed this task without conversation history. Clarified the identified handoff gaps; unresolved release or example choices are explicitly recorded rather than inferred. Scope and To Do status are unchanged.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Published Groma 0.3.0 and all official scanner packages through trusted GitHub publishing. Corrected framework compiler packaging and released Angular/React/Vue 0.1.2 through the same workflow without a new CLI release. Verified five-target builds, public macOS installation, callforpapers scanning and source export, exact second-checkout restore, shared cache reuse, removal and preserved saved architecture. Repository checks pass.
<!-- SECTION:FINAL_SUMMARY:END -->
