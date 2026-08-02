# Main cleanup design

## Outcome

Main keeps current Groma product intent and production work while treating the
semantic-zoom renderer selection and OpenTUI spike as historical investigations.
The active Backlog board becomes empty without representing abandoned work as
completed.

This cleanup changes documentation and Backlog lifecycle state only. It does
not change production source, tests, package manifests, temporary files, or
spike artifacts in the working tree.

## Historical investigations

Add one concise historical-investigations document and link it from the root
README. It records for each spike:

- its branch and exact commit;
- the question investigated;
- the conclusions that remain useful;
- how to inspect the snapshot locally; and
- that the snapshot is evidence only and must never be merged into main.

The retained snapshots are:

- `spike/semantic-zoom-renderer-selection` at `54d8fd0`; and
- `spike/groma-tui` at `8b786ed`.

No Git remote is configured, so the branch names and exact commit hashes are
the durable local references.

## Current plans

Revisions 04 and 05 remain on main as current product intent.

Revision 04 describes the intended fixed-world semantic-zoom browser viewer.
It states the current React Flow direction without carrying withdrawn renderer
decisions, benchmark chronology, or exhaustive candidate evidence. Its C4
component files use the same renderer name as the revision overview.

Revision 05 describes the intended keyboard-driven terminal viewer. It keeps
the approved `(level, selection)` interaction and links to the historical TUI
investigation for supporting evidence.

The historical-investigations document owns investigation chronology. Plan
documents own only the current intended solution.

## Backlog cleanup

Use the Backlog CLI for every lifecycle move.

- Move terminal TASK-1 through TASK-16 into completed history.
- Move completed TASK-17 spike subtasks into completed history.
- Archive unfinished or superseded TASK-17 work.
- Archive TASK-18, its subtasks, and its empty milestone because no production
  TUI implementation is currently committed; Revision 05 retains the intent.
- Finish TASK-19 with objective evidence and move it into completed history.

Afterward, `backlog/tasks` and the active Kanban board contain no tasks.
Completed work remains distinguishable from work that was abandoned,
superseded, or never implemented.

## Verification

The cleanup is complete when:

- both spike branch refs and exact commits resolve;
- the root README reaches the historical-investigations document;
- Revisions 04 and 05 validate and contain no known renderer contradiction;
- the active Backlog task list is empty; and
- a scoped diff proves no production source, test, package-manifest,
  temporary, or spike-artifact path changed in this cleanup pass.

The cleanup is committed separately from any later removal of disposable spike
code, experiment dependencies, or temporary artifacts.
