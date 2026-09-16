---
id: TASK-318
title: Fix release workflow after successful builds
status: Done
assignee:
  - '@cursor-agent'
created_date: '2026-09-06 21:36'
updated_date: '2026-09-06 21:36'
labels: []
dependencies: []
modified_files:
  - .github/workflows/release.yml
ordinal: 356000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Release v0.0.2 was the first run in which all five build jobs passed, and it exposed two defects in the jobs that follow. `github-release` runs `gh release create` without a checkout, so gh fails with "not a git repository" because it resolves the repository from the git remote. Every `publish-groma.md-<target>` job downloads its binary into `artifact/` and only then runs `actions/checkout`, whose default clean step (`git clean -ffdx`) removes the untracked download, so `cp artifact/<binary>` fails.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `github-release` creates the GitHub release without a checkout by naming the repository through `GH_REPO`
- [x] #2 Platform publish jobs check out the repository before downloading their artifact, so the binary survives to the packaging step
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Two one-line workflow fixes, both surfaced by release run 34061361210 (tag v0.0.2), the first run in which all five builds passed. `github-release` now sets `GH_REPO` so `gh release create` resolves the repository without a checkout. Platform publish jobs run `actions/checkout` before `actions/download-artifact`; the previous order let the checkout clean step delete the downloaded binary. YAML parses. Verified by re-tagging v0.0.2 on the fixed commit, since the failed run published nothing.
<!-- SECTION:NOTES:END -->
