---
id: TASK-457
title: Publish Groma’s architecture demo on GitHub Pages
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 13:51'
updated_date: '2026-09-20 14:13'
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
- [x] #1 The Groma.md repository publishes its existing architecture as a static GitHub Pages map under architecture/blueprint/.
- [x] #2 The publication refreshes after pushes to main and can be run manually.
- [x] #3 The README contains a See it in action link that opens the deployed map; the Blueprint theme and component navigation are verified on the public site.
- [x] #4 The workflow reuses the existing export and GitHub Pages actions without changing architecture semantics or publishing a Groma package release.
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
1. Export the committed OKF architecture and C4 map with Groma from the same main checkout, as Alex approved. Keep scans, curation, and package releases outside this deployment.
2. Use Bun 1.4.1, locked repository dependencies, and Backlog.md 1.52.0. In the disposable CI checkout, select the exact published scanner names and versions from the existing local manifests, preserving IDs, settings, exclusions, and order. Restore and check them through Groma’s scanner CLI because source outlines require their runtimes.
3. Use the existing Pages build/deploy pattern on pushes to main and manual dispatch. GitHub supplies the site base URL; GROMA_THEME selects the architecture/blueprint/ directory, export metadata, and deployment link. Upload only the site directory.
4. Link See it in action from the README to the public map. Verify the real deployment, Blueprint selection, component navigation, source outlines/text, and sharing metadata. Use existing checks and real deployment evidence; add no tests for workflow wiring or link copy.
5. Complete the implementer specification and quality reviews and the requested full-context complexity review. Record the results, mark Done, and commit/push only this task’s files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Confirmed that MrLesk/Groma.md has no Pages site and the account has repository administration access. Existing groma/ architecture is already initialized and curated. The public Action and latest npm CLI both use 0.3.3; main has the requested theme-path support. Awaiting Alex’s choice between exporting the existing records with the same main checkout and waiting for the next release to use the Action. Other current workspace changes do not overlap README.md or the new Pages workflow.

GitHub Pages is now enabled with build_type=workflow. GitHub returned https://mrlesk.github.io/Groma.md/ as the public project-site root. OKF/C4 reasoning: this publishes an existing OKF bundle and C4 model; it introduces no record, metadata, relationship, or containment level. Ordinary Markdown remains the semantic authority, and the existing static exporter owns its browser projection. This arrangement does not depend on the languages inside a repository.

Alex approved trying the main-based publication now if it does not break existing behavior. This adds only a new Pages workflow and a README link, and uses the existing read-only export path. Native scanner installation is unnecessary because export reads curated records and source directly. Current unrelated workspace changes remain outside this task.

Local bun run check passed: 16 Node tests, 617 Bun tests, 36 optional artifact skips. The first real export failed because the shared checkout’s C# development scanner has no built runtime. Export asks selected scanners for code outlines even without scanning. The publication workflow will use matching released scanner packages only in CI; local scanner selections and architecture stay unchanged.

Pre-deployment review: the README links to the exact Blueprint subdirectory; the workflow checks out main with history for task diffs, installs pinned tools and locked dependencies, restores exact scanner runtimes from existing manifests, exports stored architecture, uploads only site/, and deploys through the Pages environment. No scan, repository write-back, scanner version upgrade, or product-code change was added. YAML parsing and git diff --check passed. Public-page acceptance criteria remain open until the first deployment is verified.

Publication succeeded at commit 03d64798f801b8399545922eec3dac2939de3270: https://github.com/MrLesk/Groma.md/actions/runs/35515468207. Both build and deployment passed, including all eight scanner runtime restores/checks. The public URL returns HTTP 200. Browser verification opened Blueprint from the path with no theme query, navigated Groma > Groma application > Static export, showed function outlines, and opened exportWebViewer at line 111 with its actual source text. No browser errors were recorded. The published HTML has the exact canonical Open Graph URL and a Blueprint PNG that returns HTTP 200 at 1200×630. The GitHub README contains the live See it in action link.

Final specification and quality review passed: the existing exporter owns the content; the workflow owns deployment and temporary runtime selection; the README owns discovery. Settings and exclusions are preserved, tracked groma/scanners.json is unchanged, and unrelated shared files were excluded from the commit. The final full-context complexity reviewer found no blockers or recommended changes. This is bounded deployment wiring, so no cold domain-architecture review or new automated test was needed. Local repository checks passed (16 Node tests, 617 Bun tests, 36 optional skips); exact implementation-commit CI passed Linux and macOS, while Windows is still building its existing Swift test package.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Published Groma’s committed architecture at https://mrlesk.github.io/Groma.md/architecture/blueprint/ and added See it in action near the top of the README. Main pushes and manual dispatch use the same main checkout, restore exact published scanner runtimes only in CI, and deploy the existing static export through GitHub Pages. The first deployment, Blueprint navigation, source outlines/text, and social-preview image were verified. Local repository checks and the complexity review passed. No Groma package release or local scanner-configuration change was made.
<!-- SECTION:FINAL_SUMMARY:END -->
