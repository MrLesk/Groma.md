---
id: TASK-457
title: Publish Groma’s architecture demo on GitHub Pages
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-20 13:51'
updated_date: '2026-09-20 14:06'
labels: []
dependencies: []
references:
  - web-export
modified_files:
  - README.md
  - .github/workflows/architecture.yml
type: feature
ordinal: 529000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Readers can currently see screenshots in the README but cannot open Groma’s own architecture in a live browser map. Publish the repository’s existing curated architecture through GitHub Pages and give readers a direct See it in action link. This is deployment of the existing static export, with no new architecture concepts or public package release.

Scenario: Explore Groma’s own architecture
Given a reader is viewing the Groma.md README
When they follow See it in action
Then the public architecture map opens in the Blueprint theme
And they can navigate the committed architecture and inspect component details.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The Groma.md repository publishes its existing architecture as a static GitHub Pages map under architecture/blueprint/.
- [ ] #2 The publication refreshes after pushes to main and can be run manually.
- [ ] #3 The README contains a See it in action link that opens the deployed map; the Blueprint theme and component navigation are verified on the public site.
- [ ] #4 The workflow reuses the existing export and GitHub Pages actions without changing architecture semantics or publishing a Groma package release.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Export the committed OKF architecture and C4 map using Groma from the same main checkout, as Alex approved. Keep scans, curation, scanner configuration, and package releases outside this deployment.
2. Use the existing Pages build/deploy pattern: Bun 1.4.1 and locked repository dependencies, Backlog.md 1.52.0 for task data, the existing CLI export command with the Pages URL, then the official artifact upload and deployment actions. Run on pushes to main and manual dispatch.
3. Publish under architecture/blueprint/ and add the direct See it in action README link. GitHub Pages owns the public base URL; the workflow theme selects the directory and deployment link.
4. Verify the export and public page, including Blueprint selection, component navigation, and sharing metadata. No new automated tests are needed for workflow wiring or link copy; existing export behavior already has coverage. Run bun run check and inspect the real deployment.
5. Review the final diff and supported flow, obtain the requested full-context complexity review, record deployment evidence, and commit/push only this task’s files.

Before exporting in the disposable CI checkout, replace each configured local scanner source with its exact published package name and version from that scanner’s package.json, preserving IDs, settings, exclusions, and order. Restore and check those packages through the existing scanner CLI. This is required for exported source outlines; the real local export reproduced a missing C# runtime failure. All eight exact package versions were verified on npm. No new test is needed: the real CI export proves the selected package and outline flow.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Confirmed that MrLesk/Groma.md has no Pages site and the account has repository administration access. Existing groma/ architecture is already initialized and curated. The public Action and latest npm CLI both use 0.3.3; main has the requested theme-path support. Awaiting Alex’s choice between exporting the existing records with the same main checkout and waiting for the next release to use the Action. Other current workspace changes do not overlap README.md or the new Pages workflow.

GitHub Pages is now enabled with build_type=workflow. GitHub returned https://mrlesk.github.io/Groma.md/ as the public project-site root. OKF/C4 reasoning: this publishes an existing OKF bundle and C4 model; it introduces no record, metadata, relationship, or containment level. Ordinary Markdown remains the semantic authority, and the existing static exporter owns its browser projection. This arrangement does not depend on the languages inside a repository.

Alex approved trying the main-based publication now if it does not break existing behavior. This adds only a new Pages workflow and a README link, and uses the existing read-only export path. Native scanner installation is unnecessary because export reads curated records and source directly. Current unrelated workspace changes remain outside this task.

Local bun run check passed: 16 Node tests, 617 Bun tests, 36 optional artifact skips. The first real export failed because the shared checkout’s C# development scanner has no built runtime. Export asks selected scanners for code outlines even without scanning. The publication workflow will use matching released scanner packages only in CI; local scanner selections and architecture stay unchanged.

Pre-deployment review: the README links to the exact Blueprint subdirectory; the workflow checks out main with history for task diffs, installs pinned tools and locked dependencies, restores exact scanner runtimes from existing manifests, exports stored architecture, uploads only site/, and deploys through the Pages environment. No scan, repository write-back, scanner version upgrade, or product-code change was added. YAML parsing and git diff --check passed. Public-page acceptance criteria remain open until the first deployment is verified.
<!-- SECTION:NOTES:END -->
