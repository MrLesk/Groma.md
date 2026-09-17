# Backlog task links

When the `backlog` CLI is available and you work on a Backlog task, keep the
task's changed files and architecture references current. These links let
Groma place the task on the architecture map. Routine code work needs these
links, not a full scan and curation cycle.

## Commands

| Command | Target |
| --- | --- |
| `backlog task view <task-id> --plain` | a Backlog task ID; shows the current modified-file list and references |
| `backlog task edit <task-id> --modified-file <path>` | repository-relative paths; the flags replace the complete list |
| `backlog task edit <task-id> --add-ref <id>` or `--remove-ref <id>` | exact Groma element IDs |
| `groma view <source-file>` | an exact repository-relative source file; prints its owning component's ID and the file's relationships |

Architecture references must be real element IDs. File paths, titles, group
addresses, and issue URLs do not identify map elements.

## After each file change

1. Read the task with `backlog task view <task-id> --plain` before changing
   code.
2. Immediately after changing a repository file, and before changing another
   file, record its path. Preserve every existing entry and append each newly
   changed path, one flag per file in the order the files were first changed.
3. In that same update, add the ID of each affected architecture element, such
   as the component that owns a changed source file.

```bash
backlog task edit <task-id> \
  --modified-file <previous-path> \
  --modified-file <new-path> \
  --add-ref <groma-element-id>
```

Use the Backlog CLI; do not edit task Markdown directly. Do not wait until
testing or task completion to record these links.

## After a structural command

Structural commands print `ok`, then the target ID or group address, then their
completed writes:

- `created:`, `changed:`, or `removed:` names a repository-relative
  architecture path.
- `affected:` names an element whose document was written or removed.
- `replaced: <absorbed-id> -> <surviving-id>` means a combine removed the
  absorbed element into the survivor.

Moves report both paths and keep the same ID. Group commands report member
IDs. Groma does not save these results as ID aliases or operation history.

Immediately after a structural command, before any further change, record all
its created, changed, and removed paths in one Backlog update. Preserve the
complete existing modified-file list and append paths not already recorded.
Add the affected IDs that survive. For each replacement, remove the absorbed
ID and add the surviving ID:

```bash
backlog task edit <task-id> \
  --modified-file <previous-path> \
  --modified-file <created-or-changed-path> \
  --modified-file <removed-path> \
  --add-ref <surviving-id> \
  --remove-ref <absorbed-id>
```

Repeat `--modified-file`, `--add-ref`, and `--remove-ref` as needed.
