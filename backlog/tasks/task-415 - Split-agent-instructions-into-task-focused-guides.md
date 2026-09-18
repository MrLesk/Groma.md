---
id: TASK-415
title: Split agent instructions into task-focused guides
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 19:38'
updated_date: '2026-09-18 17:50'
labels: []
dependencies: []
references:
  - instructions
  - src-cli
  - src-welcome
modified_files:
  - docs/agent-instructions/index.md
  - docs/agent-instructions/inspect.md
  - docs/agent-instructions/structure.md
  - docs/agent-instructions/describe.md
  - docs/agent-instructions/relationships.md
  - docs/agent-instructions/backlog.md
  - src/agent-instructions.ts
  - src/cli.ts
  - src/welcome/model.ts
  - src/instructions.ts
  - docs/product-model.md
  - docs/index.md
  - README.md
  - test-bun/agent-instructions.test.ts
type: enhancement
ordinal: 470000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`groma agent-instructions` prints one 363-line guide that mixes scan inspection, curation, structural commands, relationships, flows, Backlog links, scanner coverage and completion checks. Agents read all of it for any job and still guess commands. During a callforpapers review an agent tried `groma view project` because the guide documents `groma edit project`, while `groma view` accepts different targets than `groma edit`. Guides should work like skills: a short index routes the agent to the section for its current job.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `groma agent-instructions` prints a short index naming each guide, when to read it and the command that prints it.
- [x] #2 Each guide covers one job, such as inspecting a scan, curating structure, relationships and flows, or Backlog task links, and prints on its own.
- [x] #3 Guides state the targets each command accepts, so `groma view` and `groma edit` targets cannot be confused.
- [x] #4 The instructions registered by `groma init` point agents to the index, and no guide repeats another guide.
- [x] #5 The curation guide tells agents to exclude development and test tooling through `scanners.json` when it is not product architecture.
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
1. Replace the single guide with a short index (docs/agent-instructions/index.md) and five job guides in the same directory: inspect (scan, view targets, scanner coverage), structure (exclusions via scanners.json, boundaries, combine, move, group, actors, externals, ghosts, removal, completion checks), describe (title, description, overview, technology on elements, drafts and the project record), relationships (relation and flow commands and endpoint rules), backlog (task links and structural command output). Each guide lists the commands it uses with their accepted targets; content moves once, no guide repeats another.
2. src/agent-instructions.ts: no guide name prints the index; a known guide name prints docs/agent-instructions/<guide>.md (compiled asset or source URL); unknown names fail. The managed groma init block becomes a short pointer to the index for scanning, curating, architecture-model work and Backlog task work.
3. Update pointers that name the old curation guide: cli.ts argument/help text (no line growth), welcome/model.ts, instructions.ts, docs/product-model.md, docs/index.md, README.md links.
4. Add one bun test: every guide command named by the index prints on its own and an unknown guide fails.
5. Verify: bun run check, CLI output of index and each guide, compiled build prints a guide, duplicate-line check across guides.

Review round (external reviews of HEAD cf8e7975):
6. Fix: the structure guide's groma draft row required --parent for every kind and left out the required --overview. The row names --overview and states that containers and components take --parent, which a system refuses.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: docs/agent-instructions/index.md is now a 20-line index (guide, when to read it, command) that also defines <groma-root>; five guides in the same directory: inspect (scan, view --plain, view targets, scanner list, lint, coverage), structure (order of work, structural commands with targets, scanners.json exclusion of development and test tooling, container combines, skyscrapers, groups, checklist, example, completion checks), describe (edit targets for elements, drafts and the project record; description vs overview), relationships (derived vs authored rows, relation and flow commands with endpoint rules, flow step example), backlog (task link commands, per-file recording, structural command output). Future homes: view drill-down, file lookups and paging go in the inspect Commands table; detaching files, combining systems and ID renames go in the structure Commands table.
src/agent-instructions.ts: no name prints index.md, a registered name prints <name>.md, unknown names return undefined (CLI exits 1). The groma init managed block is now one pointer paragraph to the index covering scan, inspection, curation, scanner or model work, and Backlog task work; the inline Backlog summary moved entirely into the backlog guide. cli.ts stays 498 lines (argument list derived from the guide registry, help texts point to the index).
Verification: bun run check passed (Biome: only pre-existing diagnostics in files outside this task; tsc clean; node 16 pass; bun 368 pass, 17 skip, 0 fail). test-bun/agent-instructions.test.ts checks the index names exactly the registered guides, each prints distinct content, and an unknown name fails. CLI: 'agent-instructions' prints the index, each guide prints (35/192/36/73/69 lines), 'agent-instructions curation' exits 1 with 'unknown agent guide'. 'groma view project' exits 1 with 'unknown target: project', matching the inspect and describe guides. Standalone build (bun scripts/build.ts to scratch) prints the index and the backlog guide from embedded docs. initializeAgentInstructions on a temp AGENTS.md writes the new block once across two runs. A cross-guide duplicate-line check found no repeated lines. This repository's own AGENTS.md and CLAUDE.md were not changed.

Cold review corrections applied: structure.md exclusion example shows only the exclude key; describe.md no longer repeats the structure rule about authored meaning; relationships.md drops the groma view <flow-id> row covered by inspect; printed guides carry no relative doc links (structure points to groma agent-instructions backlog, relationships links the inference rule by absolute GitHub URL, the index table drops its file links); inspect.md describes interactive maps as a terminal behavior; structure.md says accept scans first when needed; the managed block drops the scanner and architecture-model clause; code names are agentGuideNames and readAgentGuide; the test asserts the name registry equals the shipped non-index guide files and the index names exactly the registry. Verification after corrections: bun run check in an isolated worktree at HEAD plus only this task's files passed (Biome: pre-existing diagnostics only; tsc clean; bun 361 pass, 17 skip, 0 fail; node suite pass). CLI prints the index and all five guides, unknown guide exits 1, cross-guide duplicate-line check is empty.

External review round (HEAD cf8e7975): the structure guide's groma draft row required --parent for every kind and left out the required --overview, so an agent following it for a system got an error. The row now reads groma draft <system|container|component> <name> --overview <markdown>, and says containers and components also take --parent <id>, which a system refuses (src/draft.ts rules). Verification: in a scratch copy of test/fixtures/plain-view, a system with --overview, a container with --overview --parent and a component with --overview --parent each printed ok, and a system given --parent exits 1 with '--parent is forbidden for a system'; groma agent-instructions structure prints the new row; bun run check in an isolated worktree at 9f2f823c with only this change passed (16 node tests, 520 bun tests pass, 34 skipped, 0 fail; biome warnings only in other files). Cold review found no further issues.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Split the single 363-line agent guide into a short index and five task-focused guides (inspect, structure, describe, relationships, backlog) under docs/agent-instructions/. `groma agent-instructions` prints the index (guide, when to read it, command); `groma agent-instructions <guide>` prints one guide; unknown names exit 1. Each guide lists its commands with accepted targets, so `groma view` targets (element, flow, draft ID or owned source file) are distinct from `groma edit` targets (`project`, `relation`, group addresses). The structure guide explains excluding development and test tooling through the `exclude` array in scanners.json. The block `groma init` writes is now one paragraph routing agents to the index. Pointers in the CLI help, welcome screen, human guides, product model, docs index and README were updated. Verified with bun run check (isolated worktree), a new test tying the index, name registry and shipped guide files together, CLI output of every guide, a standalone build printing embedded guides, a temp init run, and a cross-guide duplicate-line check.

Review round: the structure guide's groma draft row now names the required --overview and says only containers and components take --parent, which a system refuses; verified by following the documented commands in a scratch fixture copy and bun run check in an isolated worktree.
<!-- SECTION:FINAL_SUMMARY:END -->
