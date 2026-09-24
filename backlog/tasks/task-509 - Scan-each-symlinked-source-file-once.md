---
id: TASK-509
title: Scan each symlinked source file once
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 06:06'
updated_date: '2026-09-24 16:05'
labels: []
dependencies: []
references:
  - scanners-projects
  - typescript-src-index
modified_files:
  - plugins/scanners/projects.ts
  - test-bun/scanner-source-listing.test.ts
  - docs/scanners/creating-a-plugin.md
  - plugins/scanners/typescript/src/files.ts
priority: high
type: bug
ordinal: 590000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Some repositories reach the same source file through tracked symlinks. RxSwift mirrors 431 of its Swift files into Sources/ this way so SwiftPM can build them, and the Swift scan produced 411 duplicate components and 923 lint findings that only paired a file with its own alias. Every scanner except the native Rust path lists sources through the shared repository listing in plugins/scanners/projects.ts, so each of them reads such a file twice. Alex asked for this fix as a priority after the Swift qualification (TASK-502).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When a tracked or unignored symlink points to another file in the same shared listing, the listing keeps only the file it points to, so every scanner that uses it reports that source once.
- [x] #2 A symlink whose target is not in the listing, such as a file outside the repository, stays listed.
- [x] #3 A pinned RxSwift checkout scans each of its physical Swift files once, with no component or lint finding produced by a symlink alias.
- [x] #4 The complete repository check passes.
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
1. In plugins/scanners/projects.ts, repositoryFiles keeps the tracked and unignored files that match and exist, then drops a symlink whose physical target is another file in that same list; a symlink to anything else stays. Every scanner that lists through repositoryFiles or projectFiles inherits the rule.
2. Document the rule once in docs/scanners/index.md.
3. Test decision: rule = one entry per physical source path (creating-a-plugin.md observation contract; reproduced on RxSwift in TASK-502) | wrong result = a symlinked file is listed and scanned twice, creating a duplicate component and alias lint findings | gap = no listing test has a symlink; add one case to scanner-source-listing.test.ts with an in-repository alias and an outside target, skipped on Windows where checkouts may not create symlinks.
4. Verify on a pinned RxSwift clone before and after, run the complete check in an isolated worktree, run the end-of-task review, delete the clone and report.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
repositoryFiles in plugins/scanners/projects.ts now drops a symlink whose real path is another file in the same listing; symlinks to anything else stay. Every scanner listing through repositoryFiles or projectFiles inherits the rule; the Rust worker already canonicalizes paths natively.
Evidence: the new listing case fails on the old code (the alias is listed) and passes now; the 13 existing per-scanner listing cases are unchanged. RxSwift at 3e33f90c1bcd3cdea25bdb49bd4a594a50c3ab84 (1,019 tracked Swift files, 431 symlinks): the Swift listing went from 1,017 to 586 files; the full Groma flow created 586 components with no Code reference through a symlink, lint findings fell from 1,275 to 351, and a second scan created nothing; all five entries remain, including both AppDelegate containers.
Complete check in an isolated worktree at 2833e50a with only this task's hunks: Biome (4 existing warnings in untouched files), typecheck, 16 Node tests and the Bun suite (722 pass, 45 skip, 0 fail) pass.

Full-context review (general-purpose agent with a written brief; the fork agent type is unavailable) found that TypeScript and React listed files through a private git ls-files in plugins/scanners/typescript/src/files.ts, so the shared rule missed them. Alex approved three of its recommendations: listTypeScriptFiles now returns repositoryFiles with the TypeScript matcher (35 lines removed, one listing owner); the rule moved from docs/scanners/index.md into the Source file listing section of creating-a-plugin.md; the test uses test.skipIf. The listing case now also asserts the TypeScript listing: it lists the alias with the old private listing and passes with the shared one. Complete check at main 1cb44793 with only this task's hunks: Biome (4 existing warnings), typecheck, 16 Node tests and the Bun suite (729 pass, 45 skip, 0 fail) pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every official scanner now lists a symlinked source once, through the file it points to: the shared repository listing drops a symlink to another listed file, and the TypeScript and React scanners use that shared listing instead of their own. Symlink mirrors no longer create duplicate components or alias lint findings. Verified with a red-to-green listing test for the Swift and TypeScript listings, a full Groma flow on RxSwift (1,017 to 586 listed files, 0 symlinked Code references, lint 1,275 to 351) and the complete repository check (729 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
