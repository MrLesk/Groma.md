---
id: TASK-230
title: Separate human and agent instruction catalogs
status: Done
assignee:
  - '@codex'
created_date: '2026-08-31 19:09'
updated_date: '2026-08-31 19:24'
labels: []
dependencies:
  - TASK-229
references:
  - instructions
  - commands
  - agent-instructions
modified_files:
  - src/agent-instructions.ts
  - src/cli.ts
  - src/welcome/model.ts
  - src/instructions.ts
  - docs/agent-instructions/index.md
  - test/instructions.test.ts
  - README.md
  - docs/index.md
  - docs/product-model.md
  - groma/observed/systems/groma/containers/cli/components/instructions.md
  - groma/observed/systems/groma/containers/cli/components/agent-instructions.md
type: feature
ordinal: 249000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
People keep the interactive groma instructions catalog introduced by TASK-229. Agents get a separate, always-plain groma agent-instructions command backed by the shipped agent guidance, so precise operating rules cannot leak into or complicate the human Instructions screen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma instructions remains the human Overview and Authoring catalog with its existing interactive and plain behavior.
- [x] #2 groma agent-instructions and its default named guide print the shipped agent guidance as plain Markdown on both TTY and non-TTY output.
- [x] #3 An unknown agent guide fails clearly with a nonzero exit code, and the human guide command cannot select agent guides.
- [x] #4 The Advanced commands reference lists groma agent-instructions with clear optional-guide syntax without making it executable from the launcher.
- [x] #5 Product documentation and observed architecture describe human Instructions and Agent instructions as separate responsibilities.
- [x] #6 Every shipped human and agent guide points readers to both instruction commands for the rest of the available guidance.
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
1. Keep the human guide catalog and Instructions TUI unchanged, with explicit human naming in code and CLI help.
2. Add a separate agent-guide catalog that lazily loads the shipped agent-instructions document only when the agent command runs.
3. Route an always-plain groma agent-instructions [guide] command with curation as its default and named guide, plus isolated unknown-guide errors.
4. Add the agent command only to Advanced read-only references, and add the same concise human/agent command directory to every shipped guide.
5. Update public docs and model Agent instructions as its own observed CLI component through Groma.
6. Run focused checks, real TTY verification, the repository check, cold simplicity, specification, quality, and required full-context architecture reviews; then commit only task files and push shared main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Separated the ambiguous catalog names into humanInstructionGuides and agentInstructionGuides. The human catalog still drives the Instructions TUI; the agent catalog is reachable only through the always-plain agent-instructions command. The agent document is loaded lazily from the shipped docs path so unrelated and human commands do not depend on it.

Added one shared instruction-directory message to both human guide bodies and to the canonical agent curation document. Added the agent command as an Advanced read-only reference, updated public docs, narrowed the observed Instructions responsibility, and created a separate Agent instructions component.

Verification so far: focused Biome lint and TypeScript pass; 9/9 CLI instruction tests and 8/8 Welcome tests pass; a real TTY prints agent Markdown and exits without ANSI or the human screen. The full repository check passes all new instruction tests and remains blocked only by the two existing shared watcher failures (92/94 Node tests).

Cold simplicity review passed. Applied its only clarity finding by changing CLI help from generic instruction guide to human guide; no catalog or test deletion was recommended.

Specification and quality reviews passed every criterion with no findings. The required full-context architecture review also passed and recommended keeping the two explicit adjacent modules instead of a generic catalog abstraction. Applied its test improvement: the directory invariant now iterates both catalogs, so future guides are covered automatically.

A final workspace typecheck is now interrupted at unchanged scanner-watch code because TASK-228.2 changed the shared watchScan return type while waiting for this task to release src/cli.ts. TASK-230 typechecked before that concurrent API change; its final focused lint, 9 CLI tests, 8 Welcome tests, PTY checks, and diff check pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Separated human and agent guidance into explicit catalogs and commands. Human Overview and Authoring remain in the Instructions TUI or plain named output; groma agent-instructions [guide] always prints the canonical shipped Curation Markdown and loads it only when requested. Advanced lists the agent command as a read-only reference, every guide points to both catalogs, and public docs plus observed architecture describe the split. Verified with 9 CLI tests, 8 Welcome tests, focused lint and typecheck before the concurrent scanner API change, real TTY runs, diff checks, and simplicity, specification, quality, and full-context architecture reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
