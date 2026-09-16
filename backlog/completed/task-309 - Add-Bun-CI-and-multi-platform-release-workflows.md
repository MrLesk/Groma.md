---
id: TASK-309
title: Add Bun CI and multi-platform release workflows
status: Done
assignee:
  - '@codex'
created_date: '2026-09-06 17:15'
updated_date: '2026-09-06 17:54'
labels:
  - release
  - ci
dependencies: []
references:
  - CONTRIBUTING.md
  - package.json
  - scripts/build.ts
  - /Users/alex/projects/Backlog.md/.github/workflows/ci.yml
  - /Users/alex/projects/Backlog.md/.github/workflows/release.yml
  - agent-instructions
  - page
  - web-server
  - web-shell
  - build
  - smoke-compiled-build
modified_files:
  - package.json
  - scripts/build.ts
  - scripts/npm/cli.cjs
  - scripts/smoke-compiled-build.ts
  - src/agent-instructions.ts
  - src/viewers/web/chrome/credits.ts
  - src/viewers/web/page.ts
  - src/viewers/web/startup/page.ts
  - test-bun/release-version.test.ts
  - CONTRIBUTING.md
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
ordinal: 347000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Automate the supported Groma build lifecycle. Pull requests and pushes to main should run the Bun 1.4.1 repository checks and a standalone binary smoke test. Version tags should prepare the manifest in the disposable checkout, build and verify platform binaries with the Bun 1.4.1 compiler, publish the groma.md npm wrapper and platform packages, create a GitHub release with checksums, and synchronize main only after publication and installation checks succeed. The root package manifest is public so the published package identity matches the README.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The CI workflow runs for pull requests and pushes to main, installs Bun 1.4.1 from the frozen lockfile, runs bun run check, and smoke-tests a compiled binary version.
- [x] #2 The build command accepts release target and output settings, embeds the files required by the standalone CLI, and carries the prepared package manifest version into the executable.
- [x] #3 The release workflow runs for v*.*.* tags, builds the supported Bun targets, verifies each binary outside the checkout with --version and --help, uploads release binaries and checksums, and publishes the groma.md wrapper plus OS/CPU-specific npm packages.
- [x] #4 The release workflow verifies the published package on supported runner platforms and updates package.json on main only after all publication and installation checks pass.
- [x] #5 The root package manifest is public, its documentation describes the publishable package and release sequence, and the workflow files pass repository validation.
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
1. Record the public package and release workflow contract in the task and inspect the existing build/runtime asset paths. 2. Update scripts/build.ts for Bun 1.4.1 cross-target compilation, embedded assets, and release metadata; add the small npm binary resolver used by the generated publishable wrapper. 3. Add pull request/main CI with frozen installation, repository checks, and compiled binary smoke coverage. 4. Add tagged release automation for six Bun targets, checksums, GitHub Release assets, platform package publication, wrapper publication, install sanity, and post-publication version synchronization. 5. Update package metadata and contributor release documentation, then run focused checks and bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The sibling /Users/alex/projects/Backlog.md uses ci.yml and release.yml with Bun 1.3.14. Groma will keep the phase ordering but use Bun 1.4.1 Bun.build compile options, including cross-target output and embedded assets. Root source dependencies remain workspace-only, so npm publication uses generated staging manifests and platform binary packages.

Implemented the Bun 1.4.1 build entrypoint with target/output environment controls, static instructions text, virtual-filesystem asset paths, and temporary unique credit metadata assets. Added the npm wrapper resolver, compiled-binary smoke helper, and CI workflow. Local version/help, agent-instructions, web startup, wrapper, package dry-run, YAML parse, and typecheck checks pass.

The first full check caught that a direct Markdown import is unsupported by Node/tsx and that Bun directory assets preserve only the asset directory basename. Restored source-mode fs reads with compiled virtual paths, embedded the docs directory, and updated the release regression checkout. Focused release-version test, typecheck, compiled agent guide, compiled web startup, and smoke helper now pass.

Release build jobs now use native GitHub-hosted runner labels for each target (ubuntu-24.04-arm, macos-15-intel, macos-15, windows-11-arm), so every cross-platform executable can run its isolated --version/--help smoke instead of being executed on a mismatched CPU. The final sync job commits package.json directly to main after the GitHub release and install-sanity jobs complete.

Final verification: bun run check passes (108 Node tests, 333 Bun tests; six pre-existing Biome complexity warnings); the release-version regression passes; a fresh standalone build reports 0.1.0 and agent-instructions from /tmp; workflow YAML parses and scripted assertions cover triggers, six targets, native runners, smoke, artifact publication, publish ordering, install gating, and main version sync; git diff --check passes.

Committed as ce16d7c (TASK-309 - Add Bun CI and multi-platform release workflows). Only the task files were committed; unrelated working-tree changes remain outside the commit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added Bun 1.4.1 CI and release automation for public groma.md packages. The build embeds runtime assets and release metadata, publishes six native platform packages plus the npm wrapper, verifies isolated binaries and installs, and synchronizes package.json on main after those gates. Verified with bun run check (108 Node, 333 Bun), the release-version regression, standalone isolated smoke, YAML parsing, workflow assertions, and git diff --check.
<!-- SECTION:FINAL_SUMMARY:END -->
