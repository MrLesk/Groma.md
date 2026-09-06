---
id: TASK-320
title: Trigger releases from a published GitHub release
status: Done
assignee:
  - '@cursor-agent'
created_date: '2026-09-06 22:13'
updated_date: '2026-09-06 22:13'
labels: []
dependencies: []
modified_files:
  - .github/workflows/release.yml
  - CONTRIBUTING.md
ordinal: 358000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Releases start on the GitHub releases page: the release carries the notes and creates the tag. The workflow currently listens for tag pushes and then runs `gh release create`, which fails because the release already exists, and the version sync to main depends on that job. It should run on `release: published`, keep the tag-derived version, and attach the binaries and checksums to the existing release.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The release workflow runs when a GitHub release is published and reads the version from that release's tag
- [x] #2 Binaries and `SHA256SUMS` are uploaded to the existing release instead of creating a new one
- [x] #3 CONTRIBUTING.md describes publishing a GitHub release as the way to start a release
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
The workflow now runs on `release: published`. For that event `GITHUB_REF` is `refs/tags/<tag>`, so every `github.ref_name` use and the version derivation are unchanged and checkout lands on the tagged commit. The former `github-release` job is `release-assets`: it downloads the five build artifacts, writes `SHA256SUMS`, and runs `gh release upload <tag> release/* --clobber` against the release that started the run; `sync-version-to-main` depends on it. Release notes are written on the releases page; the workflow no longer generates them. CONTRIBUTING.md describes publishing a release as the way to start one and says not to push tags by hand. YAML parses.
<!-- SECTION:NOTES:END -->
