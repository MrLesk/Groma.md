---
id: TASK-64
title: Make bare groma and groma instructions the local instruction hub
status: Done
assignee:
  - '@grok'
created_date: '2026-08-16 19:46'
updated_date: '2026-08-16 21:15'
labels: []
dependencies:
  - TASK-62
  - TASK-63
  - TASK-65
  - TASK-66
references:
  - src/cli.ts
  - docs/product-model.md
documentation:
  - docs/product-model.md
priority: high
type: feature
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a person runs bare `groma` in a terminal, Groma prints a splash and exits. The splash is the word `groma`, the four-step workflow, and the list of instruction guides. It is not a viewer and not Commander help. `groma --help` stays the command list.

When stdout is not a TTY, or when `--plain` is passed, the same splash prints as plain text.

`groma instructions [guide]` always prints plain text. It is the local instruction address for agents in this repository. Guide bodies ship inside Groma; they are not read from the current working tree's `docs/` and they need no network.

This task comes after the commands it teaches. The splash and guides name only `view`, `scan`, `create`, `edit`, `accept`, and `instructions`.

Approved splash:

```text
groma

1. groma view — see the world
2. groma scan — fold this repo into Markdown
3. groma create / groma edit — author new parts, required changes, and explanations
4. groma accept <id> — accept a matched ghost

groma instructions overview
groma instructions authoring
```

Approved overview (`groma instructions` and `groma instructions overview`):

```text
# Overview

Groma is this repository's architecture in Git. Solid boxes exist. Ghosts are next. Groma is the only writer of files under groma/.

## Workflow

1. groma view — see the merged world. On a TTY with no target this is the map. groma view --plain prints the world as text. groma view <id|path> prints one record.
2. groma scan — scan this repo. Prints ok and a short summary. It does not print the architecture.
3. Change the architecture through Groma, not by editing groma/ files.
   - groma create — a new part becomes a ghost in a plan.
   - groma edit — groma edit <id> --description updates current meaning; groma edit <id> --plan <plan-id> restates an existing part as planned.
4. groma accept <id> — accept that ghost only if a scan has matched it.

## Rules of engagement

- Do not edit files under groma/ by hand.
- The architecture id is the kebab-case id in Markdown. Source code is evidence.
- A scan never accepts a ghost.
- Two plans must not claim the same element id.
```

Approved authoring (`groma instructions authoring`):

```text
# Authoring

Say what must be true, not how to build it. Do not specify frameworks, file layouts, or implementation detail unless a requirement forces it.

- New part: groma create <name> --plan <plan-id> --kind <kind> [--parent <id>] --description <prose>
  The id is the kebab-case of the name and stays that id when accepted.
- Required change to something that exists: groma edit <id> --plan <plan-id> [--description <prose>]
  Same box, shown as planned until accepted. Omit --description to keep the current lead prose.
- Current meaning of an existing id: groma edit <id> --description <prose>
- Plan outcome prose: groma edit <plan-id> --description <prose>

Kinds are person, system, container, and component. Containers need a system parent. Components need a container parent.
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bare groma on a TTY prints the approved splash and exits without starting a viewer
- [x] #2 Bare groma piped or with --plain prints that same splash as plain text
- [x] #3 groma instructions and groma instructions overview print the approved overview; groma instructions authoring prints the approved authoring guide; always plain text; an unknown guide fails with a nonzero exit code
- [x] #4 Splash and guides ship inside Groma and name only view, scan, create, edit, accept, and instructions
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
1. Add src/instructions.ts with splash, overview, and authoring string constants copied from the approved task text.
2. Root Commander program: default action prints splash and exits. Global --plain is allowed; output is the same. Do not start TUI/web.
3. Add instructions [guide]: default overview; overview and authoring as named guides; unknown guide writes stderr and exitCode 1. Always plain text.
4. Keep groma --help as the command list (view, scan, create, edit, accept, instructions).
5. Add one short product-model mention that bare groma and groma instructions are the local hub.
6. Add test/instructions.test.ts (node:test, spawn bun src/cli.ts with piped stdio) for splash, --plain, overview, authoring, unknown guide, and help still listing the named commands.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shipped splash, overview, and authoring as string constants in src/instructions.ts. Root Commander action prints splash (TTY and pipe are the same path; --plain accepted, unused for formatting). instructions [guide] prints overview or authoring; unknown guide writes `unknown guide: <name>` and exit 1. product-model gained one hub sentence.

Simplicity review: entry is bare groma or groma instructions [guide]; work is Commander routing to console.log of a shipped string; result is the approved text and exit. Nothing to delete. Flow is obvious from cli.ts.

Verification: node --import=tsx --test test/instructions.test.ts (6/6), test/cli-view.test.ts, test/create.test.ts; bun run typecheck. Piped CLI stdout matches the constants; --help still lists view/scan/create/edit/accept/instructions.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-08-16 19:55
---
Tightened after review: approved splash and guide text, no other-repository scope, no invented version, depends on the commands it teaches.
---

created: 2026-08-16 20:02
---
Aligned authoring text with TASK-66 --description flags.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bare groma prints the shipped splash and exits. groma instructions [guide] prints the shipped overview or authoring guide as plain text. Guides live in src/instructions.ts, not docs/. Verified with test/instructions.test.ts (piped CLI), existing view/create CLI tests, and typecheck.
<!-- SECTION:FINAL_SUMMARY:END -->
