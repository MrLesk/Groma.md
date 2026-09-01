---
id: TASK-231
title: Initialize Groma agent instructions explicitly
status: Done
assignee:
  - '@codex'
created_date: '2026-09-01 17:37'
updated_date: '2026-09-01 18:49'
labels: []
dependencies: []
references:
  - agent-instructions
  - commands
modified_files:
  - src/agent-instructions.ts
  - src/cli.ts
  - test/instructions.test.ts
  - README.md
  - docs/product-model.md
  - groma/observed/systems/groma/containers/cli/components/agent-instructions.md
ordinal: 251000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Introduce `groma init` as the explicit action that registers a repository for coding agents. For this atomic task, initialization ensures a short managed Groma nudge exists in the root agent-instruction files already used by the repository. The nudge tells a newly started agent that the project uses Groma, requires it to run `groma agent-instructions` before planning or changing code, and tells it not to edit Groma-owned architecture files directly. Instruction-file discovery and symlink reconciliation run only during `groma init`; normal `groma web` startup remains focused on scanning and opening the map. Preserve existing instructions, do not add another setup command, and do not copy the complete Groma guide into repository files.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Running `groma init` appends one managed Groma nudge to both root `AGENTS.md` and root `CLAUDE.md` when both exist as distinct files.
- [x] #2 When exactly one of root `AGENTS.md` or root `CLAUDE.md` exists, `groma init` appends the managed nudge only to that existing file and does not create the other filename.
- [x] #3 When neither root instruction file exists, `groma init` creates only root `AGENTS.md` and writes the managed nudge there.
- [x] #4 When `AGENTS.md` and `CLAUDE.md` resolve to the same file through a symlink, `groma init` writes the managed nudge once, preserves the symlink, and does not duplicate the block through the second path.
- [x] #5 Groma preserves all content outside its managed block and leaves unrelated repository files unchanged.
- [x] #6 After any number of `groma init` runs, each distinct instruction file contains exactly one managed Groma nudge.
- [x] #7 The managed nudge states that the project uses Groma, directs agents to run `groma agent-instructions` before planning or changing code, and forbids direct edits to Groma-owned architecture files.
- [x] #8 `groma web` does not inspect, create, or update `AGENTS.md` or `CLAUDE.md`; agent-instruction reconciliation belongs only to `groma init`.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
- [x] #5 Automated tests cover no instruction files, each single-file case, two distinct files, and the common `CLAUDE.md` symlink to `AGENTS.md` case.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Scenario outline: Register Groma for coding agents
Given a repository has <instruction files>
When the developer runs groma init
Then each distinct existing root instruction file contains exactly one managed Groma nudge
And when none exists only AGENTS.md is created
And all content outside the managed block and all unrelated files remain unchanged
And the nudge requires groma agent-instructions before planning or changing code and forbids direct edits to Groma-owned architecture files

1. Keep repository registration in the existing agent-instructions domain: discover root AGENTS.md and CLAUDE.md, deduplicate paths that resolve to the same file, create only AGENTS.md when neither exists, and reconcile one private managed nudge while preserving surrounding content.
2. Wire only groma init to that operation and return the normal concise success output; leave groma web unchanged.
3. Cover no files, each single-file case, two distinct files, the CLAUDE.md symlink case, preservation, required wording, and repeated runs with parallel-safe temporary-repository CLI tests.
4. Document the public behavior and use Groma to consolidate source evidence into the existing Agent instructions architecture component so the domain has one owner.
5. Verify focused behavior, lint, types, task scope, and the full repository check; resolve cold simplicity, specification, quality, and full-context architecture reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context review: L2 public CLI and filesystem behavior. The operation belongs outside the web host and existing instruction catalog. Current unrelated working-tree changes are limited to Groma architecture/task records and GROMA-BUSINESS-REQUIREMENTS.md; TASK-231 will preserve them. No active task records have overlapping Modified files.

Implemented isolated repository registration in the agent-instructions domain and wired only groma init. Focused instruction/CLI suite passes: 14 tests, including no files, each single file, two distinct files, repeated runs, preservation, and CLAUDE.md -> AGENTS.md symlink.

Cold simplicity review passed with no findings. The reviewer found the direct CLI -> instruction-file discovery -> managed-block reconciliation -> conditional write flow minimal and easy to follow; no code, tests, documentation, or concepts should be removed or collapsed.

Specification and quality reviews passed with no findings. They verified every acceptance criterion, the public docs and observed component, parallel-safe tests, and that only groma init calls repository reconciliation; a direct groma web run left AGENTS.md byte-for-byte unchanged.

Repository verification: focused Biome lint passed, TypeScript passed, 14/14 instruction tests passed, and git diff --check passed. bun run check reached 97/99 Node tests with every TASK-231 test passing, then stopped on unchanged scan-watch tests: test/scan-watch.test.ts hit EMFILE (too many open files) and test/cli-scan.test.ts received no watcher output. The scan-watch test still hits EMFILE alone, and TASK-230 already records these same two shared watcher failures. No task file participates in them.

Full-context architecture review found duplicate Agent instructions ownership and a test-only production export. Alex approved both recommendations. Consolidated cli-agent-instructions into the existing agent-instructions component through groma edit, removed the empty scan singleton, replaced task references with the sole semantic owner, made the managed block private, and kept tests on observable CLI output.

After the approved architecture fixes, the targeted re-review passed with no remaining blocker. One agent-instructions component now owns the domain and src/agent-instructions.ts evidence; the managed block is private; 14/14 focused tests, focused Biome lint, TypeScript, and git diff --check pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented groma init as the sole repository-registration action for coding agents. It reconciles one short managed Groma block across distinct existing root AGENTS.md and CLAUDE.md files, creates only AGENTS.md when neither exists, preserves symlinks and surrounding content, and remains idempotent. Kept the behavior in the existing Agent instructions domain, documented the command, and consolidated architecture ownership to one component. Verified all supported file arrangements and wording through 14 passing CLI tests, plus focused Biome lint, TypeScript, diff checks, specification, quality, simplicity, and full-context architecture reviews. The full repository run passed all TASK-231 tests but remains blocked by the previously recorded unrelated scan-watch EMFILE failures.
<!-- SECTION:FINAL_SUMMARY:END -->
